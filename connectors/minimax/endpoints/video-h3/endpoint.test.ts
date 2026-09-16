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

/**
 * THE H3-family billing suite. One shared chain settles all four models —
 * its `task.usage` carries every basis they read (total_seconds,
 * output_seconds, input_seconds, input_image_count), and replay matches on
 * method+url only, so the differing `model` per endpoint does not matter.
 *
 * What differs between the four IS the rate card, so the expected figures
 * below are folded by hand from each doc's own model against that one
 * chain: total_seconds 21, output_seconds 6, input_seconds 15,
 * input_image_count 7.
 */

const FIXTURES = fromFileUrl(new URL("../../fixtures/", import.meta.url));

/** The engine's credits fold is plain float arithmetic — assert the rate,
 *  not the float (see the text-to-speech suite for the full note). */
const CENT = 1e-12;

const textContent = [{ type: "text", text: "a lighthouse beam sweeping fog" }];

const unitFor = (id: string) => testSealedUnit(id);

const estimateFor = async (id: string, body: RunInput["body"]) => {
    const loaded = await new Engine({
        transport: directTransport({
            params: () => Promise.resolve({ apiKey: "test-key" }),
            fetch: () => Promise.reject(new Error("estimate must not do IO")),
        }),
    }).load(await unitFor(id));
    return loaded.estimate({ body });
};

const settle = async (id: string, body: RunInput["body"]) =>
    await runEndpoint({
        unit: await unitFor(id),
        input: { body },
        mode: "replay",
        fixture: await loadFixture(`${FIXTURES}synthetic-h3-succeeded.json`),
    });

// ---------------------------------------------------------------------------
// MiniMax-H3 — one line per resolution on total_seconds, plus netted images
// ---------------------------------------------------------------------------

Deno.test("minimax#h3: bills total_seconds on the selected resolution plus netted images", async () => {
    const settled = await settle("minimax#v1/video/minimax-h3", {
        model: "MiniMax-H3",
        resolution: "768P",
        duration: 6,
        ratio: "16:9",
        content: textContent,
    });

    assertEquals(settled.httpStatus, 200);
    // 21 total seconds (6 generated + 15 reference video, same rate on
    // this model) and 7 submitted images, of which the first 5 are free
    assertEquals(settled.usage.evidence, {
        "768p_second": 21,
        "input_image": 2,
    });
    // 21 x $0.08 + 2 x $0.04 = $1.76
    assertAlmostEquals(settled.usage.credits.default, 1.76, CENT);
});

Deno.test("minimax#h3: the estimate holds duration plus the reference-video cap", async () => {
    const withRef = await estimateFor("minimax#v1/video/minimax-h3", {
        model: "MiniMax-H3",
        resolution: "2K",
        duration: 8,
        content: [
            ...textContent,
            {
                type: "video_url",
                video_url: { url: "https://example.com/ref.mp4" },
                role: "reference_video",
            },
        ],
    });
    // 8 generated + the upstream 15s reference cap, since the real clip
    // length is not knowable before the run
    assertEquals(withRef.evidence, { "2k_second": 23 });
    assertAlmostEquals(withRef.credits.default, 23 * 0.13, CENT);

    const withoutRef = await estimateFor("minimax#v1/video/minimax-h3", {
        model: "MiniMax-H3",
        resolution: "480P",
        duration: 4,
        ratio: "16:9",
        content: textContent,
    });
    assertEquals(withoutRef.evidence, { "480p_second": 4 });
});

Deno.test("minimax#h3: five input images are free, and the line is absent rather than zero", async () => {
    const images = (count: number) =>
        Array.from({ length: count }, (_, i) => ({
            type: "image_url",
            image_url: { url: `https://example.com/${i}.jpg` },
            role: "reference_image",
        }));

    const free = await estimateFor("minimax#v1/video/minimax-h3", {
        model: "MiniMax-H3",
        resolution: "480P",
        duration: 4,
        content: [...textContent, ...images(5)],
    });
    assertEquals(free.evidence, { "480p_second": 4 });
    assert(!("input_image" in free.evidence));

    const overage = await estimateFor("minimax#v1/video/minimax-h3", {
        model: "MiniMax-H3",
        resolution: "480P",
        duration: 4,
        content: [...textContent, ...images(8)],
    });
    assertEquals(overage.evidence, { "480p_second": 4, "input_image": 3 });
});

