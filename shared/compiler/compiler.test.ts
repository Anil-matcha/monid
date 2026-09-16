import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { z } from "zod";
import { fromFileUrl, join } from "@std/path";
import { greaterThan, parse } from "@std/semver";
import {
    type ConnectorSource,
    contractConfig,
    defineEndpoint,
    defineProvider,
    type EndpointDefSeed,
    fnKeysOf,
    inspectEndpoint,
    listCategories,
    listEndpoints,
    listProviders,
    loadCategoryRegistry,
    loadConnectorDefs,
    presets,
    type ProviderDefSeed,
    sealUnit,
    stableStringify,
    zBundle,
} from "@shared/core";
import {
    compileBundle,
    CompileError,
    CompileErrorCode,
    lintClosedTerm,
    normalizeFnSource,
} from "@shared/compiler";

const REPO_ROOT = fromFileUrl(new URL("../../", import.meta.url));

const OPTS = {
    compilerVersion: "0.1.0",
    builtWithEngineVersion: "0.1.0",
    catalogVersion: "0.0.0-test",
    generatedAt: "1970-01-01T00:00:00.000Z",
    leafCategories: [
        { id: "demo-cat", displayName: "Demo Category" },
        { id: "web-search", displayName: "Web Search" },
        { id: "web-scraping", displayName: "Web Scraping" },
    ],
} as const;

function makeProvider(overrides: Partial<ProviderDefSeed> = {}) {
    // splices ARBITRARY seed fragments (that is its job), so it deliberately
    // bypasses defineProvider's typed generics via the cast — the zod schema
    // still validates at runtime (same posture as makeEndpoint below)
    return defineProvider(
        {
            name: "demo",
            meta: { displayName: "Demo", summary: "A demo provider." },
            auth: { inject: presets.auth.header("x-demo-key") },
            request: { baseUrl: "https://api.demo.test" },
            usage: {
                model: {
                    kind: "PER_CALL",
                    consumes: { credit: "default", amount: 0.01 },
                },
                // billable lines drain a DECLARED credit system (D26):
                // one provider-level pool serves every test doc. The
                // flat model has no metered lines, so estimate and
                // evidence are compiler-SYNTHESIZED (design D27);
                // consolidate is optional and none is declared.
                credits: { default: { label: "Demo credits" } },
            },
            ...overrides,
        } as Parameters<typeof defineProvider>[0],
    );
}

function makeEndpoint(overrides: Partial<EndpointDefSeed> = {}) {
    // the factory splices ARBITRARY seed fragments (that is its job), so it
    // deliberately bypasses defineEndpoint's typed generics via the cast —
    // runtime validation (parseSchema) still applies in full
    return defineEndpoint(
        {
            meta: {
                displayName: "Demo Search",
                summary: "Searches.",
                categories: ["demo-cat"],
            },
            request: { method: "POST", path: "/search" },
            input: { schema: { body: z.object({ q: z.string() }) } },
            ...overrides,
        } as Parameters<typeof defineEndpoint>[0],
    );
}

function source(
    endpoints: { name: string; def: ReturnType<typeof makeEndpoint> }[],
    provider = makeProvider(),
): ConnectorSource[] {
    return [{ provider, endpoints }];
}

// ---------------------------------------------------------------------------
// normalization (TS printer — no subprocess, no hand-rolled stripping)
// ---------------------------------------------------------------------------

Deno.test("normalization: comments and formatting do not change the source", () => {
    const a = normalizeFnSource(
        `({ data, utils }) => /* strip! */ ({ ...data.input })`,
    );
    const b = normalizeFnSource(`({ data,   utils }) =>
        ({ ...data.input })   // trailing`);
    assertEquals(a, b);
});

Deno.test("normalization is string-aware (urls are not comments)", () => {
    const normal = normalizeFnSource(
        `(x) => "http://not-a-comment" // real comment`,
    );
    assert(normal.includes("http://not-a-comment"));
    assert(!normal.includes("real comment"));
});

Deno.test("normalization: COMPACT — author newlines/tabs replaced, one line out", () => {
    // whitespace is not preserved; it is replaced by the compact normal form
    assertEquals(
        normalizeFnSource("({ data, utils }) =>\n({\n\t...data.input,\n})"),
        "({data,utils})=>({...data.input,})",
    );
    // keyword adjacency keeps the single required space
    assertEquals(
        normalizeFnSource("(x) => { return x + 1; }"),
        "(x)=>{return x+1;}",
    );
    // unary +/- never merge into ++/--
    assertEquals(
        normalizeFnSource("(a, b) => a + +b - -a"),
        "(a,b)=>a+ +b- -a",
    );
});

