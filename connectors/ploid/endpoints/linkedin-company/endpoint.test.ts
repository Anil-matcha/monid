import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));

Deno.test("ploid#v1/linkedin/companies/get happy (synthetic): one read at 0.06 ACU; the meter claims the same", async () => {
    const unit = await testSealedUnit("ploid#v1/linkedin/companies/get");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: { queryParams: { universalName: "retool" } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, {
        credits: { default: 0.06 },
        evidence: { CALL: 1 },
    });
    const output = result.output as Record<string, unknown>;
    // meta held only the meter and a request id: emptied by the strip and
    // dropped (v1 stripMetaInternals)
    assertEquals(output.meta, undefined);
    assertEquals(typeof output.data, "object");
});

Deno.test("ploid#v1/linkedin/companies/get provider error (recorded 401): data, zero usage", async () => {
    const unit = await testSealedUnit("ploid#v1/linkedin/companies/get");
    const fixture = await loadFixture(`${fixturesDir}provider-error.json`);
    const result = await runEndpoint({
        unit,
        input: { queryParams: { universalName: "retool" } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 401);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test("ploid#v1/linkedin/companies/get: schema gate", async () => {
    const unit = await testSealedUnit("ploid#v1/linkedin/companies/get");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    await assertRejects(
        () =>
            runEndpoint({
                unit,
                input: { queryParams: { universalName: "retool", bogus: 1 } },
                mode: "replay",
                fixture,
            }),
        Error,
        "INVALID_INPUT",
    );
});
