import { assertEquals, assertRejects } from "@std/assert";
import type { Json } from "@shared/core";
import { fromFileUrl } from "@std/path";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));

const QUERY =
    'select from people where experiences.any(is_current = true and job_title is_similar_to ("VP Sales") and company.estimated_employee_count >= 500)';

Deno.test("clay#search/query-mode happy (recorded): creating is FREE and returns the iterator handle", async () => {
    const unit = await testSealedUnit("clay#search/query-mode");
    const fixture = await loadFixture(`${fixturesDir}happy.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { query: QUERY } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    // FREE: no pool is drained, so the compiled credits map is empty and
    // the synthesized quantities fn returns nothing to fold
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(result.output, {
        search_id: "SEARCH1",
        source_type: "people",
    });
    // settles on the start, nothing polled. (That this doc runs the plain
    // RELAY rather than the provider's routine wrapper is proven by fn
    // provenance in lifecycle.test.ts — replay matches on method + url
    // only, so a fixture can never prove a request body.)
    assertEquals(result.timing.attempts, 0);
});

Deno.test("clay#search/query-mode provider error (recorded 400): a rejected grammar is data, relayed verbatim", async () => {
    const unit = await testSealedUnit("clay#search/query-mode");
    const fixture = await loadFixture(`${fixturesDir}provider-error.json`);
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                query:
                    'select from companies where estimated_employee_count >= 500 and industry is_similar_to ("Software Development")',
            },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 400);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    // clay declares no output hooks — the vendor's own diagnosis, which
    // names the offending operator and field, reaches the caller
    assertEquals(
        (result.output as Record<string, unknown>).message,
        "'is_similar_to' is not supported on field 'industry'. It can only be used on job title fields or the company products_and_services field.",
    );
});

Deno.test("clay#search/query-mode: the query is required and the body is strict", async () => {
    const unit = await testSealedUnit("clay#search/query-mode");
    const fixture = await loadFixture(`${fixturesDir}happy.json`);
    const rejected: Json[] = [{}, { query: "" }, { query: QUERY, limit: 10 }];
    for (const body of rejected) {
        await assertRejects(
            () =>
                runEndpoint({ unit, input: { body }, mode: "replay", fixture }),
            Error,
            "INVALID_INPUT",
            JSON.stringify(body),
        );
    }
});

Deno.test({
    name: "clay#search/query-mode live (gated on CLAY_API_KEY)",
    ignore: liveSkip("clay"),
    fn: async () => {
        const unit = await testSealedUnit("clay#search/query-mode");
        const result = await runEndpoint({
            unit,
            input: { body: { query: QUERY } },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assertEquals(result.usage, { credits: {}, evidence: {} });
        assertEquals(
            typeof (result.output as Record<string, unknown>).search_id,
            "string",
        );
    },
});
