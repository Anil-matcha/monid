import { assert, assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json, RunInput } from "@shared/core";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testBundle,
    testSealedUnit,
} from "@shared/testing";
import { directTransport, Engine } from "@monid/connector-engine";

/**
 * THE surf suite (design D2): 105 docs of ONE billing shape — a flat
 * PER_CALL line at the published tier — so the tests live once here and
 * iterate the catalog, while every endpoint keeps its OWN recorded-shape
 * fixtures under `endpoints/<family>/<path>/fixtures/` (replay matches on
 * the exact wire URL, so a shared chain cannot serve query-bearing GETs;
 * `deno task record` writes there too). One representative per family
 * carries the empty and unauthorized scenarios; the SQL job carries its
 * six chains.
 *
 * Surf declares NO `usage.consolidate` (design D1): `meta.credits_used`
 * is not the amount charged, so the DERIVED fold is the settled answer on
 * every run and no `mismatch` key can appear (zUsage is strict;
 * deep-equality proves its absence). The tier table below is therefore the
 * only thing standing between a typo and a wrong bill.
 */

const HERE = fromFileUrl(new URL("./", import.meta.url));
const INPUTS = JSON.parse(
    await Deno.readTextFile(`${HERE}test-inputs.json`),
) as Record<string, RunInput>;

const SQL_JOB = "surf#onchain/sql/jobs";

const inputFor = (id: string): RunInput => {
    const input = INPUTS[id.split("#")[1]];
    assert(input !== undefined, `${id}: no test input in test-inputs.json`);
    return input;
};

/** Fixture dir: `endpoints/<family>/<wire path, slashes as dashes>/fixtures/`
 *  (design D11 — the loader wants leaf names unique across groups). */
const fixtureFor = (id: string, name: string) => {
    const path = id.split("#")[1];
    const family = path.split("/")[0];
    return loadFixture(
        `${HERE}endpoints/${family}/${
            path.replaceAll("/", "-")
        }/fixtures/${name}.json`,
    );
};

const surfIds = async (): Promise<string[]> => {
    const bundle = await testBundle();
    return Object.keys(bundle.endpoints)
        .filter((id) => id.startsWith("surf#"))
        .sort();
};

/** Bad input: the same valid input with one unknown key in the channel
 *  the endpoint reads — `.strict()` compiles to additionalProperties:false. */
const withUnknownKey = (input: RunInput): RunInput =>
    input.body !== undefined
        ? {
            ...input,
            body: {
                ...(input.body as Record<string, Json>),
                not_a_surf_field: 1,
            },
        }
        : {
            ...input,
            queryParams: { ...input.queryParams, not_a_surf_param: "1" },
        };

/** Validate-only run: the estimate derives the input without IO, so a
 *  rejecting transport proves whether an input passes the compiled gate. */
const validates = async (id: string, input: RunInput) => {
    const engine = new Engine({
        transport: directTransport({
            params: () => Promise.resolve({ apiKey: "test-key" }),
            fetch: () => Promise.reject(new Error("estimate must not IO")),
        }),
    });
    const loaded = await engine.load(await testSealedUnit(id));
    return await loaded.estimate(input);
};

/**
 * Surf's PUBLISHED TIER per endpoint — Light 1 / Standard 2 / Heavy 4
 * credits — as v1 authored it (`surfCredits(n)`), verified by the 2026-08
 * balance-differencing drills (13 endpoints measured, thirteen for
 * thirteen on the tier table).
 *
 * Written as LITERALS on purpose (clay D7a). Deriving them from each doc's
 * own model would make this test a tautology — the engine folds credits
 * FROM the model, so an edited `consumes.amount` would move both sides and
 * pass. A new endpoint must state its tier here.
 */
