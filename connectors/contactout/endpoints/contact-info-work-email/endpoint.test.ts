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
const ID = "contactout#v1/people/linkedin/work-email";
const PROFILE = "https://www.linkedin.com/in/example-person";

Deno.test(`${ID} happy (synthetic): a work email, no phone ⇒ one email credit`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: { queryParams: { profile: PROFILE } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, {
        credits: { email_work: 1 },
        evidence: { email_found: 1, phone_found: 0 },
    });
});

Deno.test(`${ID} phone-only (synthetic): email_type=none draws NO email credit — the measured draw, not v1's card base`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(
        `${fixturesDir}synthetic-phone-only.json`,
    );
    const result = await runEndpoint({
        unit,
        input: {
            queryParams: {
                profile: PROFILE,
                email_type: "none",
                include_phone: true,
            },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.usage, {
        credits: { phone_work: 1 },
        evidence: { email_found: 0, phone_found: 1 },
    });
});

Deno.test(`${ID} miss (synthetic 404): a profile without this key's email kind is free`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-miss.json`);
    const result = await runEndpoint({
        unit,
        input: { queryParams: { profile: PROFILE } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test(`${ID} schema gate: the personal email_type does not exist on the work key`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    for (
        const bad of [
            { profile: PROFILE, email_type: "personal" },
            { profile: "https://twitter.com/example" },
        ] as Record<string, Json>[]
    ) {
        await assertRejects(
            () =>
                runEndpoint({
                    unit,
                    input: { queryParams: bad },
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
                queryParams: {
                    profile: "https://www.linkedin.com/in/williamhgates",
                },
            },
            mode: "live",
        });
        assertEquals(typeof result.httpStatus, "number");
    },
});
