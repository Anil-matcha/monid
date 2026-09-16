import { assert, assertEquals } from "@std/assert";
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
const ID = "minimax#v1/video/minimax-hailuo-2.3";

const estimateFor = async (body: RunInput["body"]) => {
    const loaded = await new Engine({
        transport: directTransport({
            params: () => Promise.resolve({ apiKey: "test-key" }),
            fetch: () => Promise.reject(new Error("estimate must not do IO")),
        }),
    }).load(await testSealedUnit(ID));
    return loaded.estimate({ body });
};

const settle = async (body: RunInput["body"]) =>
    await runEndpoint({
        unit: await testSealedUnit(ID),
        input: { body },
        mode: "replay",
        fixture: await loadFixture(
            `${FIXTURES}synthetic-hailuo-succeeded.json`,
        ),
    });

/**
 * The published card, per finished video. These are NOT linear in duration
 * — 768P is $0.0467/s at 6s and $0.056/s at 10s — which is exactly why the
 * model is a composite of CELLS rather than a per-second line (design D4).
 */
const CELLS = [
    { body: {}, line: "768p_6s", price: 0.28 },
    { body: { duration: 10 }, line: "768p_10s", price: 0.56 },
    { body: { resolution: "1080P" }, line: "1080p_6s", price: 0.49 },
] as const;

Deno.test("minimax#hailuo-2.3: every published cell prices, at estimate and at settle", async () => {
    for (const cell of CELLS) {
        const body = { prompt: "a lighthouse beam", ...cell.body };

        const estimated = await estimateFor(body);
        assertEquals(estimated.evidence, { [cell.line]: 1 }, cell.line);
        assertEquals(estimated.credits, { default: cell.price }, cell.line);

        const settled = await settle(body);
        assertEquals(settled.httpStatus, 200, cell.line);
        assertEquals(settled.usage.evidence, { [cell.line]: 1 }, cell.line);
        assertEquals(
            settled.usage.credits,
            { default: cell.price },
            cell.line,
        );
    }
});

Deno.test("minimax#hailuo-2.3: the request IS the settlement basis", async () => {
    // The V1 task API reports no usage block at all, so estimate and settle
    // read the same coordinates and must agree exactly — there is nothing
    // for the settle to true up against (v1 `videoActualCost`).
    const body = { prompt: "x", resolution: "1080P" as const };
    const estimated = await estimateFor(body);
    const settled = await settle(body);
    assertEquals(estimated.evidence, settled.usage.evidence);
    assertEquals(estimated.credits, settled.usage.credits);
});

Deno.test("minimax#hailuo-2.3: the cell coordinates default to 768P/6s", async () => {
    const unit = await testSealedUnit(ID);
    const properties = (unit.doc.input.schema.body as Record<string, unknown>)
        .properties as Record<string, Record<string, unknown>>;
    assertEquals(properties.resolution.default, "768P");
    assertEquals(properties.duration.default, 6);
    // a body stating neither still prices — the estimate is never blind
    assertEquals((await estimateFor({ prompt: "x" })).evidence, {
        "768p_6s": 1,
    });
});

Deno.test({
    name: "minimax#hailuo-2.3 live (gated on MINIMAX_API_KEY)",
    ignore: liveSkip("minimax"),
    fn: async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit(ID),
            input: {
                body: {
                    prompt: "a lighthouse beam sweeping across fog [Pan left]",
                },
            },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assertEquals(result.usage.evidence, { "768p_6s": 1 });
        const output = result.output as Record<string, unknown>;
        assert(typeof output.download_url === "string");
    },
});
