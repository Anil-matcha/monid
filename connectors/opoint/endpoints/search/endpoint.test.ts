import { assert, assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json } from "@shared/core";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testBundle,
    testSealedUnit,
} from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));

Deno.test("opoint: fn provenance — the four searches inherit the provider seams, suggest overrides them", async () => {
    const bundle = await testBundle();
    const ids = Object.keys(bundle.endpoints).filter((id) =>
        id.startsWith("opoint#")
    ).sort();
    assertEquals(ids, [
        "opoint#search",
        "opoint#search-advanced",
        "opoint#search-by-ids",
        "opoint#search-headlines",
        "opoint#suggest",
    ]);
    const search = bundle.endpoints["opoint#search"];
    const suggest = bundle.endpoints["opoint#suggest"];
    const searches = ids.filter((id) => id !== "opoint#suggest");
    // ONE token inject and ONE agreement projection for every search doc;
    // the public suggestion host has its own (credential-less, row-shaped)
    for (const id of searches) {
        const doc = bundle.endpoints[id];
        assertEquals(doc.auth.inject.$fn.key, search.auth.inject.$fn.key, id);
        assertEquals(
            doc.output.fromResponse?.$fn.key,
            search.output.fromResponse?.$fn.key,
            id,
        );
    }
    assert(suggest.auth.inject.$fn.key !== search.auth.inject.$fn.key);
    assert(
        suggest.output.fromResponse?.$fn.key !==
            search.output.fromResponse?.$fn.key,
    );
    // the in-band 200 verdict is provider-wide — every doc, suggest included
    for (const id of ids) {
        assertEquals(
            bundle.endpoints[id].lifecycle?.start?.$fn.key,
            search.lifecycle?.start?.$fn.key,
            id,
        );
    }
    // wire profiles: /search and /search-advanced share the provider's
    // ARTICLE profile; headlines, by-ids and suggest each own a distinct one
    const articleProfile = search.input.toRequest?.$fn.key;
    assertEquals(
        bundle.endpoints["opoint#search-advanced"].input.toRequest?.$fn.key,
        articleProfile,
    );
    const own = [
        "opoint#search-headlines",
        "opoint#search-by-ids",
        "opoint#suggest",
    ].map((id) => bundle.endpoints[id].input.toRequest?.$fn.key);
    assertEquals(new Set([articleProfile, ...own]).size, 4);
    // flat / free models: estimate + evidence are the ONE synthesized fn,
    // and nothing consolidates (no receipt in any Opoint response)
    const synthesizedKey = search.usage.estimate.$fn.key;
    for (const id of ids) {
        const doc = bundle.endpoints[id];
        assertEquals(doc.usage.estimate.$fn.key, synthesizedKey, id);
        assertEquals(doc.usage.evidence.$fn.key, synthesizedKey, id);
        assertEquals(doc.usage.consolidate, undefined, id);
    }
    assertEquals(
        bundle.fnTable[synthesizedKey].provenance,
        "core#usage.synthesizedEmpty",
    );
    // one pool, calls — drained by the four searches, not by suggest
    assertEquals(search.usage.credits, {
        default: { label: "Opoint search calls" },
    });
    assertEquals(suggest.usage.model, { kind: "FREE" });
});

Deno.test("opoint#search happy (synthetic): one call consumed; articles projected to the agreement fields with a 256-char snippet", async () => {
    const unit = await testSealedUnit("opoint#search");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                searchterm: "spotify",
                params: { requestedarticles: 3, oldest: 1789000000 },
            },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.providerHttpStatus, undefined);
    // flat model: the engine appends the CALL line and folds one call
    assertEquals(result.usage, {
        credits: { default: 1 },
        evidence: { CALL: 1 },
    });
    const output = result.output as Record<string, unknown>;
    assertEquals(output.documents, 2);
    assertEquals(output.context, "358146519:1:0;TOTDOC=3");
    // search internals are gone with the envelope
    assertEquals(output.search_start, undefined);
    assertEquals(output.host, undefined);
    assertEquals(output.response_code, undefined);
    const docs = output.document as Record<string, unknown>[];
    assertEquals(docs.length, 2);
    const doc = docs[0];
    assertEquals(doc.header, "Headline 0");
    assertEquals(doc.author, "Jane Doe");
    assertEquals(doc.orig_url, "https://example.com/0");
    assertEquals(doc.topics, [{ id: 52, text: "Europe" }]);
    // dropped: the account-bearing tracking url, bodies, internals
    for (
        const dropped of [
            "url",
            "summary",
            "body",
            "quotes",
            "internal_search_reply",
            "stimestamp",
            "hidden",
            "position",
        ]
    ) {
        assertEquals(doc[dropped], undefined, `${dropped} leaked`);
    }
    const snippet = doc.snippet as string;
    // body text only: Opoint's `summary` (the lede) is not an approved
    // source, even when the response carries it
    assert(snippet.startsWith("Body "), snippet);
    assert(!snippet.includes("Lede"), "summary text leaked into the snippet");
    assert(!snippet.includes("<p>"), "HTML tag leaked into the snippet");
    assertEquals(snippet.length, 256);
});