const TIER: Record<string, number> = {
    "surf#dex/token/price": 1,
    "surf#exchange/candles": 1,
    "surf#exchange/coverage": 1,
    "surf#exchange/depth": 1,
    "surf#exchange/funding-history": 1,
    "surf#exchange/klines": 1,
    "surf#exchange/long-short-ratio": 1,
    "surf#exchange/markets": 1,
    "surf#exchange/perp": 1,
    "surf#exchange/price": 1,
    "surf#fund/detail": 1,
    "surf#fund/portfolio": 1,
    "surf#fund/ranking": 1,
    "surf#market/etf": 2,
    "surf#market/exchange-flow/exchanges": 2,
    "surf#market/fear-greed": 2,
    "surf#market/futures": 2,
    "surf#market/liquidation/chart": 2,
    "surf#market/liquidation/exchange-list": 2,
    "surf#market/liquidation/order": 2,
    "surf#market/listing": 2,
    "surf#market/onchain-indicator": 2,
    "surf#market/options": 2,
    "surf#market/price": 2,
    "surf#market/price-indicator": 2,
    "surf#market/public-sale": 2,
    "surf#market/ranking": 2,
    "surf#market/tge": 2,
    "surf#news/detail": 1,
    "surf#news/feed": 1,
    "surf#onchain/bridge/ranking": 2,
    "surf#onchain/dex/activity": 2,
    "surf#onchain/gas-price": 2,
    "surf#onchain/query": 4,
    "surf#onchain/schema": 4,
    "surf#onchain/sql": 4,
    "surf#onchain/sql/jobs": 4,
    "surf#onchain/sql/preflight": 4,
    "surf#onchain/tx": 2,
    "surf#onchain/yield/ranking": 2,
    "surf#project/ai-news": 2,
    "surf#project/defi/metrics": 2,
    "surf#project/defi/ranking": 2,
    "surf#project/detail": 2,
    "surf#search/airdrop": 1,
    "surf#search/airdrop/activities": 1,
    "surf#search/events": 1,
    "surf#search/fund": 1,
    "surf#search/fundraising": 1,
    "surf#search/news": 1,
    "surf#search/prediction-market": 4,
    "surf#search/project": 1,
    "surf#search/token": 1,
    "surf#search/wallet": 4,
    "surf#search/web": 1,
    "surf#token/dex-trades": 4,
    "surf#token/holders": 2,
    "surf#token/tokenomics": 2,
    "surf#token/transfer-counterparties": 2,
    "surf#token/transfer-stats": 2,
    "surf#token/transfers": 2,
    "surf#wallet/detail": 2,
    "surf#wallet/history": 2,
    "surf#wallet/labels/batch": 2,
    "surf#wallet/net-worth": 2,
    "surf#wallet/protocols": 2,
    "surf#wallet/transfers": 2,
    "surf#web/fetch": 1,
};

/** The first endpoint of each family carries the empty + unauthorized
 *  fixtures (the flat fold and the error digest are the same code path on
 *  every doc; the URL match is proven per endpoint by the happy run). */
const FAMILY_REPRESENTATIVES = [
    "surf#web/fetch",
    "surf#search/airdrop",
    "surf#market/etf",
    "surf#news/detail",
    "surf#fund/detail",
    "surf#token/dex-trades",
    "surf#exchange/candles",
    "surf#wallet/detail",
    "surf#project/ai-news",
    "surf#onchain/bridge/ranking",
    "surf#dex/token/price",
] as const;

// ---------------------------------------------------------------------------
// the catalog
// ---------------------------------------------------------------------------

Deno.test("surf docs: every endpoint is in the tier table", async () => {
    const ids = await surfIds();
    assertEquals(ids.length, 68);
    // a new endpoint must state its tier
    assertEquals(Object.keys(TIER).sort(), ids);
    // 25 Light, 35 Standard, 8 Heavy — v1's split
    const byTier = ids.reduce<Record<number, number>>((acc, id) => {
        acc[TIER[id]] = (acc[TIER[id]] ?? 0) + 1;
        return acc;
    }, {});
    assertEquals(byTier, { 1: 25, 2: 35, 4: 8 });
});