Deno.test("minimax#h3: a succeeded task reporting no seconds bills zero", async () => {
    // v1 invariant — an anomaly, logged and zero-billed, never guessed.
    const unit = await unitFor("minimax#v1/video/minimax-h3");
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                model: "MiniMax-H3",
                resolution: "768P",
                duration: 6,
                ratio: "16:9",
                content: textContent,
            },
        },
        mode: "replay",
        fixture: {
            name: "succeeded-no-usage",
            description:
                "a succeeded H3 task whose usage block reports no seconds " +
                "— the basis is unreadable, so nothing is billed",
            calls: [
                {
                    req: { method: "POST", url: unit.doc.request.url },
                    res: { status: 200, body: { task_id: "T" } },
                },
                {
                    req: {
                        method: "GET",
                        url: `${
                            new URL(unit.doc.request.url).origin
                        }/v2/query/video_generation/T`,
                    },
                    res: {
                        status: 200,
                        body: {
                            task: { status: "succeeded", usage: {} },
                        },
                    },
                },
            ],
        },
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, {
        credits: {},
        evidence: { "768p_second": 0 },
    });
});

// ---------------------------------------------------------------------------
// MiniMax-H3-Max — split output / input-video lines
// ---------------------------------------------------------------------------

Deno.test("minimax#h3-max: splits output seconds from input-video seconds", async () => {
    const settled = await settle("minimax#v1/video/minimax-h3-max", {
        model: "MiniMax-H3-Max",
        resolution: "768P",
        duration: 5,
        ratio: "16:9",
        content: textContent,
    });
    // the ONLY model whose input rate differs from its output rate, so it
    // reads output_seconds and input_seconds instead of total_seconds
    assertEquals(settled.usage.evidence, {
        "768p_output_second": 6,
        "768p_input_video_second": 15,
    });
    // 6 x $0.08 + 15 x $0.143 = $2.625
    assertAlmostEquals(settled.usage.credits.default, 2.625, CENT);
});

Deno.test("minimax#h3-max: does not bill input images at all", async () => {
    const unit = await unitFor("minimax#v1/video/minimax-h3-max");
    const components = Object.keys(
        (unit.doc.usage.model as { components: Record<string, unknown> })
            .components,
    );
    // MiniMax does not charge for input materials on this model, so a line
    // for them would be dead rate card
    assert(!components.includes("input_image"), components.join(", "));
});

// ---------------------------------------------------------------------------
// MiniMax-H3-Max-Turbo — output only
// ---------------------------------------------------------------------------

Deno.test("minimax#h3-max-turbo: bills total_seconds only, with no reference surface", async () => {
    const settled = await settle("minimax#v1/video/minimax-h3-max-turbo", {
        model: "MiniMax-H3-Max-Turbo",
        resolution: "768P",
        duration: 5,
        ratio: "16:9",
        content: textContent,
    });
    assertEquals(settled.usage.evidence, { "768p_second": 21 });
    // 21 x $0.04 = $0.84
    assertAlmostEquals(settled.usage.credits.default, 0.84, CENT);

    // the estimate never adds reference seconds: the model has no
    // reference roles, so the schema cannot express one
    const estimated = await estimateFor(
        "minimax#v1/video/minimax-h3-max-turbo",
        {
            model: "MiniMax-H3-Max-Turbo",
            resolution: "480P",
            duration: 5,
            ratio: "16:9",
            content: textContent,
        },
    );
    assertEquals(estimated.evidence, { "480p_second": 5 });
});

Deno.test("minimax#h3-max-turbo: rejects reference roles at validation", async () => {
    const unit = await unitFor("minimax#v1/video/minimax-h3-max-turbo");
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                model: "MiniMax-H3-Max-Turbo",
                resolution: "768P",
                duration: 5,
                ratio: "16:9",
                content: [
                    ...textContent,
                    {
                        type: "video_url",
                        video_url: { url: "https://example.com/ref.mp4" },
                        role: "reference_video",
                    },
                ],
            },
        },
        mode: "replay",
        fixture: await loadFixture(`${FIXTURES}synthetic-h3-succeeded.json`),
    }).catch((error: Error) => error);
    assert(result instanceof Error, "a reference item must not validate");
});

// ---------------------------------------------------------------------------
// MiniMax-H3-Fast — one resolution, images billed
// ---------------------------------------------------------------------------

