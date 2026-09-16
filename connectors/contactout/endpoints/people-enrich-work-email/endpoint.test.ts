import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json } from "@shared/core";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));
const ID = "contactout#v1/people/enrich/work-email";
const PROFILE = "https://www.linkedin.com/in/example-person";

Deno.test(`${ID} happy (synthetic): every match draws a search credit; the found work email stacks`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: {
            body: { linkedin_url: PROFILE, include: ["work_email", "phone"] },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, {
        credits: { search_work: 1, email_work: 1 },
        evidence: { profile_matched: 1, email_found: 1, phone_found: 0 },
    });
});

Deno.test(`${ID} miss (synthetic 404): zero usage`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-miss.json`);
    const result = await runEndpoint({
        unit,
        input: {
            body: { linkedin_url: PROFILE, include: ["work_email", "phone"] },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test(`${ID} schema gate: the other key's include value and unknown keys are rejected`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    for (
        const bad of [
            { linkedin_url: PROFILE, include: ["personal_email"] },
            { linkedin_url: PROFILE, bogus: 1 },
            { linkedin_url: "https://www.linkedin.com/company/example" },
        ] as Record<string, Json>[]
    ) {
        await assertRejects(
            () =>
                runEndpoint({
                    unit,
                    input: { body: bad },
                    mode: "replay",
                    fixture,
                }),
            Error,
            "INVALID_INPUT",
            JSON.stringify(bad),
        );
    }
});

Deno.test({
    name: `${ID} live (gated on CONTACTOUT_CREDENTIALS)`,
    ignore: liveSkip("contactout"),
    fn: async () => {
        const unit = await testSealedUnit(ID);
        const result = await runEndpoint({
            unit,
            input: {
                body: {
                    linkedin_url: "https://www.linkedin.com/in/williamhgates",
                },
            },
            mode: "live",
        });
        assertEquals(typeof result.httpStatus, "number");
    },
});
