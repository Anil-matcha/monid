import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json } from "@shared/core";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));
const URL_ = "https://www.linkedin.com/in/example";

Deno.test("ploid#v1/enrich happy (synthetic): profile + email found, phone null; meter 2 ACU matches the fold", async () => {
    const unit = await testSealedUnit("ploid#v1/enrich");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                linkedin_url: URL_,
                enrichments: ["profile", "email", "phone"],
            },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, {
        credits: { default: 2 },
        evidence: { profile: 1, email: 1, phone: 0 },
    });
    const output = result.output as Record<string, Record<string, unknown>>;
    assertEquals(output.data.phone, null);
    assertEquals(output.meta.acu_used, undefined);
    assertEquals(output.meta.acu_remaining, undefined);
    assertEquals(output.meta.warnings, []);
});

Deno.test("ploid#v1/enrich empty (synthetic): nothing resolved, zero ACU", async () => {
    const unit = await testSealedUnit("ploid#v1/enrich");
    const fixture = await loadFixture(`${fixturesDir}synthetic-empty.json`);
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                linkedin_url: "https://www.linkedin.com/in/nobody",
                enrichments: ["profile", "email"],
            },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, {
        credits: {},
        evidence: { profile: 0, email: 0, phone: 0 },
    });
});

Deno.test("ploid#v1/enrich provider error (recorded 401): data, zero usage", async () => {
    const unit = await testSealedUnit("ploid#v1/enrich");
    const fixture = await loadFixture(`${fixturesDir}provider-error.json`);
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                linkedin_url: URL_,
                enrichments: ["profile", "email", "phone"],
            },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 401);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test("ploid#v1/enrich: linkedin_url must be a URL; enrichments non-empty and closed; unknown fields rejected", async () => {
    const unit = await testSealedUnit("ploid#v1/enrich");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const rejected: Json[] = [
        { linkedin_url: "not a url" },
        { linkedin_url: URL_, enrichments: [] },
        { linkedin_url: URL_, enrichments: ["address"] },
        { linkedin_url: URL_, session_id: "x" },
    ];
    for (const body of rejected) {
        await assertRejects(
            () =>
                runEndpoint({ unit, input: { body }, mode: "replay", fixture }),
            Error,
            "INVALID_INPUT",
            JSON.stringify(body),
        );
    }
});