Deno.test("minimax#h3-fast: bills 480P seconds plus netted images, and pins style at the wire", async () => {
    const settled = await settle("minimax#v1/video/minimax-h3-fast", {
        model: "MiniMax-H3-Fast",
        resolution: "480P",
        duration: 5,
        ratio: "16:9",
        content: textContent,
    });
    assertEquals(settled.usage.evidence, {
        "480p_second": 21,
        "input_image": 2,
    });
    // 21 x $0.046 + 2 x $0.04 = $1.046
    assertAlmostEquals(settled.usage.credits.default, 1.046, CENT);

    // `style` is upstream-required with no caller-facing meaning, so it is
    // injected by start and absent from the public contract
    const unit = await unitFor("minimax#v1/video/minimax-h3-fast");
    const properties = (unit.doc.input.schema.body as Record<string, unknown>)
        .properties as Record<string, unknown>;
    assert(!("style" in properties), "style must not be exposed");
});

// ---------------------------------------------------------------------------
// media URLs — public http(s) only, ENFORCED (design D6)
// ---------------------------------------------------------------------------

Deno.test("minimax#h3: the media-URL rule is a compiled pattern, not prose", async () => {
    // Regression for CodeRabbit PR #15 comment 4. v1 enforced this in a
    // superRefine, which z.toJSONSchema discards; a .regex() does NOT get
    // discarded, so the rule reaches the doc as a JSON Schema `pattern`
    // and the engine validates it before any request leaves.
    const unit = await unitFor("minimax#v1/video/minimax-h3");
    const item = (unit.doc.input.schema.body as Record<
        string,
        Record<
            string,
            Record<string, unknown>
        >
    >).properties.content.items as Record<string, unknown>;
    const variants = item.oneOf as Record<string, Record<string, unknown>>[];

    const patterns = variants.flatMap((variant) => {
        const properties = variant.properties as Record<
            string,
            Record<string, Record<string, Record<string, unknown>>>
        >;
        return ["image_url", "video_url", "audio_url"]
            .filter((key) => key in properties)
            .map((key) => properties[key].properties.url.pattern);
    });
    assertEquals(patterns.length, 3, "image, video and audio all carry it");
    for (const pattern of patterns) assertEquals(pattern, "^https?:\\/\\/");
});

Deno.test("minimax#h3: mm_file:// and data: are rejected before any wire call", async () => {
    const unit = await unitFor("minimax#v1/video/minimax-h3");
    // a transport that explodes proves validation ran FIRST
    const reject = (url: string) =>
        runEndpoint({
            unit,
            input: {
                body: {
                    model: "MiniMax-H3",
                    resolution: "768P",
                    duration: 6,
                    ratio: "16:9",
                    content: [
                        ...textContent,
                        {
                            type: "image_url",
                            image_url: { url },
                            role: "reference_image",
                        },
                    ],
                },
            },
            mode: "replay",
            fixture: {
                name: "never-reached",
                description:
                    "validation must reject the body before any call, so " +
                    "this chain is never served",
                calls: [{
                    req: { method: "POST", url: unit.doc.request.url },
                    res: { status: 200, body: { task_id: "NOPE" } },
                }],
            },
        }).catch((error: Error) => error);

    for (
        const url of [
            "mm_file://0123456789abcdef", // Monid's own uploaded files
            "MM_FILE://0123456789abcdef", // scheme is case-insensitive
            "data:image/jpeg;base64,AAAA", // inlines the asset
            "ftp://example.com/a.jpg",
        ]
    ) {
        assert(
            (await reject(url)) instanceof Error,
            `${url} must not validate`,
        );
    }

    // ...and the one accepted form still works
    const ok = await settle("minimax#v1/video/minimax-h3", {
        model: "MiniMax-H3",
        resolution: "768P",
        duration: 6,
        ratio: "16:9",
        content: [
            ...textContent,
            {
                type: "image_url",
                image_url: { url: "https://example.com/ref.jpg" },
                role: "reference_image",
            },
        ],
    });
    assertEquals(ok.httpStatus, 200);
});

// ---------------------------------------------------------------------------
// live
// ---------------------------------------------------------------------------

Deno.test({
    name: "minimax#h3-max-turbo live (gated on MINIMAX_API_KEY)",
    ignore: liveSkip("minimax"),
    fn: async () => {
        // the cheapest tier, so the live check costs ~$0.125
        const result = await runEndpoint({
            unit: await unitFor("minimax#v1/video/minimax-h3-max-turbo"),
            input: {
                body: {
                    model: "MiniMax-H3-Max-Turbo",
                    resolution: "480P",
                    duration: 5,
                    ratio: "16:9",
                    content: textContent,
                },
            },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assert(typeof result.usage.evidence["480p_second"] === "number");
        assert(result.usage.credits.default > 0);
    },
});
