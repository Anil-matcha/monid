import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));

Deno.test("ploid#v1/socials happy (synthetic): one profile, meter 1 ACU", async () => {
    const unit = await testSealedUnit("ploid#v1/socials");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { platform: "github", identifier: "octocat" } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, {
        credits: { default: 1 },
        evidence: { CALL: 1 },
    });
    const output = result.output as Record<string, Record<string, unknown>>;
    assertEquals(output.data.platform, "github");
    // meta held only the meter, a balance and a request id: emptied by the
    // strip and dropped (v1 stripMetaInternals)
    assertEquals(output.meta, undefined);
});

Deno.test("ploid#v1/socials provider error (recorded 401): data, zero usage", async () => {
    const unit = await testSealedUnit("ploid#v1/socials");
    const fixture = await loadFixture(`${fixturesDir}provider-error.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { platform: "github", identifier: "octocat" } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 401);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test("ploid#v1/socials: platform is a closed enum", async () => {
    const unit = await testSealedUnit("ploid#v1/socials");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    await assertRejects(
        () =>
            runEndpoint({
                unit,
                input: { body: { platform: "myspace", identifier: "x" } },
                mode: "replay",
                fixture,
            }),
        Error,
        "INVALID_INPUT",
    );
});