Deno.test("surf docs: one auth, one error digest, no consolidate, synthesized quantities, one lifecycle", async () => {
    const bundle = await testBundle();
    const ids = await surfIds();
    const first = bundle.endpoints[ids[0]];
    for (const id of ids) {
        const doc = bundle.endpoints[id];
        assertEquals(doc.auth.inject.$fn.key, first.auth.inject.$fn.key, id);
        assertEquals(
            doc.output.fromError?.$fn.key,
            first.output.fromError?.$fn.key,
            id,
        );
        assert(doc.output.fromError, `${id}: the error digest must run`);
        assertEquals(doc.output.fromResponse, undefined, id);
        // no vendor claim anywhere (design D1)
        assertEquals(doc.usage.consolidate, undefined, id);
        // flat PER_CALL at the pinned tier
        assertEquals(doc.usage.model, {
            kind: "PER_CALL",
            label: "call",
            consumes: { credit: "default", amount: TIER[id] },
        }, id);
        assertEquals(
            doc.usage.credits,
            { default: { label: "Surf credits" } },
            id,
        );
        // the compiler synthesizes the one lawful empty fn for both
        assertEquals(
            bundle.fnTable[doc.usage.estimate.$fn.key].provenance,
            "core#usage.synthesizedEmpty",
            id,
        );
        assertEquals(
            bundle.fnTable[doc.usage.evidence.$fn.key].provenance,
            "core#usage.synthesizedEmpty",
            id,
        );
        if (id === SQL_JOB) {
            assert(
                doc.lifecycle?.start && doc.lifecycle.poll &&
                    doc.lifecycle.stop,
            );
            assertEquals(doc.timeouts, {
                requestMs: 60_000,
                runMs: 300_000,
                pollMs: 3_000,
            });
        } else {
            assertEquals(doc.lifecycle, undefined, id);
            assertEquals(
                doc.timeouts,
                id === "surf#onchain/sql"
                    ? { requestMs: 45_000, runMs: 45_000 }
                    : { requestMs: 60_000, runMs: 60_000 },
                id,
            );
        }
    }
    // the version segment rides the base URL
    assertEquals(
        bundle.endpoints["surf#market/price"].request.url,
        "https://api.asksurf.ai/gateway/v1/market/price",
    );
});

Deno.test("surf meta: the credits_used caveat rides every doc; identifier rules ride notes", async () => {
    const bundle = await testBundle();
    for (const id of await surfIds()) {
        const notes = (bundle.endpoints[id].meta.notes ?? []).join(" ");
        assert(
            notes.includes("meta.credits_used") && notes.includes("NOT"),
            `${id}: the provider's billing caveat must reach the doc`,
        );
    }
    const notesOf = (id: string) =>
        (bundle.endpoints[id].meta.notes ?? []).join(" ");
    // v1's `.refine + .meta(anyOf)` (at least one) and `.meta(oneOf)`
    // (exactly one) — the arms compile to anyOf, the exclusivity is a note
    assert(notesOf("surf#fund/detail").includes("at least one of `id` or `q`"));
    assert(
        notesOf("surf#onchain/dex/activity").includes(
            "exactly one of `project` or `address`",
        ),
    );
    assert(!notesOf("surf#news/feed").includes("Pass"), "no rule, no note");
});

Deno.test("surf schemas: vendor defaults ride the binding; a union arm carries none", async () => {
    const bundle = await testBundle();
    const feed = bundle.endpoints["surf#news/feed"].input.schema
        .queryParams as {
            properties: Record<
                string,
                { default?: Json; description?: string }
            >;
            additionalProperties?: boolean;
        };
    assertEquals(feed.properties.limit.default, 20);
    assertEquals(feed.properties.sort_by.default, "recency");
    assertEquals(feed.properties.offset.default, 0);
    assertEquals(feed.additionalProperties, false);
    // a describe hung inside `.optional()` survives the `.unwrap()` binding
    assert(feed.properties.limit.description?.includes("max 50"));
    // the live-OpenAPI corrections (design D12) landed at the binding
    const markets = bundle.endpoints["surf#exchange/markets"].input.schema
        .queryParams as {
            properties: Record<string, { default?: Json; enum?: string[] }>;
        };
    assertEquals(markets.properties.exchange.default, "binance");
    assertEquals(markets.properties.exchange.enum?.length, 17);
    const sql = bundle.endpoints["surf#onchain/sql"].input.schema.body as {
        properties: Record<string, { default?: Json }>;
    };
    assertEquals(sql.properties.max_rows.default, 1000);
    const detail = bundle.endpoints["surf#fund/detail"].input.schema
        .queryParams as {
            anyOf: {
                required: string[];
                additionalProperties: boolean;
                properties: Record<string, { default?: Json }>;
            }[];
        };
    assertEquals(detail.anyOf.map((arm) => arm.required), [["id"], ["q"]]);
    for (const arm of detail.anyOf) {
        assertEquals(arm.additionalProperties, false);
        // ajv never applies defaults inside anyOf (design D4) — none authored
        for (const [name, prop] of Object.entries(arm.properties)) {
            assertEquals(prop.default, undefined, name);
        }
    }
});

// ---------------------------------------------------------------------------
// the 104 synchronous relays
// ---------------------------------------------------------------------------

