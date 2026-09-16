import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));
const ID = "contactout#v1/people/linkedin/personal_email_status";

Deno.test(`${ID} happy (synthetic): FREE flag under the personal key`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: {
            queryParams: {
                profile: "https://www.linkedin.com/in/example-person",
            },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    // this doc alone among the free ones sends the personal key
    assertEquals(
        unit.doc.auth.inject.$fn.key ===
            (await testSealedUnit(
                "contactout#v1/people/linkedin/work_email_status",
            )).doc.auth.inject.$fn.key,
        false,
    );
});
