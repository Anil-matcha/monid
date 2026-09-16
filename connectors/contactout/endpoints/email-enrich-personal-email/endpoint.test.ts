import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));
const ID = "contactout#v1/email/enrich/personal-email";

Deno.test(`${ID} happy (synthetic): a personal address, no phone ⇒ one personal email credit`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: { queryParams: { email: "person@example.com" } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.usage, {
        credits: { email_personal: 1 },
        evidence: { email_found: 1, phone_found: 0, profile_only: 0 },
    });
});

Deno.test(`${ID} miss (synthetic 404): zero usage`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-miss.json`);
    const result = await runEndpoint({
        unit,
        input: { queryParams: { email: "person@example.com" } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test(`${ID} schema gate: the work-only include switch does not exist on the personal key`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    await assertRejects(
        () =>
            runEndpoint({
                unit,
                input: {
                    queryParams: {
                        email: "person@example.com",
                        include: "work_email",
                    },
                },
                mode: "replay",
                fixture,
            }),
        Error,
        "INVALID_INPUT",
    );
});
