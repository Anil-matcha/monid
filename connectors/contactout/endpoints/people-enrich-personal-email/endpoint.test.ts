import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));
const ID = "contactout#v1/people/enrich/personal-email";
const PROFILE = "https://www.linkedin.com/in/example-person";

Deno.test(`${ID} happy (synthetic): match + personal email on the personal pools (v1 test: 0.018 + 0.17)`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { linkedin_url: PROFILE, include: ["personal_email"] } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.usage, {
        credits: { search_personal: 1, email_personal: 1 },
        evidence: { profile_matched: 1, email_found: 1, phone_found: 0 },
    });
});
