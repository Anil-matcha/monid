import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { RunInput } from "@shared/core";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";
import { directTransport, Engine } from "@monid/connector-engine";

const FIXTURES = fromFileUrl(new URL("../../fixtures/", import.meta.url));
const ID = "minimax#v1/image_generation";

/** The engine's credits fold is plain float arithmetic — assert the rate,
 *  not the float (see the text-to-speech suite for the full note). */
const CENT = 1e-12;

const estimateFor = async (body: RunInput["body"]) => {
    const loaded = await new Engine({
        transport: directTransport({
            params: () => Promise.resolve({ apiKey: "test-key" }),
            fetch: () => Promise.reject(new Error("estimate must not do IO")),
        }),
    }).load(await testSealedUnit(ID));
    return loaded.estimate({ body });
};

Deno.test("minimax#image_generation: bills the images that came back, not the ones asked for", async () => {
    // The shared chain returns THREE image_urls. Ask for four: one was
    // blocked for content safety, and MiniMax simply omits it — so the
    // settle bills 3 while the estimate held 4. No special case expresses
    // this; counting the returned array IS the rule.
    const result = await runEndpoint({
        unit: await testSealedUnit(ID),
        input: { body: { prompt: "a lighthouse at dusk", n: 4 } },
        mode: "replay",
        fixture: await loadFixture(`${FIXTURES}synthetic-blocking-ok.json`),
    });

    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage.evidence, { RESULT: 3 });
    assertAlmostEquals(result.usage.credits.default, 0.0105, CENT);

    assertEquals((await estimateFor({ prompt: "x", n: 4 })).evidence, {
        RESULT: 4,
    });
});

Deno.test("minimax#image_generation: `n` defaults to 1 at the binding", async () => {
    const unit = await testSealedUnit(ID);
    const properties = (unit.doc.input.schema.body as Record<string, unknown>)
        .properties as Record<string, Record<string, unknown>>;
    assertEquals(properties.n.default, 1);
    // ...and the estimate reads the materialized value, not undefined
    assertEquals((await estimateFor({ prompt: "x" })).evidence, { RESULT: 1 });
});

Deno.test("minimax#image_generation: a base64 response is counted the same way", async () => {
    const unit = await testSealedUnit(ID);
    const result = await runEndpoint({
        unit,
        input: {
            body: { prompt: "x", n: 2, response_format: "base64" },
        },
        mode: "replay",
        fixture: {
            name: "base64",
            description:
                "a 200 returning inline base64 instead of urls — the other " +
                "array MiniMax uses for generated images",
            calls: [{
                req: { method: "POST", url: unit.doc.request.url },
                res: {
                    status: 200,
                    body: {
                        data: { image_base64: ["iVBORw0K", "iVBORw0L"] },
                        base_resp: { status_code: 0, status_msg: "success" },
                    },
                },
            }],
        },
    });
    assertEquals(result.usage.evidence, { RESULT: 2 });
});

Deno.test("minimax#image_generation: a fully blocked run bills nothing", async () => {
    const unit = await testSealedUnit(ID);
    const result = await runEndpoint({
        unit,
        input: { body: { prompt: "x", n: 2 } },
        mode: "replay",
        fixture: {
            name: "all-blocked",
            description:
                "a 200 with a clean envelope but an empty image array — " +
                "every image was blocked for content safety, so nothing " +
                "is billable",
            calls: [{
                req: { method: "POST", url: unit.doc.request.url },
                res: {
                    status: 200,
                    body: {
                        data: { image_urls: [] },
                        base_resp: { status_code: 0, status_msg: "success" },
                    },
                },
            }],
        },
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, { credits: {}, evidence: { RESULT: 0 } });
});

Deno.test("minimax#image_generation: unknown keys are rejected before any wire call", async () => {
    // `.strict()` survives compilation as additionalProperties:false — the
    // reason v1's provider-layer allowlist is not ported.
    const unit = await testSealedUnit(ID);
    assertEquals(
        (unit.doc.input.schema.body as Record<string, unknown>)
            .additionalProperties,
        false,
    );
});

Deno.test({
    name: "minimax#image_generation live (gated on MINIMAX_API_KEY)",
    ignore: liveSkip("minimax"),
    fn: async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit(ID),
            input: { body: { prompt: "a lighthouse at dusk", n: 1 } },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assertEquals(result.usage.evidence, { RESULT: 1 });
        assert(!("base_resp" in (result.output as Record<string, unknown>)));
    },
});