Deno.test("normalization: layout variants of the SAME fn produce one byte-form", () => {
    // CRLF vs LF twins
    assertEquals(
        normalizeFnSource("(x) => {\r\n    return x;\r\n}"),
        normalizeFnSource("(x) => {\n    return x;\n}"),
    );
    // tabs vs spaces, single-line vs multi-line (the raw TS printer preserves
    // source line layout — compaction is what makes this hold)
    assertEquals(
        normalizeFnSource("({ data }) => ({ ...data.input })"),
        normalizeFnSource("({ data }) =>\n({\n\t...data.input\n})"),
    );
});

Deno.test("normalization: literal contents survive verbatim", () => {
    // semantic newline INSIDE a template literal is content, not layout
    assertEquals(normalizeFnSource("(x) => `a\nb=${x}!`"), "(x)=>`a\nb=${x}!`");
    // regex literal with internal spaces kept byte-exact (slash rescan)
    assertEquals(
        normalizeFnSource("(s) => / a b /.test(s)"),
        "(s)=>/ a b /.test(s)",
    );
    // division is NOT mistaken for a regex
    assertEquals(normalizeFnSource("(a, b) => a / b / 2"), "(a,b)=>a/b/2");
});

Deno.test("closed-term lint rejects free identifiers, allows params/locals/whitelist", () => {
    lintClosedTerm(
        `({ data, utils }) => { const n = utils.json.len(data.output, "$.r"); return Math.min(n, 5); }`,
        "ok",
    );
    let threw = false;
    try {
        lintClosedTerm(`(ctx) => Unit.RESULT`, "free");
    } catch (error) {
        threw = true;
        assert(String(error).includes("Unit"));
    }
    assert(threw, "expected free-identifier error");
});

// ---------------------------------------------------------------------------
// compilation
// ---------------------------------------------------------------------------

Deno.test("compile produces doc maps + interned table; ids inferred; closure holds", async () => {
    const bundle = await compileBundle(
        source([
            { name: "search", def: makeEndpoint() },
            {
                name: "other",
                def: makeEndpoint({
                    request: { method: "POST", path: "/other" },
                }),
            },
        ]),
        OPTS,
    );
    // maps keyed by identity — uniqueness by construction
    assertEquals(Object.keys(bundle.endpoints).sort(), [
        "demo#other",
        "demo#search",
    ]);
    assertEquals(Object.keys(bundle.providers), ["demo"]);
    const other = bundle.endpoints["demo#other"];
    const search = bundle.endpoints["demo#search"];
    // interning: identical fallback fns share one entry — both flat docs
    // carry the ONE synthesized quantities entry (design D27)
    assertEquals(other.usage.evidence.$fn.key, search.usage.evidence.$fn.key);
    assertEquals(other.usage.estimate.$fn.key, search.usage.estimate.$fn.key);
    assertEquals(other.auth.inject.$fn.key, search.auth.inject.$fn.key);
    // fnTable closure in BOTH directions
    const referenced = new Set(
        Object.values(bundle.endpoints).flatMap((doc) => fnKeysOf(doc)),
    );
    assertEquals(new Set(Object.keys(bundle.fnTable)), referenced);
    // slim ProviderDoc: identity + display only (no endpoint index, no credentials)
    assertEquals(bundle.providers["demo"].name, "demo");
    assertEquals("endpoints" in bundle.providers["demo"], false);
    assertEquals("credentials" in bundle.providers["demo"], false);
    // taxonomy: full registry + endpoint membership
    assertEquals(bundle.taxonomy.leaves.length, 3);
    assertEquals(bundle.taxonomy.membership["demo-cat"], [
        "demo#other",
        "demo#search",
    ]);
    // toolchain provenance (never a gate)
    assertEquals(bundle.toolchain, {
        compilerVersion: "0.1.0",
        builtWithEngineVersion: "0.1.0",
    });
});

Deno.test("coded rejections: a malformed def at the compiler boundary is DOC_MALFORMED", async () => {
    // hand-built sources bypass defineEndpoint's author-time validation —
    // the COMPILER boundary must still emit a coded CompileError (build
    // tooling branches on WHY), never parseSchema's raw ValidationError
    const malformed = {
        meta: {
            displayName: "Bad",
            summary: "Bad.",
            categories: ["demo-cat"],
        },
        request: { method: "POST", path: "/x", baseUrl: "not a url" },
        input: { schema: {} },
    } as unknown as ReturnType<typeof makeEndpoint>;
    const error = await assertRejects(() =>
        compileBundle(
            source([{ name: "search", def: malformed }]),
            OPTS,
        )
    );
    assert(error instanceof CompileError);
    assertEquals(error.code, CompileErrorCode.DOC_MALFORMED);
    assert(error.cause !== undefined, "ValidationError preserved as cause");
});

