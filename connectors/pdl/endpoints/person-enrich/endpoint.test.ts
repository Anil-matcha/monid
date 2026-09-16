import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));

Deno.test("pdl#v5/person/enrich happy (synthetic): identifier rides the query string (the SDK's wire form); one enrich credit", async () => {
    const unit = await testSealedUnit("pdl#v5/person/enrich");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        // the fixture URL proves the wire form: GET ?email=user%40example.com
        input: { queryParams: { email: "user@example.com" } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    // flat model: the engine appends the CALL line and folds the one
    // person credit — no vendor claim exists in the body
    assertEquals(result.usage, {
        credits: { people_enrich: 1 },
        evidence: { CALL: 1 },
    });
    const output = result.output as Record<string, unknown>;
    assertEquals(output.likelihood, 8);
    assertEquals(
        (output.data as Record<string, unknown>).full_name,
        "jane doe",
    );
});

Deno.test("pdl#v5/person/enrich no match (synthetic 404): data, zero usage, PDL error envelope through", async () => {
    const unit = await testSealedUnit("pdl#v5/person/enrich");
    const fixture = await loadFixture(
        `${fixturesDir}synthetic-provider-error.json`,
    );
    const result = await runEndpoint({
        unit,
        input: { queryParams: { email: "nobody@example.com" } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 404);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(
        (result.output as Record<string, Record<string, unknown>>).error.type,
        "not_found",
    );
});

Deno.test("pdl#v5/person/enrich: unknown query key rejected before the wire", async () => {
    const unit = await testSealedUnit("pdl#v5/person/enrich");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    await assertRejects(
        () =>
            runEndpoint({
                unit,
                input: { queryParams: { email: "user@example.com", bogus: 1 } },
                mode: "replay",
                fixture,
            }),
        Error,
        "INVALID_INPUT",
    );
});

Deno.test({
    name: "pdl#v5/person/enrich live (gated on PDL_API_KEY)",
    ignore: liveSkip("pdl"),
    fn: async () => {
        const unit = await testSealedUnit("pdl#v5/person/enrich");
        const result = await runEndpoint({
            unit,
            input: {
                queryParams: {
                    profile: "linkedin.com/in/seanthorne",
                    min_likelihood: 6,
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
            credits: { people_enrich: 1 },
            evidence: { CALL: 1 },
        });
    },
});
