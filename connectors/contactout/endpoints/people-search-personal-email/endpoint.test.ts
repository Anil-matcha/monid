import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));
const ID = "contactout#v1/people/search/personal-email";

Deno.test(`${ID} happy (synthetic, profiles as an ARRAY, no reveal): 2 search credits on the personal pool, no reveals`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { job_title: ["CTO"], page_size: 2 } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.usage, {
        credits: { search_personal: 2 },
        evidence: { profiles: 2, email_reveals: 0, phone_reveals: 0 },
    });
});