Deno.test("usage.model is REQUIRED: endpoint ?? provider, neither fails", async () => {
    await assertRejects(
        () =>
            compileBundle(
                source(
                    [{ name: "search", def: makeEndpoint() }],
                    makeProvider({ usage: undefined }),
                ),
                OPTS,
            ),
        Error,
        "usage.model must resolve",
    );
});

Deno.test("D27 synthesis: meterless docs share ONE fnTable entry for estimate + evidence", async () => {
    // neither endpoint nor provider declares estimate/evidence, and
    // neither model (flat, FREE) has metered lines — the compiler
    // interns the one lawful fn ONCE, repo-wide
    const bundle = await compileBundle(
        source([
            { name: "search", def: makeEndpoint() },
            {
                name: "free",
                def: makeEndpoint({
                    request: { method: "POST", path: "/free" },
                    usage: { model: { kind: "FREE" } },
                }),
            },
        ]),
        OPTS,
    );
    const flat = bundle.endpoints["demo#search"];
    const free = bundle.endpoints["demo#free"];
    const key = flat.usage.estimate.$fn.key;
    assertEquals(flat.usage.evidence.$fn.key, key);
    assertEquals(free.usage.estimate.$fn.key, key);
    assertEquals(free.usage.evidence.$fn.key, key);
    const entry = bundle.fnTable[key];
    assertEquals(entry.provenance, "core#usage.synthesizedEmpty");
    assertEquals(entry.src, "()=>({counts:{}})");
    // consolidate stays absent — no vendor meter was declared anywhere
    assertEquals(flat.usage.consolidate, undefined);
    assertEquals(free.usage.consolidate, undefined);
});

Deno.test("metered models: usage.estimate + usage.evidence must resolve (no synthesis)", async () => {
    const metered = {
        model: {
            kind: "PER_UNIT",
            unit: "RESULT",
            consumes: { credit: "default", amount: 0.01 },
        },
    } as Partial<EndpointDefSeed>["usage"];
    // neither endpoint nor provider declares an estimate
    const error = await assertRejects(() =>
        compileBundle(
            source([{ name: "search", def: makeEndpoint({ usage: metered }) }]),
            OPTS,
        )
    );
    assert(error instanceof CompileError);
    assertEquals(error.code, CompileErrorCode.HOOK_UNRESOLVED);
    assert(error.message.includes("usage.estimate must resolve"));
    // estimate declared, evidence still missing
    await assertRejects(
        () =>
            compileBundle(
                source([{
                    name: "search",
                    def: makeEndpoint({
                        usage: { ...metered, estimate: () => ({ counts: {} }) },
                    }),
                }]),
                OPTS,
            ),
        Error,
        "usage.evidence must resolve",
    );
});

Deno.test("usage.consolidate is OPTIONAL: endpoint ?? provider fallback when declared", async () => {
    const withMeter = {
        model: {
            kind: "PER_CALL",
            consumes: { credit: "default", amount: 0.01 },
        },
        credits: { default: { label: "Demo credits" } },
        consolidate: () => ({ credits: {} }),
    } as Partial<ProviderDefSeed>["usage"];
    // provider-declared: every doc inherits the ONE vendor-meter fn
    const bundle = await compileBundle(
        source(
            [
                { name: "search", def: makeEndpoint() },
                {
                    name: "other",
                    def: makeEndpoint({
                        request: { method: "POST", path: "/other" },
                    }),
                },
            ],
            makeProvider({ usage: withMeter }),
        ),
        OPTS,
    );
    const search = bundle.endpoints["demo#search"];
    const other = bundle.endpoints["demo#other"];
    assert(search.usage.consolidate?.$fn.key.startsWith("sha256:"));
    assertEquals(
        other.usage.consolidate?.$fn.key,
        search.usage.consolidate?.$fn.key,
    );
    assertEquals(
        bundle.fnTable[search.usage.consolidate!.$fn.key].provenance,
        "connectors/demo/provider.ts#usage.consolidate",
    );
    // an endpoint's own consolidate REPLACES the provider's (fallback)
    const overridden = await compileBundle(
        source(
            [{
                name: "search",
                def: makeEndpoint({
                    usage: {
                        consolidate: ({ data }) => ({
                            credits: {},
                            output: data.output,
                        }),
                    },
                }),
            }],
            makeProvider({ usage: withMeter }),
        ),
        OPTS,
    );
    const doc = overridden.endpoints["demo#search"];
    assert(
        doc.usage.consolidate!.$fn.key !== search.usage.consolidate!.$fn.key,
    );
    assertEquals(
        overridden.fnTable[doc.usage.consolidate!.$fn.key].provenance,
        "connectors/demo/endpoints/search/endpoint.ts#usage.consolidate",
    );
});

