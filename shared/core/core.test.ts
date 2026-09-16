import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { walk } from "@std/fs";
import { z } from "zod";
import {
    assembleUsage,
    assertPureJson,
    CALL_KEY,
    contractConfig,
    countsMismatch,
    CREDITS_EPSILON,
    creditsDisagree,
    creditsOf,
    defaultFnUsage,
    defineEndpoint,
    defineProvider,
    docHash,
    flatLines,
    fnKey,
    getPath,
    hasMeteredLines,
    parseSchema,
    presets,
    pruneUndefined,
    pruneZeroCredits,
    stableStringify,
    Unit,
    UsageModelKind,
    ValidationError,
    zEndpointId,
    zEndpointPath,
    zeroUsage,
    zJson,
    zUsage,
    zUsageModel,
} from "@shared/core";

// ---------------------------------------------------------------------------
// contract config — override-free determinism
// ---------------------------------------------------------------------------

Deno.test("contract config: semver everywhere, loaded from config.yml", () => {
    const semver = /^\d+\.\d+\.\d+$/;
    assert(semver.test(contractConfig.schema.specVersion));
    assert(semver.test(contractConfig.schema.docFormatSince));
    assert(semver.test(contractConfig.schema.fnAbiSince));
});

Deno.test("contract config: no env override paths (never touches Deno.env)", async () => {
    // The CONTRACT loader must stay deterministic: same repo → same constants,
    // regardless of environment. Guard the whole core package.
    const coreDir = fromFileUrl(new URL(".", import.meta.url));
    for await (
        const entry of walk(coreDir, { includeDirs: false, exts: [".ts"] })
    ) {
        if (entry.path.endsWith(".test.ts")) continue;
        const source = await Deno.readTextFile(entry.path);
        assert(
            !source.includes("Deno.env"),
            `${entry.path} references Deno.env — the contract must be override-free`,
        );
    }
});

Deno.test("contract loader IGNORES logging subtrees (tooling carve-out)", () => {
    // compiler.logging exists in config.yml but is tooling config — the frozen
    // contract view must not surface it (it is read via @shared/app-config).
    assert(!("logging" in contractConfig.compiler));
    assert(!("logging" in contractConfig.schema));
});

// ---------------------------------------------------------------------------
// uniform parsing (parseSchema — one error voice everywhere)
// ---------------------------------------------------------------------------

Deno.test("parseSchema: typed value on success; ValidationError with context + sorted paths", () => {
    const schema = z.strictObject({
        a: z.string(),
        nested: z.strictObject({ b: z.number() }),
    });
    assertEquals(
        parseSchema(schema, { a: "x", nested: { b: 1 } }),
        { a: "x", nested: { b: 1 } },
    );
    const error = assertThrows(
        () =>
            parseSchema(schema, { a: 1, nested: { b: "no" } }, "test-context"),
        ValidationError,
    );
    assert(error.message.startsWith("test-context: "));
    // deterministic: path → messages JSON, sorted by path
    assert(error.message.includes('"a"'));
    assert(error.message.includes('"nested.b"'));
    assert(error.message.indexOf('"a"') < error.message.indexOf('"nested.b"'));
});

// ---------------------------------------------------------------------------
// Json type via zod's built-in z.json()
// ---------------------------------------------------------------------------

Deno.test("zJson (z.json()): accepts strict JSON, rejects non-finite numbers and functions", () => {
    assertEquals(zJson.parse({ a: [1, "x", null, { b: true }] }), {
        a: [1, "x", null, { b: true }],
    });
    assert(!zJson.safeParse(Number.POSITIVE_INFINITY).success);
    assert(!zJson.safeParse(Number.NaN).success);
    assert(!zJson.safeParse(() => 1).success);
    assert(!zJson.safeParse({ a: undefined }).success);
});

// ---------------------------------------------------------------------------
// stable serialization (RFC 8785 via canonicalize) + hashing
// ---------------------------------------------------------------------------

