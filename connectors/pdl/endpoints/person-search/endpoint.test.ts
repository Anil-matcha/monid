import { assertEquals, assertRejects } from "@std/assert";
import type { Json } from "@shared/core";
import { fromFileUrl } from "@std/path";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testBundle,
    testSealedUnit,
} from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));

Deno.test("pdl: usage fn provenance — one evidence + one auth fn for all 4; searches own one estimate, enrichments synthesized; one pool per credit type", async () => {
    const bundle = await testBundle();
    const ids = Object.keys(bundle.endpoints).filter((id) =>
        id.startsWith("pdl#")
    ).sort();
    assertEquals(ids, [
        "pdl#v5/company/enrich",
        "pdl#v5/company/search",
        "pdl#v5/person/enrich",
        "pdl#v5/person/search",
    ]);
    const first = bundle.endpoints[ids[0]];
    for (const id of ids) {
        const doc = bundle.endpoints[id];
        assertEquals(
            doc.usage.evidence.$fn.key,
            first.usage.evidence.$fn.key,
            id,
        );
        assertEquals(doc.auth.inject.$fn.key, first.auth.inject.$fn.key, id);
        // PDL reports its meter only in response headers — no claim fn,
        // nothing to strip
        assertEquals(doc.usage.consolidate, undefined, id);
        assertEquals(doc.input.toRequest, undefined, id);
        assertEquals(doc.output.fromResponse, undefined, id);
    }
    // the two searches intern ONE size-reading estimate; the two flat
    // enrichments get the compiler-synthesized `() => ({counts: {}})`
    const searchKey =
        bundle.endpoints["pdl#v5/person/search"].usage.estimate.$fn.key;
    assertEquals(
        bundle.endpoints["pdl#v5/company/search"].usage.estimate.$fn.key,
        searchKey,
    );
    const synthesizedKey =
        bundle.endpoints["pdl#v5/person/enrich"].usage.estimate.$fn.key;
    assertEquals(
        bundle.endpoints["pdl#v5/company/enrich"].usage.estimate.$fn.key,
        synthesizedKey,
    );
    assertEquals(
        bundle.fnTable[synthesizedKey].provenance,
        "core#usage.synthesizedEmpty",
    );
    // one pool per PDL credit TYPE (`x-call-credits-type`): the PROVIDER
    // declares all four, and each doc compiles down to exactly the one
    // its own lines drain (design D6c)
    const drains = {
        "pdl#v5/person/enrich": "people_enrich",
        "pdl#v5/person/search": "people_search",
        "pdl#v5/company/enrich": "company_enrich",
        "pdl#v5/company/search": "company_search",
    };
    for (const [id, pool] of Object.entries(drains)) {
        const doc = bundle.endpoints[id];
        assertEquals(Object.keys(doc.usage.credits), [pool], id);
        const model = doc.usage.model;
        assertEquals(
            "consumes" in model ? model.consumes.credit : undefined,
            pool,
            id,
        );
    }
    // the SDK's wire form: enrichment GET, search POST
    assertEquals(
        bundle.endpoints["pdl#v5/person/enrich"].request.method,
        "GET",
    );
    assertEquals(
        bundle.endpoints["pdl#v5/person/search"].request.url,
        "https://api.peopledatalabs.com/v5/person/search",
    );
});

Deno.test("pdl#v5/person/search happy (synthetic): each record is one person credit; no vendor claim, the fold settles on the search pool", async () => {
    const unit = await testSealedUnit("pdl#v5/person/search");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                sql: "SELECT * FROM person WHERE job_title='data scientist'",
                size: 3,
            },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    // no consolidate ⇒ no claim ⇒ the DERIVED fold is the bill:
    // 3 records × 1 person credit (zUsage is strict — no mismatch key)
    assertEquals(result.usage, {
        credits: { people_search: 3 },
        evidence: { RESULT: 3 },
    });
    const output = result.output as Record<string, unknown>;
    assertEquals((output.data as unknown[]).length, 3);
    // nothing is stripped — the raw REST body has no billing field
    assertEquals(output.total, 1234);
    assertEquals(output.scroll_token, "NEXT_PAGE_TOKEN");
});