Deno.test("≥2 metered components require DOC-level evidence + estimate (design D19)", async () => {
    const model = {
        kind: "COMPOSITE",
        components: {
            "page": {
                kind: "PER_UNIT",
                unit: "PAGE",
                consumes: { credit: "default", amount: 0.01 },
            },
            "profile": {
                kind: "PER_UNIT",
                unit: "RESULT",
                consumes: { credit: "default", amount: 0.02 },
            },
        },
    } as const;
    // a generic (provider) evidence fn can't choose a key between two
    // metered components — build fails, not the first live run
    await assertRejects(
        () =>
            compileBundle(
                source([{
                    name: "search",
                    def: makeEndpoint({ usage: { model } }),
                }]),
                OPTS,
            ),
        Error,
        "doc-level usage.evidence",
    );
    // a doc-level evidence alone is not enough — the estimate keys too
    await assertRejects(
        () =>
            compileBundle(
                source([{
                    name: "search",
                    def: makeEndpoint({
                        usage: {
                            model,
                            evidence: () => ({ counts: { "page": 1 } }),
                        },
                    }),
                }]),
                OPTS,
            ),
        Error,
        "doc-level usage.estimate",
    );
    // both declared ⇒ compiles
    const bundle = await compileBundle(
        source([{
            name: "search",
            def: makeEndpoint({
                usage: {
                    model,
                    evidence: () => ({ counts: { "page": 1 } }),
                    estimate: () => ({ counts: { "page": 1 } }),
                },
            }),
        }]),
        OPTS,
    );
    // the compiled model carries `every` MATERIALIZED (parse-time
    // default 1, design D26) — never the authored omission
    assertEquals(
        bundle.endpoints["demo#search"].usage.model,
        {
            kind: "COMPOSITE",
            components: {
                "page": {
                    kind: "PER_UNIT",
                    unit: "PAGE",
                    every: 1,
                    consumes: { credit: "default", amount: 0.01 },
                },
                "profile": {
                    kind: "PER_UNIT",
                    unit: "RESULT",
                    every: 1,
                    consumes: { credit: "default", amount: 0.02 },
                },
            },
        },
    );
});

// ---------------------------------------------------------------------------
// credits (design D26) — declaration + reference checks at compile
// ---------------------------------------------------------------------------

Deno.test("usage.credits must resolve for billable models; the ENDPOINT declaration fills in", async () => {
    // a billable provider usage block WITHOUT a credits declaration
    const billable = {
        model: {
            kind: "PER_CALL",
            consumes: { credit: "default", amount: 0.01 },
        },
    } as Partial<ProviderDefSeed>["usage"];
    await assertRejects(
        () =>
            compileBundle(
                source(
                    [{ name: "search", def: makeEndpoint() }],
                    makeProvider({ usage: billable }),
                ),
                OPTS,
            ),
        Error,
        "usage.credits must resolve",
    );
    // the endpoint's own declaration resolves it when the provider has none
    const bundle = await compileBundle(
        source(
            [{
                name: "search",
                def: makeEndpoint({
                    usage: { credits: { default: { label: "Demo credits" } } },
                }),
            }],
            makeProvider({ usage: billable }),
        ),
        OPTS,
    );
    assertEquals(bundle.endpoints["demo#search"].usage.credits, {
        default: { label: "Demo credits" },
    });
});

Deno.test("a line consuming an UNDECLARED credit fails compilation", async () => {
    await assertRejects(
        () =>
            compileBundle(
                source([{
                    name: "search",
                    def: makeEndpoint({
                        usage: {
                            model: {
                                kind: "PER_UNIT",
                                unit: "RESULT",
                                consumes: { credit: "nope", amount: 0.01 },
                            },
                            estimate: () => ({ counts: {} }),
                            evidence: () => ({ counts: { "RESULT": 1 } }),
                        },
                    }),
                }]),
                OPTS,
            ),
        Error,
        'consumes undeclared credit "nope"',
    );
});

Deno.test("a PROVIDER pool drained by NO endpoint fails compilation", async () => {
    await assertRejects(
        () =>
            compileBundle(
                source(
                    [{ name: "search", def: makeEndpoint() }],
                    makeProvider({
                        usage: {
                            model: {
                                kind: "PER_CALL",
                                consumes: { credit: "default", amount: 0.01 },
                            },
                            credits: {
                                default: { label: "Demo credits" },
                                extra: { label: "Never drained" },
                            },
                        } as Partial<ProviderDefSeed>["usage"],
                    }),
                ),
                OPTS,
            ),
        Error,
        'declared credit "extra" is drained by no endpoint',
    );
});