Deno.test("stableStringify: key order does not matter, array order does", () => {
    assertEquals(
        stableStringify({ b: 1, a: { d: 2, c: 3 } }),
        stableStringify({ a: { c: 3, d: 2 }, b: 1 }),
    );
    assert(stableStringify([1, 2]) !== stableStringify([2, 1]));
    // sorted keys in the output itself
    assertEquals(stableStringify({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

Deno.test("fnKey / docHash: deterministic, sha256-prefixed", async () => {
    const key = await fnKey("(ctx) => 1");
    assert(key.startsWith("sha256:"));
    assertEquals(key, await fnKey("(ctx) => 1"));
    const hash = await docHash({ b: 1, a: 2 });
    assertEquals(hash, await docHash({ a: 2, b: 1 })); // key order irrelevant
});

// ---------------------------------------------------------------------------
// Json purity helpers
// ---------------------------------------------------------------------------

Deno.test("assertPureJson rejects undefined and functions; pruneUndefined cleans", () => {
    assertThrows(() => assertPureJson({ a: undefined }, "doc"));
    assertThrows(() => assertPureJson({ a: () => 1 }, "doc"));
    assertEquals(pruneUndefined({ a: 1, b: undefined, c: { d: undefined } }), {
        a: 1,
        c: {},
    });
});

// ---------------------------------------------------------------------------
// path subset (deliberate RFC 9535 subset — no wildcards/filters/recursion)
// ---------------------------------------------------------------------------

Deno.test("getPath: dotted keys + numeric indexes; unsupported syntax → undefined", () => {
    const value = { results: [{ id: "a" }, { id: "b" }], cost: { total: 5 } };
    assertEquals(getPath(value, "$.cost.total"), 5);
    assertEquals(getPath(value, "$.results[1].id"), "b");
    assertEquals(getPath(value, "$.missing.deep"), undefined);
    assertEquals(getPath(value, "$..recursive"), undefined); // not in the subset
    assertEquals(getPath(value, "$.results[*]"), undefined); // no wildcards
});

Deno.test("zeroUsage: the forced settle-shape on provider errors", () => {
    assertEquals(zeroUsage(), { credits: {}, evidence: {} });
});

Deno.test("defaultFnUsage: a hookless estimate consumed nothing countable", () => {
    assertEquals(defaultFnUsage(), { counts: {} });
});

// ---------------------------------------------------------------------------
// usage validation helpers (design D26): the model's flat 1s, the credits
// fold, the engine-side assembly, and the counts ↔ model discipline —
// parsed through zUsageModel so PER_UNIT `every` materializes its default
// (the compiled-doc shape every consumer folds over)
// ---------------------------------------------------------------------------

const freeModel = zUsageModel.parse({ kind: "FREE" });
const flatModel = zUsageModel.parse({
    kind: "PER_CALL",
    consumes: { credit: "default", amount: 0.25 },
});
const meteredModel = zUsageModel.parse({
    kind: "PER_UNIT",
    unit: "RESULT",
    every: 50,
    consumes: { credit: "default", amount: 1.5 },
});
const compositeModel = zUsageModel.parse({
    kind: "COMPOSITE",
    components: {
        "actor-start": {
            kind: "PER_CALL",
            consumes: { credit: "default", amount: 0.25 },
        },
        "comment": {
            kind: "PER_UNIT",
            unit: "RESULT",
            consumes: { credit: "default", amount: 0.5 },
        },
    },
});

Deno.test("zUsageModel: PER_UNIT `every` defaults to 1 AT PARSE (concrete on every doc)", () => {
    assert(meteredModel.kind === "PER_UNIT");
    assertEquals(meteredModel.every, 50);
    const defaulted = zUsageModel.parse({
        kind: "PER_UNIT",
        unit: "RESULT",
        consumes: { credit: "default", amount: 0.5 },
    });
    assert(defaulted.kind === "PER_UNIT");
    assertEquals(defaulted.every, 1);
});

Deno.test("flatLines: PER_CALL draws {CALL: 1}; composite flat components draw their own id", () => {
    assertEquals(flatLines(flatModel), { [CALL_KEY]: 1 });
    assertEquals(flatLines(compositeModel), { "actor-start": 1 });
    assertEquals(flatLines(meteredModel), {});
    assertEquals(flatLines(freeModel), {});
});

Deno.test("creditsOf: ceil(quantity / every) × amount, summed per credit id", () => {
    // FREE folds to {} no matter what
    assertEquals(creditsOf(freeModel, {}), {});
    // flat: one draw iff the engine-appended CALL 1 is present
    assertEquals(creditsOf(flatModel, { [CALL_KEY]: 1 }), { default: 0.25 });
    assertEquals(creditsOf(flatModel, {}), {});
    // metered, every 50 at 1.5: 120 units → 3 whole increments → 4.5
    assertEquals(creditsOf(meteredModel, { RESULT: 120 }), { default: 4.5 });
    // whole increments: a single unit already bills a full increment
    assertEquals(creditsOf(meteredModel, { RESULT: 1 }), { default: 1.5 });
    assertEquals(creditsOf(meteredModel, {}), {});
    // composite lines draining ONE pool sum per credit id:
    // 0.25 (flat) + 3 × 0.5 (metered) = 1.75
    assertEquals(
        creditsOf(compositeModel, { "actor-start": 1, "comment": 3 }),
        { default: 1.75 },
    );
});

Deno.test("assembleUsage: fn counts + the model's flat 1s → {credits, evidence}", () => {
    assertEquals(assembleUsage(compositeModel, { "comment": 3 }), {
        credits: { default: 1.75 },
        evidence: { "comment": 3, "actor-start": 1 },
    });
    assertEquals(assembleUsage(flatModel, {}), {
        credits: { default: 0.25 },
        evidence: { CALL: 1 },
    });
    assertEquals(assembleUsage(freeModel, {}), { credits: {}, evidence: {} });
});

Deno.test("countsMismatch: one rule per kind; {counts: {}} passes everywhere", () => {
    // FREE and flat docs: fns count nothing (flat 1s are engine-appended)
    assertEquals(countsMismatch(freeModel, {}), undefined);
    assert(
        countsMismatch(freeModel, { RESULT: 1 })
            ?.includes("free bills nothing"),
    );
    assertEquals(countsMismatch(flatModel, {}), undefined);
    assert(countsMismatch(flatModel, { CALL: 1 })?.includes("flat doc"));
    // leaf PER_UNIT: the single implied key is the model's unit
    assertEquals(countsMismatch(meteredModel, { RESULT: 2 }), undefined);
    assert(countsMismatch(meteredModel, { TOKEN: 2 })?.includes('"TOKEN"'));
    // composite: every key names a PER_UNIT line — flat ids are rejected
    assertEquals(countsMismatch(compositeModel, { comment: 2 }), undefined);
    assert(
        countsMismatch(compositeModel, { "actor-start": 1 })
            ?.includes("names no metered line"),
    );
});

// ---------------------------------------------------------------------------
// the vendor-claim machinery (design D27): mismatch shape, the synthesis
// rule (hasMeteredLines), zero-claim pruning, and the claim ↔ fold check
// ---------------------------------------------------------------------------

Deno.test("zUsage: optional mismatch carries ONLY the derived fold (strict)", () => {
    // the common shape is unchanged — no mismatch key when the two agree
    assertEquals(
        zUsage.parse({ credits: { default: 1 }, evidence: { RESULT: 2 } }),
        { credits: { default: 1 }, evidence: { RESULT: 2 } },
    );
    // present: credits = the VENDOR's claim, mismatch.derived = OUR fold
    const disagreeing = {
        credits: { default: 0.5 },
        evidence: { RESULT: 3 },
        mismatch: { derived: { default: 1.5 } },
    };
    assertEquals(zUsage.parse(disagreeing), disagreeing);
    // strict: derived is required and is the ONLY mismatch field
    assert(
        !zUsage.safeParse({ credits: {}, evidence: {}, mismatch: {} }).success,
    );
    assert(
        !zUsage.safeParse({
            credits: {},
            evidence: {},
            mismatch: { derived: {}, reported: {} },
        }).success,
    );
});

Deno.test("hasMeteredLines: the D27 synthesis rule — true iff a PER_UNIT line exists", () => {
    assertEquals(hasMeteredLines(freeModel), false);
    assertEquals(hasMeteredLines(flatModel), false);
    assertEquals(hasMeteredLines(meteredModel), true);
    assertEquals(hasMeteredLines(compositeModel), true);
    // an ALL-FLAT composite meters nothing — the compiler synthesizes
    const allFlat = zUsageModel.parse({
        kind: "COMPOSITE",
        components: {
            "actor-start": {
                kind: "PER_CALL",
                consumes: { credit: "default", amount: 0.25 },
            },
            "actor-finish": {
                kind: "PER_CALL",
                consumes: { credit: "default", amount: 0.1 },
            },
        },
    });
    assertEquals(hasMeteredLines(allFlat), false);
});

Deno.test("pruneZeroCredits: zero entries mean nothing consumed; positives survive", () => {
    assertEquals(pruneZeroCredits({}), {});
    assertEquals(pruneZeroCredits({ default: 0 }), {});
    assertEquals(pruneZeroCredits({ default: 0, usd: 0.5 }), { usd: 0.5 });
});

Deno.test("creditsDisagree: float dust tolerated (1e-9); real deltas + one-sided pools flag", () => {
    assertEquals(CREDITS_EPSILON, 1e-9);
    // 0.1 + 0.2 !== 0.3 in floats — but the delta is dust, not billing
    assertEquals(
        creditsDisagree({ default: 0.3 }, { default: 0.1 + 0.2 }),
        false,
    );
    assertEquals(creditsDisagree({ default: 0.5 }, { default: 0.6 }), true);
    // a pool present on only one side is a real disagreement
    assertEquals(creditsDisagree({ default: 0.5 }, {}), true);
    assertEquals(creditsDisagree({}, { default: 0.5 }), true);
    assertEquals(creditsDisagree({}, {}), false);
});

// ---------------------------------------------------------------------------
// loader owns folder identity (the compiler never sees folder names)
// ---------------------------------------------------------------------------

Deno.test("loadConnectorDefs: folder != provider.name fails loudly", async () => {
    const dir = await Deno.makeTempDir();
    try {
        await Deno.mkdir(`${dir}/wrong-folder/endpoints`, { recursive: true });
        await Deno.writeTextFile(
            `${dir}/wrong-folder/provider.ts`,
            `export default { name: "other" };`,
        );
        const { loadConnectorDefs } = await import("./load/connector-defs.ts");
        const error = await assertRejects(() => loadConnectorDefs(dir));
        assert(String(error).includes("must equal the folder name"));
        assert(String(error).includes("wrong-folder"));
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
});

// ---------------------------------------------------------------------------
// the TYPE layer (design D19a): model-keyed counts + schema-typed bodies —
// the ts-expect-error directives below PROVE the narrowing (each fails
// `deno task check` whenever the generics stop rejecting what they must)
// ---------------------------------------------------------------------------

Deno.test("typed defineEndpoint: the generics narrow (and reject) as designed", () => {
    const meta = {
        displayName: "Typed",
        summary: "Types.",
        categories: ["demo-cat"],
    };
    const request = { method: "POST", path: "/x" } as const;
    const body = z.object({
        q: z.string(),
        maxItems: z.number().optional(),
    });

    // POSITIVE control — literal component keys + typed body access compile:
    const good = defineEndpoint({
        meta,
        request,
        input: { schema: { body } },
        usage: {
            model: {
                kind: UsageModelKind.COMPOSITE,
                components: {
                    "actor-start": {
                        kind: UsageModelKind.PER_CALL,
                        consumes: { credit: "default", amount: 0.01 },
                    },
                    "comment": {
                        kind: UsageModelKind.PER_UNIT,
                        unit: Unit.RESULT,
                        consumes: { credit: "default", amount: 0.01 },
                    },
                },
            },
            evidence: ({ data }) => ({
                // typed body: direct property access, no JSONPath
                counts: { "comment": data.input.body.maxItems ?? 1 },
            }),
            estimate: ({ data }) => ({
                counts: { "comment": data.input.body.maxItems ?? 1 },
            }),
            // the vendor-meter fn (design D27): {credits, output?}
            consolidate: () => ({ credits: { default: 0.02 }, output: null }),
        },
    });
    assert(good.meta.displayName === "Typed");

    // NEGATIVE controls — each line MUST be a typecheck error:
    void (() =>
        defineEndpoint({
            meta,
            request,
            input: { schema: { body } },
            usage: {
                model: {
                    kind: UsageModelKind.COMPOSITE,
                    components: {
                        "actor-start": {
                            kind: UsageModelKind.PER_CALL,
                            consumes: { credit: "default", amount: 0.01 },
                        },
                        "comment": {
                            kind: UsageModelKind.PER_UNIT,
                            unit: Unit.RESULT,
                            consumes: { credit: "default", amount: 0.01 },
                        },
                    },
                },
                // @ts-expect-error — typo'd key: not a metered component
                estimate: () => ({
                    counts: { "commnet": 1 },
                }),
            },
        }));
    void (() =>
        defineEndpoint({
            meta,
            request,
            input: { schema: { body } },
            usage: {
                model: {
                    kind: UsageModelKind.COMPOSITE,
                    components: {
                        "actor-start": {
                            kind: UsageModelKind.PER_CALL,
                            consumes: { credit: "default", amount: 0.01 },
                        },
                        "comment": {
                            kind: UsageModelKind.PER_UNIT,
                            unit: Unit.RESULT,
                            consumes: { credit: "default", amount: 0.01 },
                        },
                    },
                },
                // @ts-expect-error — flat component: never a count (D18)
                estimate: () => ({
                    counts: { "actor-start": 1 },
                }),
            },
        }));
    void (() =>
        defineEndpoint({
            meta,
            request,
            input: { schema: { body } },
            usage: {
                model: {
                    kind: UsageModelKind.PER_CALL,
                    consumes: { credit: "default", amount: 0.01 },
                },
                // @ts-expect-error — a COUNTING fn on a flat doc: its
                // counts type rejects every entry (only {} is writable)
                estimate: () => ({ counts: { "RESULT": 3 } }),
            },
        }));
    void (() =>
        defineEndpoint({
            meta,
            request,
            input: { schema: { body } },
            usage: {
                model: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    consumes: { credit: "default", amount: 0.01 },
                },
                evidence: ({ data }) => ({
                    // @ts-expect-error — the body schema has no such field
                    counts: { "RESULT": data.input.body.nope ?? 1 },
                }),
            },
        }));
    void (() =>
        defineEndpoint({
            meta,
            request,
            input: { schema: { body } },
            usage: {
                model: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    consumes: { credit: "default", amount: 0.01 },
                },
                evidence: () => ({ counts: {} }),
                // @ts-expect-error — the pre-D27 shape: consolidate
                // returns {credits, output?}, never {usage: {counts}}
                consolidate: () => ({ usage: { counts: {} } }),
            },
        }));
    void (() =>
        defineEndpoint({
            meta,
            request,
            input: { schema: { body } },
            usage: {
                model: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    consumes: { credit: "default", amount: 0.01 },
                },
                // @ts-expect-error — a leaf doc keys by its unit, not TOKEN
                estimate: () => ({
                    counts: { "TOKEN": 1 },
                }),
            },
        }));
    // Renamed ctx paths (D23 addendum): facts live under their provenance —
    // the OLD flat paths are compile errors everywhere.
    void (() =>
        defineEndpoint({
            meta,
            request,
            input: { schema: { body } },
            usage: {
                model: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    consumes: { credit: "default", amount: 0.01 },
                },
                estimate: ({ data }) => ({
                    counts: {
                        // @ts-expect-error — data.model moved to data.usage.model
                        "RESULT": data.model.kind === "PER_UNIT" ? 1 : 2,
                    },
                }),
            },
        }));
});

Deno.test("typed lifecycle.state: the declared schema types reads AND writes", () => {
    const meta = {
        displayName: "Typed state",
        summary: "State types.",
        categories: ["demo-cat"],
    };
    const request = { method: "POST", path: "/x" } as const;
    const body = z.object({ q: z.string() });
    const stateData = z.object({
        datasetId: z.string(),
        usd: z.number().optional(),
    });

    // POSITIVE control — a poll that reads the typed bag and writes a
    // conforming next state compiles (state.data = z.output of the doc's
    // OWN lifecycle.state schema; sound: engine-validated every tick):
    const good = defineEndpoint({
        meta,
        request,
        input: { schema: { body } },
        usage: {
            model: {
                kind: UsageModelKind.PER_UNIT,
                unit: Unit.RESULT,
                consumes: { credit: "default", amount: 0.01 },
            },
            evidence: ({ data }) => ({
                counts: {
                    "RESULT": data.lifecycle?.state.data?.usd !== undefined
                        ? 1
                        : 0,
                },
            }),
        },
        lifecycle: {
            state: stateData,
            start: async ({ utils }) => {
                const r = await utils.request();
                return {
                    kind: "RUNNING",
                    state: {
                        externalRunId: "run-1",
                        data: { datasetId: String(r.status) },
                    },
                };
            },
            poll: async ({ data, utils }) => {
                // typed READ: the threaded bag has the declared shape
                const id = data.lifecycle.state.data?.datasetId ?? "none";
                const r = await utils.http({
                    method: "GET",
                    path: `/jobs/${id}`,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: r.status,
                    output: r.body,
                    // typed WRITE: a conforming whole-state
                    state: { data: { datasetId: id, usd: 0.1 } },
                };
            },
        },
    });
    void good;

    void (() =>
        defineEndpoint({
            meta,
            request,
            input: { schema: { body } },
            usage: {
                model: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    consumes: { credit: "default", amount: 0.01 },
                },
                evidence: () => ({ counts: {} }),
            },
            lifecycle: {
                state: stateData,
                // @ts-expect-error — mis-shaped state bag (datasetID,
                // typo-cased): the WRITE site fails check, not just the
                // runtime tick gate
                start: async ({ utils }) => {
                    await utils.request();
                    return {
                        kind: "RUNNING",
                        state: { data: { datasetID: "typo-cased" } },
                    };
                },
            },
        }));
    void (() =>
        defineEndpoint({
            meta,
            request,
            input: { schema: { body } },
            usage: {
                model: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    consumes: { credit: "default", amount: 0.01 },
                },
                evidence: ({ data }) => ({
                    counts: {
                        // @ts-expect-error — no such field on the
                        // declared state bag (typed READ at settle)
                        "RESULT": data.lifecycle?.state.data?.nope ?? 0,
                    },
                }),
            },
            lifecycle: {
                state: stateData,
                start: async ({ utils }) => {
                    const r = await utils.request();
                    return {
                        kind: "COMPLETED",
                        httpStatus: r.status,
                        output: r.body,
                    };
                },
            },
        }));
});

Deno.test("typed defineProvider: the provider's OWN lifecycle.state types its fns", () => {
    const stateData = z.strictObject({
        datasetId: z.string().optional(),
        usageTotalUsd: z.number().optional(),
    });

    // POSITIVE control — typed state read (poll + consolidate) and a
    // conforming write compile; the BODY stays Json | undefined (a provider
    // fn serves every endpoint — D23's documented seam):
    const good = defineProvider({
        name: "demo",
        meta: { displayName: "Demo", summary: "Demo provider." },
        request: { baseUrl: "https://api.demo.test" },
        auth: { inject: presets.auth.header("x-demo-key") },
        lifecycle: {
            state: stateData,
            start: async ({ utils }) => {
                const res = await utils.request();
                return {
                    kind: "RUNNING",
                    state: { externalRunId: String(res.status) },
                };
            },
            poll: async ({ data, utils }) => {
                // typed READ of the provider-declared bag
                const id = data.lifecycle.state.data?.datasetId ?? "none";
                const res = await utils.http({
                    method: "GET",
                    path: `/runs/${id}`,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                    // typed WRITE — checked against stateData
                    state: { data: { datasetId: id, usageTotalUsd: 0.1 } },
                };
            },
        },
        usage: {
            // a GENERIC quantities default (design D27) — counts stay
            // Record<string, number> at provider level
            evidence: () => ({ counts: {} }),
            // typed READ at settle: the stashed vendor meter is LIFTED
            // into the claim (design D27 — the claim wins at settle;
            // receipts stay the raw run record's job)
            consolidate: ({ data }) => {
                const usd = data.lifecycle?.state.data?.usageTotalUsd;
                return {
                    credits: { ...(usd !== undefined ? { default: usd } : {}) },
                };
            },
        },
    });
    void good;

    void (() =>
        defineProvider({
            name: "demo",
            meta: { displayName: "Demo", summary: "Demo provider." },
            request: { baseUrl: "https://api.demo.test" },
            auth: { inject: presets.auth.header("x-demo-key") },
            lifecycle: {
                state: stateData,
                // @ts-expect-error — mis-shaped state bag (datasetID,
                // typo-cased): the provider WRITE site fails check —
                // e.g. stashing an unprojected pricing card would too
                start: async ({ utils }) => {
                    await utils.request();
                    return {
                        kind: "RUNNING",
                        state: { data: { datasetID: "typo-cased" } },
                    };
                },
            },
            usage: { consolidate: () => ({ credits: {} }) },
        }));
    void (() =>
        defineProvider({
            name: "demo",
            meta: { displayName: "Demo", summary: "Demo provider." },
            request: { baseUrl: "https://api.demo.test" },
            auth: { inject: presets.auth.header("x-demo-key") },
            lifecycle: {
                state: stateData,
                start: async ({ utils }) => {
                    const res = await utils.request();
                    return {
                        kind: "COMPLETED",
                        httpStatus: res.status,
                        output: res.body,
                    };
                },
            },
            usage: {
                consolidate: ({ data }) => ({
                    credits: {},
                    output: {
                        // @ts-expect-error — no such field on the
                        // provider's declared state bag (typed READ)
                        nope: data.lifecycle?.state.data?.nope ?? null,
                    },
                }),
            },
        }));
});

Deno.test("typed FREE model + typed queryParams: the D25 layer narrows as designed", () => {
    const meta = {
        displayName: "Typed free",
        summary: "Free types.",
        categories: ["demo-cat"],
    };
    const request = { method: "GET", path: "/lookup" } as const;
    const queryParams = z.object({
        q: z.string(),
        limit: z.number().int().min(1).optional(),
    });

    // POSITIVE control — a FREE doc's fns return plain empty counts (the
    // MODEL is the free fact, D25), and the estimate reads TYPED
    // queryParams (pre-toRequest input):
    const good = defineEndpoint({
        meta,
        request,
        input: {
            schema: { queryParams: queryParams.required({ limit: true }) },
        },
        usage: {
            model: { kind: UsageModelKind.FREE },
            estimate: ({ data }) => {
                // typed queryParams: the read typechecks against the
                // doc's OWN schema (required() made limit a number)
                const requestedLimit: number = data.input.queryParams.limit;
                void requestedLimit;
                return { counts: {} };
            },
        },
    });
    void good;

    void (() =>
        defineEndpoint({
            meta,
            request,
            input: { schema: { queryParams } },
            usage: {
                model: { kind: UsageModelKind.FREE },
                // @ts-expect-error — a FREE doc has no metered keys: its
                // fns can write only {} (free bills nothing — D25)
                estimate: () => ({ counts: { "RESULT": 1 } }),
            },
        }));
    void (() =>
        defineEndpoint({
            meta,
            request,
            input: { schema: { queryParams } },
            usage: {
                model: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    consumes: { credit: "default", amount: 0.01 },
                },
                estimate: ({ data }) => ({
                    counts: {
                        // @ts-expect-error — no such field on the doc's own
                        // queryParams schema (typed input, D25)
                        "RESULT": data.input.queryParams.nope ?? 1,
                    },
                }),
            },
        }));
});

// ---------------------------------------------------------------------------
// endpoint identity — literal segments AND {param} placeholders
// ---------------------------------------------------------------------------

Deno.test("endpoint identity: a {param} segment is a legal path and id", () => {
    // the point of allowing placeholders: a resource-style endpoint is named
    // by the vendor's ACTUAL path, so what the caller sees is what we call
    for (
        const path of [
            "/search",
            "/v1/company/enrichment",
            "/apidojo/tweet-scraper",
            "/crawl/{id}",
            "/batch/scrape/{id}",
            "/deals/{id}/investors",
            "/jobs/{jobId}",
        ]
    ) {
        assertEquals(zEndpointPath.parse(path), path);
    }
    assertEquals(
        zEndpointId.parse("firecrawl#crawl/{id}"),
        "firecrawl#crawl/{id}",
    );
});

Deno.test("endpoint identity: malformed placeholders are still rejected", () => {
    for (
        const path of [
            "/crawl/{}", // empty
            "/crawl/{Id}", // must start lowercase
            "/crawl/{id", // unclosed
            "/crawl/id}", // unopened
            "/crawl/{id}x", // trailing junk in the segment
            "/crawl/{a-b}", // hyphen is not a param char
            "/Crawl/{id}", // literal segments stay lowercase
        ]
    ) {
        assertThrows(() => zEndpointPath.parse(path), Error, "", path);
    }
    assertThrows(() => zEndpointId.parse("firecrawl#crawl/{}"));
});
