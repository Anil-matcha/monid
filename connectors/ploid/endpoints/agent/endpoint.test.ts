import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json } from "@shared/core";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));
const PROMPT = "Research Retool's current stage.";

Deno.test("ploid#v1/agent run-succeeded (synthetic): 202 parks, one running tick, completed body bills the ACU meter; session_id stripped", async () => {
    const unit = await testSealedUnit("ploid#v1/agent");
    const fixture = await loadFixture(
        `${fixturesDir}synthetic-run-succeeded.json`,
    );
    const result = await runEndpoint({
        unit,
        input: { body: { prompt: PROMPT, max_acu: 12 } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.providerHttpStatus, undefined);
    assertEquals(result.isProviderError, false);
    // claim 1 (meta.acu_used) = fold 1 CREDIT × 1 ACU
    assertEquals(result.usage, {
        credits: { default: 1 },
        evidence: { CREDIT: 1 },
    });
    const output = result.output as Record<string, Record<string, unknown>>;
    assertEquals(output.data.output, "Findings…");
    assertEquals(output.meta.session_id, undefined);
    assertEquals(output.meta.acu_used, undefined);
    assertEquals(output.meta.acu_limit, undefined);
    assertEquals(output.meta.acu_value_usd, undefined);
    assertEquals(output.meta.max_results, 25);
});

Deno.test("ploid#v1/agent error inside 200 (synthetic): start synthesizes the envelope's http_status over providerHttpStatus 200, zero usage", async () => {
    const unit = await testSealedUnit("ploid#v1/agent");
    const fixture = await loadFixture(
        `${fixturesDir}synthetic-error-inside-200.json`,
    );
    const result = await runEndpoint({
        unit,
        input: { body: { prompt: PROMPT, max_acu: 12 } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 503);
    assertEquals(result.providerHttpStatus, 200);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test("ploid#v1/agent run-failed (synthetic): a 503 poll is terminal error-as-data, zero usage", async () => {
    const unit = await testSealedUnit("ploid#v1/agent");
    const fixture = await loadFixture(
        `${fixturesDir}synthetic-run-failed.json`,
    );
    const result = await runEndpoint({
        unit,
        input: { body: { prompt: PROMPT, max_acu: 12 } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 503);
    assertEquals(result.providerHttpStatus, undefined);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test("ploid#v1/agent provider error (recorded 401): the start's own exchange fails as data", async () => {
    const unit = await testSealedUnit("ploid#v1/agent");
    const fixture = await loadFixture(`${fixturesDir}provider-error.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { prompt: PROMPT, max_acu: 12 } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 401);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test("ploid#v1/agent: shared-workspace fields and v1's dollar knob are unknown fields; max_acu is an integer 1-64", async () => {
    const unit = await testSealedUnit("ploid#v1/agent");
    const fixture = await loadFixture(
        `${fixturesDir}synthetic-run-succeeded.json`,
    );
    const rejected: Json[] = [
        { prompt: PROMPT, session_id: "steal-state" },
        { prompt: PROMPT, memory: "session" },
        { prompt: PROMPT, max_spend_usd: 1.2 },
        { prompt: PROMPT, max_acu: 0 },
        { prompt: PROMPT, max_acu: 1.5 },
        { prompt: PROMPT, max_acu: 65 },
        { prompt: PROMPT, response_format: "html" },
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