// THE regression this rule exists for (pdl's four x-call-credits-type
// pools, PR #7): a provider-wide pool SET, one pool drained per endpoint.
Deno.test("a provider declares the POOL SET; ONE endpoint per pool is enough", async () => {
    const bundle = await compileBundle(
        source(
            [
                {
                    name: "search",
                    def: makeEndpoint({
                        usage: {
                            model: {
                                kind: "PER_CALL",
                                consumes: { credit: "search", amount: 1 },
                            },
                        },
                    }),
                },
                {
                    name: "enrich",
                    def: makeEndpoint({
                        request: { method: "POST", path: "/enrich" },
                        usage: {
                            model: {
                                kind: "PER_CALL",
                                consumes: { credit: "enrich", amount: 1 },
                            },
                        },
                    }),
                },
            ],
            makeProvider({
                usage: {
                    credits: {
                        search: { label: "Search credits" },
                        enrich: { label: "Enrich credits" },
                    },
                } as Partial<ProviderDefSeed>["usage"],
            }),
        ),
        OPTS,
    );
    // each doc carries ONLY the pool its own lines drain (design D6c)
    assertEquals(bundle.endpoints["demo#search"].usage.credits, {
        search: { label: "Search credits" },
    });
    assertEquals(bundle.endpoints["demo#enrich"].usage.credits, {
        enrich: { label: "Enrich credits" },
    });
});

Deno.test("an ENDPOINT-declared pool it does not drain fails compilation", async () => {
    await assertRejects(
        () =>
            compileBundle(
                source([{
                    name: "search",
                    def: makeEndpoint({
                        usage: {
                            credits: { extra: { label: "Never drained" } },
                        },
                    }),
                }]),
                OPTS,
            ),
        Error,
        'endpoint-declared credit "extra" is drained by no line',
    );
});

Deno.test("credits resolve KEY-WISE, endpoint over provider (D20 closest wins)", async () => {
    const bundle = await compileBundle(
        source([{
            name: "search",
            def: makeEndpoint({
                usage: {
                    credits: { default: { label: "Endpoint label wins" } },
                },
            }),
        }]),
        OPTS,
    );
    assertEquals(bundle.endpoints["demo#search"].usage.credits, {
        default: { label: "Endpoint label wins" },
    });
});

Deno.test("FREE docs compile with EMPTY credits — the provider's pool is another endpoint's", async () => {
    const bundle = await compileBundle(
        source([
            // the billable sibling drains the provider's `default` pool,
            // so the declaration is live (design D6b)
            {
                name: "paid",
                def: makeEndpoint({
                    request: { method: "POST", path: "/paid" },
                }),
            },
            {
                name: "search",
                def: makeEndpoint({
                    usage: { model: { kind: "FREE" } },
                }),
            },
        ]),
        OPTS,
    );
    assertEquals(bundle.endpoints["demo#search"].usage.credits, {});
    assertEquals(bundle.endpoints["demo#paid"].usage.credits, {
        default: { label: "Demo credits" },
    });
});

Deno.test("auth.inject is REQUIRED: endpoint ?? provider, neither fails", async () => {
    await assertRejects(
        () =>
            compileBundle(
                source(
                    [{ name: "search", def: makeEndpoint() }],
                    makeProvider({ auth: undefined }),
                ),
                OPTS,
            ),
        Error,
        "auth.inject must resolve",
    );
});

Deno.test("leaf-wise fallback: endpoint hook REPLACES provider's; baseUrl/meta fall back", async () => {
    const bundle = await compileBundle(
        source(
            [{
                name: "search",
                def: makeEndpoint({
                    meta: { displayName: "S", summary: "s." }, // no docsUrl/categories
                    request: {
                        method: "POST",
                        path: "/search",
                        baseUrl: "https://override.test",
                    },
                    input: {
                        schema: { body: z.object({ q: z.string() }) },
                        toRequest: ({ data }) => ({
                            ...data.input,
                            body: { endpoint: true },
                        }),
                    },
                }),
            }],
            makeProvider({
                meta: {
                    displayName: "Demo",
                    summary: "A demo provider.",
                    docsUrl: "https://demo.test/docs",
                    categories: ["demo-cat"],
                },
                input: { toRequest: ({ data }) => data.input },
            }),
        ),
        OPTS,
    );
    const doc = bundle.endpoints["demo#search"];
    // hook: SINGLE ref — the endpoint's fn, not the provider's (fallback, not chain)
    assert(doc.input.toRequest);
    const src = bundle.fnTable[doc.input.toRequest.$fn.key].src;
    assert(src.includes("endpoint:true"), "endpoint hook won the fallback");
    // data: endpoint baseUrl overrides the provider default
    assertEquals(doc.request.url, "https://override.test/search");
    // meta leaves fall back to the provider
    assertEquals(doc.meta.docsUrl, "https://demo.test/docs");
    assertEquals(doc.meta.categories, ["demo-cat"]);
});