Deno.test("pdl#v5/person/search empty (synthetic): a 200 with no records bills nothing", async () => {
    const unit = await testSealedUnit("pdl#v5/person/search");
    const fixture = await loadFixture(`${fixturesDir}synthetic-empty.json`);
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                sql: "SELECT * FROM person WHERE job_title='zzzz-no-such-title'",
                size: 1,
            },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, { credits: {}, evidence: { RESULT: 0 } });
});

Deno.test("pdl#v5/person/search: size REQUIRED; query XOR sql survives as two strict variants", async () => {
    const unit = await testSealedUnit("pdl#v5/person/search");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const rejected: Json[] = [
        // the primary limiting knob is the estimate's whole basis (D25)
        { sql: "SELECT * FROM person WHERE job_title='x'" },
        // vendor bounds 1-100
        { sql: "SELECT * FROM person WHERE job_title='x'", size: 101 },
        { sql: "SELECT * FROM person WHERE job_title='x'", size: 0 },
        // BOTH query and sql — fails every strict variant
        {
            query: { term: { job_title: "x" } },
            sql: "SELECT * FROM person WHERE job_title='x'",
            size: 1,
        },
        // NEITHER — no variant matches
        { size: 1 },
        // unknown key (.strict() survives compilation)
        { sql: "SELECT * FROM person WHERE job_title='x'", size: 1, bogus: 1 },
    ];
    for (const body of rejected) {
        await assertRejects(
            () =>
                runEndpoint({ unit, input: { body }, mode: "replay", fixture }),
            Error,
            "INVALID_INPUT",
            JSON.stringify(body),
        );
    }
    // the near-miss positive: the OTHER variant (query) with size 3 passes
    // validation and replays (the fixture matches by method + url only)
    const ok = await runEndpoint({
        unit,
        input: {
            body: {
                query: { bool: { must: [{ term: { job_title: "x" } }] } },
                size: 3,
                dataset: "resume",
            },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(ok.isProviderError, false);
});

Deno.test("pdl#v5/person/search: dataset takes PDL's LIST grammar, not one enum name", async () => {
    // PR #7 review: v1's z.enum rejected the vendor's own comma-separated
    // and exclusion forms at OUR gate, before PDL ever saw them (design D7)
    const unit = await testSealedUnit("pdl#v5/person/search");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    for (
        const dataset of [
            "all",
            "email,phone",
            "all,-phone,consumer_social",
            "-email,phone",
        ]
    ) {
        const result = await runEndpoint({
            unit,
            input: {
                body: {
                    sql: "SELECT * FROM person WHERE job_title='x'",
                    size: 1,
                    dataset,
                },
            },
            mode: "replay",
            fixture,
        });
        assertEquals(result.isProviderError, false, dataset);
    }
    // the compiled schema documents the names without gating on them
    const body = unit.doc.input.schema.body as Record<string, Json>;
    const variant = (body.anyOf as Record<string, Json>[])[0];
    const dataset = (variant.properties as Record<string, Json>)
        .dataset as Record<string, Json>;
    assertEquals(dataset.type, "string");
    assertEquals(dataset.enum, undefined);
});

Deno.test({
    name: "pdl#v5/person/search live (gated on PDL_API_KEY)",
    ignore: liveSkip("pdl"),
    fn: async () => {
        const unit = await testSealedUnit("pdl#v5/person/search");
        const result = await runEndpoint({
            unit,
            input: {
                body: {
                    sql: "SELECT * FROM person WHERE job_title='data scientist'",
                    size: 1,
                },
            },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assertEquals(Object.keys(result.usage.evidence), ["RESULT"]);
    },
});