Deno.test("surf: every relay settles its published tier on a 2xx and relays meta.credits_used", async () => {
    for (const id of await surfIds()) {
        if (id === SQL_JOB) continue;
        const result = await runEndpoint({
            unit: await testSealedUnit(id),
            input: inputFor(id),
            mode: "replay",
            fixture: await fixtureFor(id, "synthetic-happy"),
        });
        assertEquals(result.httpStatus, 200, id);
        assertEquals(result.isProviderError, false, id);
        // flat model: the engine appends the reserved CALL line and folds
        // 1 × tier. Response size never moves the bill (v1 sweep).
        assertEquals(result.usage, {
            credits: { default: TIER[id] },
            evidence: { CALL: 1 },
        }, id);
        // the vendor's own meter stays in the body, verbatim (design D1)
        const output = result.output as { meta?: { credits_used?: number } };
        assertEquals(output.meta?.credits_used, TIER[id], id);
    }
});

Deno.test("surf: an empty result still draws the tier", async () => {
    for (const id of FAMILY_REPRESENTATIVES) {
        const result = await runEndpoint({
            unit: await testSealedUnit(id),
            input: inputFor(id),
            mode: "replay",
            fixture: await fixtureFor(id, "synthetic-empty"),
        });
        assertEquals(result.httpStatus, 200, id);
        assertEquals(result.usage, {
            credits: { default: TIER[id] },
            evidence: { CALL: 1 },
        }, id);
        assertEquals((result.output as { data: Json[] }).data, [], id);
    }
});

Deno.test("surf: a 401 is data — zero usage, the error envelope digested", async () => {
    for (const id of FAMILY_REPRESENTATIVES) {
        const result = await runEndpoint({
            unit: await testSealedUnit(id),
            input: inputFor(id),
            mode: "replay",
            fixture: await fixtureFor(id, "synthetic-unauthorized"),
        });
        assertEquals(result.httpStatus, 401, id);
        assertEquals(result.isProviderError, true, id);
        assertEquals(result.usage, { credits: {}, evidence: {} }, id);
        const output = result.output as Record<string, unknown>;
        assertEquals(output.message, "Invalid or missing API key", id);
        assertEquals(output.code, "UNAUTHORIZED", id);
        assert(output.raw !== undefined, `${id}: the raw body is kept`);
    }
});

Deno.test("surf: every input schema is strict — an unknown key never reaches the wire", async () => {
    for (const id of await surfIds()) {
        await assertRejects(
            () => validates(id, withUnknownKey(inputFor(id))),
            Error,
            "INVALID_INPUT",
        );
    }
});

Deno.test("surf schema gates: enum, pattern, url and the identifier alternatives", async () => {
    // enum: a source outside the vendor's list
    await assertRejects(
        () =>
            validates("surf#news/feed", {
                queryParams: { source: "not-a-source" },
            }),
        Error,
        "INVALID_INPUT",
    );
    await validates("surf#news/feed", { queryParams: { source: "coindesk" } });
    // pattern: the table must be database-qualified as agent.<table>
    await assertRejects(
        () =>
            validates("surf#onchain/query", {
                body: { source: "ethereum_dex_trades" },
            }),
        Error,
        "INVALID_INPUT",
    );
    await validates("surf#onchain/query", {
        body: { source: "agent.ethereum_dex_trades" },
    });
    // url: format uri is enforced (ajv-formats)
    await assertRejects(
        () => validates("surf#web/fetch", { queryParams: { url: "ethereum" } }),
        Error,
        "INVALID_INPUT",
    );
    // at least one of id | q: neither is rejected, either alone passes
    await assertRejects(
        () => validates("surf#fund/detail", { queryParams: {} }),
        Error,
        "INVALID_INPUT",
    );
    await validates("surf#fund/detail", { queryParams: { q: "a16z" } });
    await validates("surf#fund/detail", {
        queryParams: { id: "ef3b6da9-283d-4080-b3c7-87b1b45924dc" },
    });
    // exactly one of project | address: neither is rejected before the
    // wire; both together is the vendor's 400 (a note, not a gate)
    await assertRejects(
        () =>
            validates("surf#onchain/dex/activity", {
                queryParams: { chain: "ethereum" },
            }),
        Error,
        "INVALID_INPUT",
    );
    await validates("surf#onchain/dex/activity", {
        queryParams: { chain: "ethereum", address: "0x" + "ab".repeat(20) },
    });
});

