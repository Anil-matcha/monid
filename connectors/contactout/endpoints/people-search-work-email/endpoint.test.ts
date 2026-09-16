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
const ID = "contactout#v1/people/search/work-email";

Deno.test(`${ID} happy (synthetic, profiles keyed by URL): 2 profiles, one revealed with email + phone`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: {
            body: { job_title: ["CTO"], page_size: 2, reveal_info: true },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, {
        credits: { search_work: 2, email_work: 1, phone_work: 1 },
        evidence: { profiles: 2, email_reveals: 1, phone_reveals: 1 },
    });
});

Deno.test(`${ID} empty (synthetic): zero profiles draw nothing`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-empty.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { job_title: ["CTO"], page_size: 2 } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.isProviderError, false);
    assertEquals(result.usage, {
        credits: {},
        evidence: { profiles: 0, email_reveals: 0, phone_reveals: 0 },
    });
});

Deno.test(`${ID} provider error (synthetic 401): data, zero usage`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(
        `${fixturesDir}synthetic-provider-error.json`,
    );
    const result = await runEndpoint({
        unit,
        input: { body: { job_title: ["CTO"], page_size: 2 } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test(`${ID} schema gate: page_size is REQUIRED at the binding and capped at 25; the other key's data_types is rejected`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-empty.json`);
    for (
        const bad of [
            { job_title: ["CTO"] },
            { job_title: ["CTO"], page_size: 26 },
            {
                job_title: ["CTO"],
                page_size: 2,
                data_types: ["personal_email"],
            },
            { job_title: ["CTO"], page_size: 2, bogus: true },
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
    // the compiled schema states the requirement plainly
    const schema = unit.doc.input.schema.body as {
        required?: string[];
        additionalProperties?: boolean;
    };
    assertEquals(schema.required, ["page_size"]);
    assertEquals(schema.additionalProperties, false);
});

Deno.test({
    name: `${ID} live (gated on CONTACTOUT_CREDENTIALS)`,
    ignore: liveSkip("contactout"),
    fn: async () => {
        const unit = await testSealedUnit(ID);
        const result = await runEndpoint({
            unit,
            input: {
                body: { job_title: ["CTO"], company: ["Stripe"], page_size: 1 },
            },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assertEquals(result.usage.evidence.email_reveals, 0);
        assertEquals(result.usage.evidence.phone_reveals, 0);
    },
});
