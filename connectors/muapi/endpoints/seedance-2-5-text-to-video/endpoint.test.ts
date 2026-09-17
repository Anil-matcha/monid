import {
    assert,
    assertAlmostEquals,
    assertEquals,
    assertRejects,
} from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json, RunInput } from "@shared/core";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";
import { directTransport, Engine } from "@monid/connector-engine";

const ID = "muapi#seedance-2.5-text-to-video";
const FIXTURES = fromFileUrl(new URL("../../fixtures/", import.meta.url));
const INPUT: RunInput = {
    body: { prompt: "a lighthouse beam sweeping across fog" },
};

async function estimate(body: Json) {
    const engine = new Engine({
        transport: directTransport({
            params: () => Promise.resolve({ apiKey: "test-key" }),
            fetch: () => Promise.reject(new Error("estimate must not do IO")),
        }),
    });
    const loaded = await engine.load(await testSealedUnit(ID));
    return loaded.estimate({ body });
}

Deno.test("muapi: submit -> processing -> completed settles vendor cost", async () => {
    const result = await runEndpoint({
        unit: await testSealedUnit(ID),
        input: INPUT,
        mode: "replay",
        fixture: await loadFixture(
            `${FIXTURES}synthetic-task-succeeded.json`,
        ),
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    assertEquals(result.usage, {
        credits: { default: 1.7 },
        evidence: { "720p_second": 5 },
    });
    assert(!("mismatch" in result.usage));

    const output = result.output as Record<string, Json>;
    assertEquals(output.status, "completed");
    assertEquals(output.outputs, [
        "https://cdn.muapi.ai/video/MUAPI_TASK_1.mp4",
    ]);
    assert(!("cost" in output), "the vendor cost is consolidated out");
    assertEquals(result.timing.attempts, 2);
});

Deno.test("muapi: a failed prediction is synthesized as zero-usage error", async () => {
    const result = await runEndpoint({
        unit: await testSealedUnit(ID),
        input: INPUT,
        mode: "replay",
        fixture: await loadFixture(`${FIXTURES}synthetic-task-failed.json`),
    });
    assertEquals(result.httpStatus, 500);
    assertEquals(result.providerHttpStatus, 200);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    const output = result.output as Record<string, Json>;
    assertEquals(output.message, "the prompt was rejected");
    assert("raw" in output);
});

Deno.test("muapi: a string task error is preserved", async () => {
    const result = await runEndpoint({
        unit: await testSealedUnit(ID),
        input: INPUT,
        mode: "replay",
        fixture: await loadFixture(
            `${FIXTURES}synthetic-task-failed-string.json`,
        ),
    });
    assertEquals(result.httpStatus, 500);
    assertEquals(result.isProviderError, true);
    const output = result.output as Record<string, Json>;
    assertEquals(output.message, "the prompt was rejected as unsafe");
});

Deno.test("muapi: a rejected submit is relayed as zero-usage error-as-data", async () => {
    const result = await runEndpoint({
        unit: await testSealedUnit(ID),
        input: INPUT,
        mode: "replay",
        fixture: await loadFixture(
            `${FIXTURES}synthetic-submit-rejected.json`,
        ),
    });
    assertEquals(result.httpStatus, 401);
    assertEquals(result.providerHttpStatus, undefined);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    const output = result.output as Record<string, Json>;
    assertEquals(output.code, "invalid_api_key");
    assertEquals(output.message, "invalid api key");
});

Deno.test("muapi: estimates follow the resolution-per-second card", async () => {
    const defaultEstimate = await estimate({ prompt: "x" });
    assertAlmostEquals(defaultEstimate.credits.default, 1.7);
    assertEquals(defaultEstimate.evidence, { "720p_second": 5 });
    const lowEstimate = await estimate({
        prompt: "x",
        resolution: "480p",
        duration: 5,
    });
    assertAlmostEquals(lowEstimate.credits.default, 0.85);
    assertEquals(lowEstimate.evidence, { "480p_second": 5 });
    assertAlmostEquals(
        (await estimate({
            prompt: "x",
            resolution: "1080p",
            duration: 4,
        })).credits.default,
        3.4,
    );
    assertEquals(
        await estimate({
            prompt: "x",
            resolution: "4k",
            duration: 30,
        }),
        {
            credits: { default: 51 },
            evidence: { "4k_second": 30 },
        },
    );
});

Deno.test("muapi: endpoint binding rejects invalid inputs before the wire", async () => {
    await assertRejects(
        () => estimate({}),
        Error,
        "INVALID_INPUT",
    );
    await assertRejects(
        () => estimate({ prompt: "x", duration: 31 }),
        Error,
        "INVALID_INPUT",
    );
    await assertRejects(
        () => estimate({ prompt: "x", seed: 4294967296 }),
        Error,
        "INVALID_INPUT",
    );
});
