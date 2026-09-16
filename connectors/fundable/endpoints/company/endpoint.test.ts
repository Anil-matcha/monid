import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));

Deno.test("fundable#company happy (synthetic): identifier rides the query string; flat 1 credit; meter absorbed", async () => {
    const unit = await testSealedUnit("fundable#company");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        // the fixture URL proves the wire form: ?domain=stripe.com
        input: { queryParams: { domain: "stripe.com" } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    // flat model: the engine appends the CALL line; the vendor's own 1
    // credit is the claim and agrees with the pinned draw
    assertEquals(result.usage, {
        credits: { default: 1 },
        evidence: { CALL: 1 },
    });
    const output = result.output as Record<string, Record<string, unknown>>;
    assertEquals(
        (output.data.company as Record<string, unknown>).name,
        "Stripe",
    );
    // credits_used was the only meta key — pluck leaves an empty meta
    // (v1 dropped the empty object; here the envelope shape stays put)
    assertEquals(output.meta, {});
});

Deno.test("fundable#company provider error (synthetic 404): data, zero usage", async () => {
    const unit = await testSealedUnit("fundable#company");
    const fixture = await loadFixture(
        `${fixturesDir}synthetic-provider-error.json`,
    );
    const result = await runEndpoint({
        unit,
        input: { queryParams: { domain: "nonexistent-xyz.com" } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 404);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(
        (result.output as Record<string, Record<string, unknown>>).error.code,
        "COMPANY_NOT_FOUND",
    );
});

Deno.test({
    name: "fundable#company live (gated on FUNDABLE_API_KEY)",
    ignore: liveSkip("fundable"),
    fn: async () => {
        const unit = await testSealedUnit("fundable#company");
        const result = await runEndpoint({
            unit,
            input: { queryParams: { domain: "stripe.com" } },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assertEquals(result.usage.evidence, { CALL: 1 });
    },
});
