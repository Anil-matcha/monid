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
const ID = "contactout#v1/email/enrich/work-email";

Deno.test(`${ID} happy (synthetic): the camelCase scalar dialect counts — string email + string phone`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: { queryParams: { email: "person@example.com" } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, {
        credits: { email_work: 1, phone_work: 1 },
        evidence: { email_found: 1, phone_found: 1, profile_only: 0 },
    });
});

Deno.test(`${ID} miss (synthetic 404): error-as-data, zero usage`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-miss.json`);
    const result = await runEndpoint({
        unit,
        input: { queryParams: { email: "person@example.com" } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.isProviderError, true);
    assertEquals(result.httpStatus, 404);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test(`${ID} schema gate: a malformed address and the personal include value are rejected`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    for (
        const bad of [
            { email: "not-an-email" },
            { email: "person@example.com", include: "personal_email" },
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
            input: { queryParams: { email: "billg@microsoft.com" } },
            mode: "live",
        });
        // a hit OR a 404 miss are both honest answers; only the shape is
        // asserted
        assertEquals(typeof result.httpStatus, "number");
    },
});
