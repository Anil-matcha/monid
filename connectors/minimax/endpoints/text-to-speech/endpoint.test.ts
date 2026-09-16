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
import {
    DEFAULT_T2A_MODEL,
    MAX_T2A_CHARS,
    MINIMAX_HD_MODELS,
    MINIMAX_T2A_MODELS,
} from "./schema/inputs.ts";

const FIXTURES = fromFileUrl(
    new URL("../../fixtures/", import.meta.url),
);

const ID = "minimax#v1/t2a_v2";

/** The shared blocking chain reports extra_info.usage_characters: 1200. */
const CHAIN_CHARS = 1200;

const speak = async (body: RunInput["body"]) =>
    await runEndpoint({
        unit: await testSealedUnit(ID),
        input: { body },
        mode: "replay",
        fixture: await loadFixture(`${FIXTURES}synthetic-blocking-ok.json`),
    });

/** estimate is PURE — a transport that rejects proves no IO happens. */
const estimateFor = async (body: RunInput["body"]) => {
    const loaded = await new Engine({
        transport: directTransport({
            params: () => Promise.resolve({ apiKey: "test-key" }),
            fetch: () => Promise.reject(new Error("estimate must not do IO")),
        }),
    }).load(await testSealedUnit(ID));
    return loaded.estimate({ body });
};

/**
 * The engine's credits fold (`creditsOf`) is plain float arithmetic, so a
 * per-character rate lands within ~1e-16 of the exact figure rather than on
 * it (1200 x 0.00006 = 0.07200000000000001). That is far inside the 1e-9
 * the mismatch signal treats as agreement, and hosted settlement converts
 * to the integer micro-dollar canon anyway — so the tests assert the rate,
 * not the float. EVIDENCE is exact and asserted exactly.
 */
const CENT = 1e-12;

Deno.test("minimax#t2a_v2: an hd model routes the count to the hd line", async () => {
    const result = await speak({
        model: "speech-2.8-hd",
        text: "The tide came in slow.",
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage.evidence, { hd_character: CHAIN_CHARS });
    // 1200 characters x $0.0001 = $0.12
    assertAlmostEquals(result.usage.credits.default, 0.12, CENT);
    // the unselected line is ABSENT, not zero
    assert(!("turbo_character" in result.usage.evidence));
});

Deno.test("minimax#t2a_v2: a turbo model routes the count to the turbo line", async () => {
    const result = await speak({
        model: "speech-2.8-turbo",
        text: "The tide came in slow.",
    });
    assertEquals(result.usage.evidence, { turbo_character: CHAIN_CHARS });
    // 1200 characters x $0.00006 = $0.072
    assertAlmostEquals(result.usage.credits.default, 0.072, CENT);
    assert(!("hd_character" in result.usage.evidence));
});

Deno.test("minimax#t2a_v2: the binding default IS the pricing selector (design D5)", async () => {
    // The constant the schema defaults to and the tier the fns assume must
    // be the same, or a body omitting `model` holds one rate and settles
    // another. Pin both halves.
    const unit = await testSealedUnit(ID);
    const body = unit.doc.input.schema.body as Record<string, unknown>;
    const properties = body.properties as Record<
        string,
        Record<string, unknown>
    >;
    assertEquals(properties.model.default, DEFAULT_T2A_MODEL);
    assert(
        !(MINIMAX_HD_MODELS as readonly string[]).includes(DEFAULT_T2A_MODEL),
        "the default is a turbo model",
    );

    // ...and a body with no `model` settles on the turbo line.
    const result = await speak({ text: "The tide came in slow." });
    assertEquals(result.usage.evidence, { turbo_character: CHAIN_CHARS });
});

Deno.test("minimax#t2a_v2: a missing usage_characters bills 0, never 1", async () => {
    // v1 invariant: an unmeasurable run is not a chargeable one.
    const unit = await testSealedUnit(ID);
    const result = await runEndpoint({
        unit,
        input: { body: { text: "hello" } },
        mode: "replay",
        fixture: {
            name: "no-usage",
            description:
                "a 200 whose envelope carries no extra_info at all — the " +
                "character basis is unreadable, so nothing is billed",
            calls: [{
                req: { method: "POST", url: unit.doc.request.url },
                res: {
                    status: 200,
                    body: {
                        data: { audio: "https://cdn.minimax.io/a.mp3" },
                        base_resp: { status_code: 0, status_msg: "success" },
                    },
                },
            }],
        },
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, {
        credits: {},
        evidence: { turbo_character: 0 },
    });
});

Deno.test("minimax#t2a_v2: the estimate holds the submitted length on the selected tier", async () => {
    const text = "x".repeat(2500);
    assertEquals(
        (await estimateFor({ model: "speech-02-hd", text })).evidence,
        { hd_character: 2500 },
    );
    assertEquals(
        (await estimateFor({ text })).evidence,
        { turbo_character: 2500 },
    );
});

/**
 * THE drift guard for the tier routing (CodeRabbit PR #15, comment 1).
 *
 * `estimate` and `evidence` name the hd models as INLINE LITERALS, and they
 * have to: hook fns are closed terms (shared/compiler/lint.ts) and may
 * reference only their own parameters/locals plus a fixed global
 * whitelist — importing `MINIMAX_HD_MODELS` into a fn body fails the build
 * with "fn is not a closed term".
 *
 * So the coupling lives HERE instead, where imports are legal: adding a
 * model to the schema enum without teaching BOTH fns about it now fails
 * this test, rather than silently routing an hd model to the cheaper turbo
 * line and under-billing it.
 */
Deno.test("minimax#t2a_v2: EVERY accepted model routes to the right tier", async () => {
    // guards the test itself: if a model is ever added to neither list the
    // expectation below would silently become "turbo" for it
    assertEquals(
        MINIMAX_T2A_MODELS.length,
        MINIMAX_HD_MODELS.length * 2,
        "the enum is expected to be an even hd/turbo split",
    );

    for (const model of MINIMAX_T2A_MODELS) {
        const expected =
            (MINIMAX_HD_MODELS as readonly string[]).includes(model)
                ? "hd_character"
                : "turbo_character";
        const { evidence } = await estimateFor({
            model,
            text: "x".repeat(100),
        });
        assertEquals(
            Object.keys(evidence),
            [expected],
            `${model} must bill on ${expected}`,
        );
        assertEquals(evidence[expected], 100, model);
    }
});

Deno.test("minimax#t2a_v2: the estimate's inline ceiling tracks MAX_T2A_CHARS", () => {
    // the fns clamp with a literal 10000 for the same closed-term reason.
    // If the constant moves, this fails and the literals must move with it.
    assertEquals(MAX_T2A_CHARS, 10000);
});

Deno.test({
    name: "minimax#t2a_v2 live (gated on MINIMAX_API_KEY)",
    ignore: liveSkip("minimax"),
    fn: async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit(ID),
            input: {
                body: {
                    text: "Monid connector live check.",
                    voice_setting: { voice_id: "English_Graceful_Lady" },
                },
            },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        // MiniMax bills its OWN character count, which differs slightly from
        // the submitted length — assert the line settled, not a figure.
        assert(typeof result.usage.evidence.turbo_character === "number");
        assert(result.usage.credits.default > 0);
    },
});