Deno.test("meta.notes CONCATENATE provider-then-endpoint (the one additive leaf)", async () => {
    const bundle = await compileBundle(
        source(
            [{
                name: "search",
                def: makeEndpoint({
                    meta: {
                        displayName: "S",
                        summary: "s.",
                        notes: ["endpoint caveat"],
                    },
                }),
            }, {
                name: "other",
                def: makeEndpoint({
                    meta: { displayName: "O", summary: "o." }, // no notes
                    request: { method: "POST", path: "/other" },
                }),
            }],
            makeProvider({
                meta: {
                    displayName: "Demo",
                    summary: "A demo provider.",
                    notes: ["provider caveat 1", "provider caveat 2"],
                },
            }),
        ),
        OPTS,
    );
    // additive, NOT closest-wins: both levels survive, general before specific
    assertEquals(bundle.endpoints["demo#search"].meta.notes, [
        "provider caveat 1",
        "provider caveat 2",
        "endpoint caveat",
    ]);
    // provider notes reach an endpoint that declares none
    assertEquals(bundle.endpoints["demo#other"].meta.notes, [
        "provider caveat 1",
        "provider caveat 2",
    ]);
    // the provider doc keeps its own
    assertEquals(bundle.providers["demo"].meta.notes, [
        "provider caveat 1",
        "provider caveat 2",
    ]);
});

Deno.test("meta.notes: endpoint-only, and absent everywhere leaves NO key", async () => {
    const bundle = await compileBundle(
        source(
            [{
                name: "search",
                def: makeEndpoint({
                    meta: {
                        displayName: "S",
                        summary: "s.",
                        notes: ["only the endpoint speaks"],
                    },
                }),
            }, {
                name: "other",
                def: makeEndpoint({
                    meta: { displayName: "O", summary: "o." },
                    request: { method: "POST", path: "/other" },
                }),
            }],
            makeProvider(), // no provider notes
        ),
        OPTS,
    );
    assertEquals(bundle.endpoints["demo#search"].meta.notes, [
        "only the endpoint speaks",
    ]);
    // empty concatenation ⇒ key OMITTED (determinism: note-less docs stay
    // byte-identical to docs compiled before this capability existed)
    assert(
        !("notes" in bundle.endpoints["demo#other"].meta),
        "no notes anywhere ⇒ no notes key",
    );
});

Deno.test("meta.notes rejects empty entries and an empty array", () => {
    let threw = 0;
    try {
        makeEndpoint({
            meta: { displayName: "S", summary: "s.", notes: [""] },
        });
    } catch {
        threw++;
    }
    try {
        makeEndpoint({ meta: { displayName: "S", summary: "s.", notes: [] } });
    } catch {
        threw++;
    }
    assertEquals(threw, 2, "an empty note and an empty list both reject");
});

Deno.test("credentials fallback: endpoint overriding only inject inherits the PROVIDER's shape", async () => {
    // Pins the no-.default() rule (design D20): if zAuthSection.credentials
    // used .default(zDefaultCredentials), the endpoint's parsed auth would
    // materialize the default and SHADOW the provider's explicit schema.
    const bundle = await compileBundle(
        source(
            [{
                name: "search",
                def: makeEndpoint({
                    auth: { inject: presets.auth.bearer() }, // no credentials declared
                }),
            }],
            makeProvider({
                auth: {
                    inject: presets.auth.header("x-demo-key"),
                    credentials: z.object({
                        apiKey: z.string().min(1),
                        orgId: z.string().min(1),
                    }),
                },
            }),
        ),
        OPTS,
    );
    const doc = bundle.endpoints["demo#search"];
    // endpoint's inject won the fallback…
    assertEquals(
        bundle.fnTable[doc.auth.inject.$fn.key].provenance,
        "presets#auth.bearer",
    );
    // …but credentials fell back to the provider's EXPLICIT shape, not the default
    assertEquals(
        Object.keys(doc.auth.credentials.properties as Record<string, unknown>)
            .sort(),
        [
            "apiKey",
            "orgId",
        ],
    );
});

Deno.test("{pathParam} placeholders survive url normalization (not percent-encoded)", async () => {
    // new URL(...).toString() encodes braces to %7B/%7D — the engine's
    // substituteUrl matches literal `{name}` (fundable's /deals/{id}
    // exposed this)
    const bundle = await compileBundle(
        source(
            [{
                name: "deal",
                def: makeEndpoint({
                    endpoint: "/deal/investors",
                    request: { method: "GET", path: "/deals/{id}/investors" },
                }),
            }],
            makeProvider({ request: { baseUrl: "https://api.demo.test/v1" } }),
        ),
        OPTS,
    );
    assertEquals(
        bundle.endpoints["demo#deal/investors"].request.url,
        "https://api.demo.test/v1/deals/{id}/investors",
    );
});

