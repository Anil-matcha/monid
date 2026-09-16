import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));
const DEAL_ID = "cca72384-d735-42f8-99d6-b3e14179c4c1";

Deno.test("fundable#deal/investors happy (synthetic): {id} substituted into the url; flat 1 credit", async () => {
    const unit = await testSealedUnit("fundable#deal/investors");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        // the fixture URL proves the substitution: /deals/<uuid>/investors
        input: { pathParams: { id: DEAL_ID } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, {
        credits: { default: 1 },
        evidence: { CALL: 1 },
    });
    const data = (result.output as Record<string, Record<string, unknown>>)
        .data;
    assertEquals((data.investors as unknown[]).length, 1);
    assertEquals((data.angel_investors as unknown[]).length, 4);
});

Deno.test("fundable#deal/investors empty (synthetic): empty arrays still bill the one call (v1 drill)", async () => {
    const unit = await testSealedUnit("fundable#deal/investors");
    const fixture = await loadFixture(`${fixturesDir}synthetic-empty.json`);
    const result = await runEndpoint({
        unit,
        input: { pathParams: { id: DEAL_ID } },
        mode: "replay",
        fixture,
    });
    // flat model: the lineup size never enters the bill — the vendor's 1
    // credit claim and the engine-appended CALL line agree
    assertEquals(result.usage, {
        credits: { default: 1 },
        evidence: { CALL: 1 },
    });
});

Deno.test("fundable#deal/investors: a non-UUID id is rejected before the wire", async () => {
    const unit = await testSealedUnit("fundable#deal/investors");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    await assertRejects(
        () =>
            runEndpoint({
                unit,
                input: { pathParams: { id: "not-a-uuid" } },
                mode: "replay",
                fixture,
            }),
        Error,
        "INVALID_INPUT",
    );
});