Deno.test("opoint#search empty (synthetic): zero articles still consume the call (design D2)", async () => {
    const unit = await testSealedUnit("opoint#search");
    const fixture = await loadFixture(`${fixturesDir}synthetic-empty.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { searchterm: "zxqvbnmlkjhgf98765qwe" } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    assertEquals(result.usage, {
        credits: { default: 1 },
        evidence: { CALL: 1 },
    });
    const output = result.output as Record<string, unknown>;
    assertEquals(output.documents, 0);
    assertEquals(output.document, []);
});

Deno.test("opoint#search in-band failure (synthetic): HTTP 200 + response_code 500 becomes a 422 provider error, zero usage", async () => {
    const unit = await testSealedUnit("opoint#search");
    const fixture = await loadFixture(
        `${fixturesDir}synthetic-in-band-error.json`,
    );
    const result = await runEndpoint({
        unit,
        input: { body: { searchterm: "header:" } },
        mode: "replay",
        fixture,
    });
    // OURS 422 over THEIRS 200 (design D12) — the engine classifies and
    // forces zero usage; the vendor body relays verbatim (no fromError)
    assertEquals(result.httpStatus, 422);
    assertEquals(result.providerHttpStatus, 200);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(
        (result.output as Record<string, Record<string, unknown>>)
            .searchresult.errors,
        "Solr could not handle the query",
    );
});

Deno.test("opoint#search provider error (recorded 401): DRF's rejection is data, zero usage", async () => {
    const unit = await testSealedUnit("opoint#search");
    const fixture = await loadFixture(`${fixturesDir}provider-error.json`);
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                searchterm: "spotify",
                params: { requestedarticles: 3, oldest: 1789000000 },
            },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 401);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    // JSON because the provider pins `Accept: application/json` (D8);
    // without it DRF answered this same 401 as its HTML login page
    assertEquals(result.output, { detail: "Invalid token." });
});

Deno.test("opoint#search: strict allow-list — account-state params, unknown keys, and out-of-range pages are rejected before the wire", async () => {
    const unit = await testSealedUnit("opoint#search");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const rejected: Json[] = [
        // keeps account-level state on Monid's shared token (cross-tenant)
        { searchterm: "x", params: { update_search: true } },
        { searchterm: "x", params: { watch_id: 1 } },
        // content toggles are pinned by the wire profile
        { searchterm: "x", params: { main: { text: 1 } } },
        { searchterm: "x", bogus: 1 },
        { searchterm: "x", params: { requestedarticles: 101 } },
        { params: { requestedarticles: 5 } },
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
    // the gate is not too wide: the page ceiling itself is accepted
    const result = await runEndpoint({
        unit,
        input: {
            body: { searchterm: "x", params: { requestedarticles: 100 } },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
});

Deno.test({
    name: "opoint#search live (gated on OPOINT_API_KEY)",
    ignore: liveSkip("opoint"),
    fn: async () => {
        const unit = await testSealedUnit("opoint#search");
        const result = await runEndpoint({
            unit,
            input: {
                body: {
                    searchterm: "header:spotify AND lang:en",
                    params: { requestedarticles: 2 },
                },
            },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assertEquals(result.usage, {
            credits: { default: 1 },
            evidence: { CALL: 1 },
        });
        const output = result.output as Record<string, unknown>;
        assert(Array.isArray(output.document));
        for (const doc of output.document as Record<string, unknown>[]) {
            assertEquals(doc.url, undefined, "tracking url leaked");
            assert(((doc.snippet as string | undefined) ?? "").length <= 256);
        }
    },
});
