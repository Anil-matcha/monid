import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));
const ID = "contactout#v1/people/linkedin/personal-email";
const PROFILE = "https://www.linkedin.com/in/example-person";

Deno.test(`${ID} happy (synthetic): a personal email, no phone ⇒ one personal email credit`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: { queryParams: { profile: PROFILE } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.usage, {
        credits: { email_personal: 1 },
        evidence: { email_found: 1, phone_found: 0 },
    });
});

Deno.test(`${ID} schema gate: the work email_type does not exist on the personal key`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    await assertRejects(
        () =>
            runEndpoint({
                unit,
                input: {
                    queryParams: { profile: PROFILE, email_type: "work" },
                },
                mode: "replay",
                fixture,
            }),
        Error,
        "INVALID_INPUT",
    );
});