Deno.test("baseUrl path prefixes survive resolution (concatenation, not URL-resolve)", async () => {
    // new URL("/v1/x", "https://h/api") would DROP /api — the compiler must
    // concatenate (akta's baseUrl exposed this)
    const bundle = await compileBundle(
        source(
            [{
                name: "search",
                def: makeEndpoint({
                    request: { method: "GET", path: "/v1/search" },
                }),
            }],
            makeProvider({ request: { baseUrl: "https://api.demo.test/api" } }),
        ),
        OPTS,
    );
    assertEquals(
        bundle.endpoints["demo#v1/search"].request.url,
        "https://api.demo.test/api/v1/search",
    );
});

Deno.test("baseUrl with a query string or fragment fails compilation", async () => {
    // concatenation would place the endpoint path INSIDE the query/fragment
    // (`…?tenant=x` + `/v1/search` ⇒ `…?tenant=x/v1/search`) — reject instead
    for (
        const baseUrl of [
            "https://h.test/api?tenant=x",
            "https://h.test/api#frag",
        ]
    ) {
        await assertRejects(
            () =>
                compileBundle(
                    source(
                        [{
                            name: "search",
                            def: makeEndpoint({
                                request: { method: "GET", path: "/v1/search" },
                            }),
                        }],
                        makeProvider({ request: { baseUrl } }),
                    ),
                    OPTS,
                ),
            Error,
            "must not contain a query string or fragment",
        );
    }
});

Deno.test("no baseUrl anywhere fails compilation", async () => {
    await assertRejects(
        () =>
            compileBundle(
                source(
                    [{ name: "search", def: makeEndpoint() }],
                    makeProvider({ request: {} }),
                ),
                OPTS,
            ),
        Error,
        "no baseUrl",
    );
});

Deno.test("unknown category fails compilation (closed vocabulary)", async () => {
    await assertRejects(
        () =>
            compileBundle(
                source([{
                    name: "search",
                    def: makeEndpoint({
                        meta: {
                            displayName: "D",
                            summary: "s",
                            categories: ["not-registered"],
                        },
                    }),
                }]),
                OPTS,
            ),
        Error,
        "unknown category",
    );
});

Deno.test("compile is deterministic (double compile, byte-identical)", async () => {
    const make = () =>
        compileBundle(source([{ name: "search", def: makeEndpoint() }]), OPTS);
    const [one, two] = [await make(), await make()];
    assertEquals(
        stableStringify(JSON.parse(JSON.stringify(one))),
        stableStringify(JSON.parse(JSON.stringify(two))),
    );
});

Deno.test("closure-captured fn fails compilation", async () => {
    const captured = { drop: ["oops"] };
    await assertRejects(
        () =>
            compileBundle(
                source([{
                    name: "search",
                    def: makeEndpoint({
                        output: {
                            fromResponse: ({ data, utils }) =>
                                utils.json.omit(data.output, captured.drop),
                        },
                    }),
                }]),
                OPTS,
            ),
        Error,
        "closed term",
    );
});

Deno.test("invalid provider def fails intake (uniform parseSchema error)", async () => {
    await assertRejects(
        () =>
            compileBundle(
                [{ provider: { nope: true } as never, endpoints: [] }],
                OPTS,
            ),
        Error,
        "provider def",
    );
});

// ---------------------------------------------------------------------------
// catalog readers (pure fns over the bundle — live in @shared/core)
// ---------------------------------------------------------------------------

Deno.test("catalog: listProviders / listEndpoints / listCategories / inspectEndpoint", async () => {
    const bundle = await compileBundle(
        source([{ name: "search", def: makeEndpoint() }]),
        OPTS,
    );
    assertEquals(listProviders(bundle), [{
        name: "demo",
        displayName: "Demo",
        summary: "A demo provider.",
        endpointCount: 1,
    }]);
    assertEquals(listEndpoints(bundle, { provider: "demo" }).map((e) => e.id), [
        "demo#search",
    ]);
    assertEquals(
        listEndpoints(bundle, { category: "demo-cat" }).map((e) => e.id),
        [
            "demo#search",
        ],
    );
    assertEquals(listEndpoints(bundle, { category: "web-search" }), []);
    const categories = listCategories(bundle);
    assertEquals(categories.find((c) => c.id === "demo-cat")?.endpointCount, 1);
    assertEquals(
        categories.find((c) => c.id === "web-search")?.endpointCount,
        0,
    );
    // inspect returns the doc ITSELF — it is the contract
    const inspection = inspectEndpoint(bundle, "demo#search");
    assertEquals(inspection, bundle.endpoints["demo#search"]);
    assert(inspection.input.schema.body?.properties, "body schema surfaced");
    assert(inspection.auth.credentials.properties, "credential shape surfaced");
});