// ---------------------------------------------------------------------------
// the SQL job (design D3)
// ---------------------------------------------------------------------------

Deno.test(`${SQL_JOB}: submit, poll to succeeded, the results read is the output, 4 credits`, async () => {
    const result = await runEndpoint({
        unit: await testSealedUnit(SQL_JOB),
        input: inputFor(SQL_JOB),
        mode: "replay",
        fixture: await fixtureFor(SQL_JOB, "synthetic-job-succeeded"),
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    // the submit tier; polls and the results read are free (v1 measured)
    assertEquals(result.usage, {
        credits: { default: 4 },
        evidence: { CALL: 1 },
    });
    const output = result.output as {
        data: { rows: Json[]; row_count: number };
    };
    assertEquals(output.data.row_count, 2);
    assertEquals(output.data.rows.length, 2);
});

Deno.test(`${SQL_JOB}: a failed job is a synthesized 500 carrying the job's own error, zero usage`, async () => {
    const result = await runEndpoint({
        unit: await testSealedUnit(SQL_JOB),
        input: inputFor(SQL_JOB),
        mode: "replay",
        fixture: await fixtureFor(SQL_JOB, "synthetic-job-failed"),
    });
    // OURS 500 (the JOB failed) / THEIRS 200 (the poll exchange was fine)
    assertEquals(result.httpStatus, 500);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    const output = result.output as Record<string, unknown>;
    // fromError digested the job's {code, message} error
    assertEquals(output.message, "Query exceeded the execution budget");
    assertEquals(output.code, "QUERY_TIMEOUT");
    assertEquals((output.raw as { status: string }).status, "failed");
});

Deno.test(`${SQL_JOB}: a rejected submit never starts a job — data, zero usage`, async () => {
    const result = await runEndpoint({
        unit: await testSealedUnit(SQL_JOB),
        input: inputFor(SQL_JOB),
        mode: "replay",
        fixture: await fixtureFor(SQL_JOB, "synthetic-submit-rejected"),
    });
    assertEquals(result.httpStatus, 429);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals((result.output as { code: string }).code, "QUEUE_FULL");
});

Deno.test(`${SQL_JOB}: a non-2xx poll settles as data — the job can no longer be observed`, async () => {
    const result = await runEndpoint({
        unit: await testSealedUnit(SQL_JOB),
        input: inputFor(SQL_JOB),
        mode: "replay",
        fixture: await fixtureFor(SQL_JOB, "synthetic-poll-error"),
    });
    assertEquals(result.httpStatus, 404);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals((result.output as { code: string }).code, "NOT_FOUND");
});

Deno.test(`${SQL_JOB}: a 2xx submit without a job_id is a contract violation, not a billed success`, async () => {
    await assertRejects(
        async () =>
            await runEndpoint({
                unit: await testSealedUnit(SQL_JOB),
                input: inputFor(SQL_JOB),
                mode: "replay",
                fixture: await fixtureFor(SQL_JOB, "synthetic-submit-no-id"),
            }),
        Error,
        "SQL job id",
    );
});

Deno.test(`${SQL_JOB}: a succeeded job whose results cannot be read fails the run`, async () => {
    await assertRejects(
        async () =>
            await runEndpoint({
                unit: await testSealedUnit(SQL_JOB),
                input: inputFor(SQL_JOB),
                mode: "replay",
                fixture: await fixtureFor(SQL_JOB, "synthetic-results-error"),
            }),
        Error,
        "results fetch returned 500",
    );
});

// ---------------------------------------------------------------------------
// live (gated)
// ---------------------------------------------------------------------------

Deno.test({
    name:
        "surf#market/price live (gated on SURF_API_KEY) — the envelope shape and the Standard tier",
    ignore: liveSkip("surf"),
    fn: async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit("surf#market/price"),
            input: inputFor("surf#market/price"),
            mode: "live",
        });
        assertEquals(result.isProviderError, false);
        const output = result.output as { data?: unknown; meta?: unknown };
        assert(output.data !== undefined, "the `data` envelope");
        assert(output.meta !== undefined, "the `meta` envelope");
        // the derived fold at the published tier; no claim exists to differ
        assertEquals(result.usage, {
            credits: { default: 2 },
            evidence: { CALL: 1 },
        });
    },
});
