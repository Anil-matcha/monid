import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));
const ID = "contactout#v1/people/decision-makers/personal-email";

Deno.test(`${ID} happy (synthetic, reveal_info): 2 profiles, one personal email ⇒ 2 search + 1 email on the personal pools`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: { queryParams: { domain: "contactout.com", reveal_info: true } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.usage, {
        credits: { search_personal: 2, email_personal: 1 },
        evidence: { profiles: 2, email_reveals: 1, phone_reveals: 0 },
    });
});