Deno.test("lookup happens in the BUNDLE: sealUnit errors on unknown ids", async () => {
    // compile-everything model: there is no filtered loading — unknown
    // provider/endpoint surfaces at bundle-lookup time, not load time
    const bundle = await compileBundle(
        source([{ name: "search", def: makeEndpoint() }]),
        OPTS,
    );
    assertThrows(
        () => sealUnit(bundle, "demo#nope"),
        Error,
        "endpoint not in bundle",
    );
    assertThrows(
        () => sealUnit(bundle, "ghost#search"),
        Error,
        "endpoint not in bundle",
    );
});

// ---------------------------------------------------------------------------
// golden: the real exa connector, via the real tree loader
// ---------------------------------------------------------------------------

Deno.test("golden: compiled exa#search doc shape (zBundle round-trip)", async () => {
    const connectorsDir = join(REPO_ROOT, "connectors");
    const [connectors, leafCategories] = await Promise.all([
        loadConnectorDefs(connectorsDir),
        loadCategoryRegistry(connectorsDir),
    ]);
    const bundle = await compileBundle(connectors, { ...OPTS, leafCategories });

    // everything compiled validates against the bundle schema — via JSON round-trip
    const reparsed = zBundle.parse(JSON.parse(JSON.stringify(bundle)));
    assertEquals(
        stableStringify(JSON.parse(JSON.stringify(reparsed))),
        stableStringify(JSON.parse(JSON.stringify(bundle))),
    );

    const doc = bundle.endpoints["exa#search"];
    assert(doc, "exa#search compiled");
    assertEquals(doc.provider, "exa");
    // semverMax(doc_format_since, every fn's api) — read from the config
    // constants rather than a literal, so a format or ABI bump updates this
    // test's expectation instead of its meaning. fn_abi_since leads today
    // (the wire query became a multimap); doc_format_since led before it.
    const { docFormatSince, fnAbiSince } = contractConfig.schema;
    assertEquals(
        doc.minEngineVersion,
        greaterThan(parse(fnAbiSince), parse(docFormatSince))
            ? fnAbiSince
            : docFormatSince,
    );
    assertEquals(doc.request, {
        method: "POST",
        url: "https://api.exa.ai/search",
    });
    assertEquals(doc.auth.credentials, {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: { apiKey: { type: "string", minLength: 1 } },
        required: ["apiKey"],
    });
    assert(doc.input.schema.body?.properties, "input body schema compiled");
    // stream is NOT exposed to callers
    assert(
        !("stream" in
            (doc.input.schema.body.properties as Record<string, unknown>)),
        "stream must not appear in the compiled input schema",
    );
    assert(doc.input.toRequest?.$fn.key.startsWith("sha256:"));
    assertEquals(doc.output.fromResponse, undefined);
    // the quantities pair (D27) + the credit declaration (D26): both
    // compiled, and the provider's pool resolved onto the doc; the
    // vendor-meter consolidate resolved from the PROVIDER
    assert(doc.usage.estimate.$fn.key.startsWith("sha256:"));
    assert(doc.usage.evidence.$fn.key.startsWith("sha256:"));
    assert(doc.usage.consolidate?.$fn.key.startsWith("sha256:"));
    assertEquals(
        bundle.fnTable[doc.usage.consolidate!.$fn.key].provenance,
        "connectors/exa/provider.ts#usage.consolidate",
    );
    assertEquals(doc.usage.credits, { default: { label: "US dollars" } });
    assertEquals(doc.timeouts, { requestMs: 30_000, runMs: 30_000 });
    // meta roles: one-line summary + full description
    assert(doc.meta.summary.length < 200);
    assert((doc.meta.description ?? "").includes("search types"));

    // preset entries are factory entries with presets provenance; ad-hoc fns stay "fn"
    const authEntry = bundle.fnTable[doc.auth.inject.$fn.key];
    assertEquals(authEntry.kind, "factory");
    assertEquals(authEntry.provenance, "presets#auth.header");
    assertEquals(bundle.fnTable[doc.usage.evidence.$fn.key].kind, "fn");
    // every entry declares its ABI floor (schema.fn_abi_since)
    assertEquals(authEntry.api, "0.1.0");

    // interning across endpoints: contents shares the provider auth fn
    // AND the provider's ONE vendor-meter consolidate (design D27); the
    // quantities fns stay doc-owned (offset counting vs per-page), so
    // each evidence keeps its own entry
    const contents = bundle.endpoints["exa#contents"];
    assertEquals(
        contents.usage.consolidate?.$fn.key,
        doc.usage.consolidate?.$fn.key,
    );
    assert(contents.usage.evidence.$fn.key !== doc.usage.evidence.$fn.key);
    assertEquals(contents.auth.inject.$fn.key, doc.auth.inject.$fn.key);

    // taxonomy membership from the real registry (whole-repo compile —
    // other connectors share these leaves, so assert inclusion, not equality)
    assert(bundle.taxonomy.membership["web-search"].includes("exa#search"));
    assert(bundle.taxonomy.membership["web-scraping"].includes("exa#contents"));
});
