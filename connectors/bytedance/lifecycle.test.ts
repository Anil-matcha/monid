import { assert, assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { assembleUsage, type Json, type RunInput } from "@shared/core";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testBundle,
    testSealedUnit,
} from "@shared/testing";
import { directTransport, Engine } from "@monid/connector-engine";

/**
 * THE bytedance test suite (fixture strategy v2): six minimal shared chains
 * in `fixtures/` exercise every endpoint of the provider. `{{request.url}}` /
 * `{{request.origin}}` bind each chain to the endpoint under test, and every
 * Seedance model posts to the SAME create-task path and polls the SAME task
 * path — so one recorded chain genuinely serves all four.
 *
 * The happy and reference-video chains are LIVE RECORDINGS (real generations
 * on seedance-2.0-mini at 480p/4s); the three failure shapes and the poll-5xx
 * shape are synthetic, because Ark does not hand out failures on request.
 *
 * Because the chains are shared, the settled TOKEN COUNT is the same for every
 * endpoint — what differs per endpoint is the RATE, so each expectation is
 * folded from that doc's own model via `assembleUsage`. That is the point: the
 * fold is re-derivable from the doc by anyone holding it (design D26).
 */

const HERE = fromFileUrl(new URL("./", import.meta.url));
const INPUTS = JSON.parse(
    await Deno.readTextFile(`${HERE}test-inputs.json`),
) as Record<string, RunInput["body"]>;

/** Tokens the recorded chains settle (the vendor's own meter). */
const PLAIN_TOKENS = 40594;
const REF_VIDEO_TOKENS = 80770;

const endpointIds = async (): Promise<string[]> => {
    const bundle = await testBundle();
    return Object.keys(bundle.endpoints)
        .filter((id) => id.startsWith("bytedance#"))
        .sort();
};

const inputFor = (id: string): RunInput => {
    const body = INPUTS[id.split("#")[1]];
    assert(body !== undefined, `${id}: no test input in test-inputs.json`);
    return { body };
};

/** The same input plus a reference video — flips the billed rate column. */
const refVideoInput = (id: string): RunInput => {
    const body = inputFor(id).body as Record<string, Json>;
    return {
        body: {
            ...body,
            content: [
                ...(body.content as Json[]),
                {
                    type: "video_url",
                    video_url: { url: "https://example.test/clip.mp4" },
                    role: "reference_video",
                },
            ],
        },
    };
};

Deno.test("bytedance: every endpoint completes the happy chain, folded at its OWN rate", async () => {
    const fixture = await loadFixture(`${HERE}fixtures/task-succeeded.json`);
    const bundle = await testBundle();
    for (const id of await endpointIds()) {
        const result = await runEndpoint({
            unit: await testSealedUnit(id),
            input: inputFor(id),
            mode: "replay",
            fixture,
        });
        assertEquals(result.httpStatus, 200, id);
        assertEquals(result.isProviderError, false, id);
        // The test inputs all request 480p, and none carries a reference
        // video, so every doc settles the vendor's meter on its own "480p"
        // line. The credits are NOT hardcoded — they are folded from the
        // doc's own rate card, which is exactly how a consumer re-derives
        // the bill (design D26).
        const expected = assembleUsage(bundle.endpoints[id].usage.model!, {
            "480p": PLAIN_TOKENS,
        });
        assertEquals(result.usage, {
            credits: expected.credits,
            evidence: { "480p": PLAIN_TOKENS },
        }, id);
        // Ark reports no monetary total, so the derived fold is the ONLY
        // settlement path — an empty vendor claim never raises a mismatch.
        assert(!("mismatch" in result.usage), id);
        // D27 strip: the billing field does not ride the payload…
        const output = result.output as Record<string, unknown>;
        assert(!("usage" in output), `${id}: usage stripped from output`);
        // …but everything the caller actually wants survives untouched.
        assertEquals(output.status, "succeeded", id);
        assert(
            (output.content as Record<string, string>).video_url.length > 0,
            id,
        );
        // engine-stamped timing: one still-running poll + the terminal one
        assertEquals(result.timing.attempts, 2, id);
    }
});

Deno.test("bytedance: a reference video bills the vendor's SECOND rate column", async () => {
    const fixture = await loadFixture(
        `${HERE}fixtures/task-succeeded-ref-video.json`,
    );
    const bundle = await testBundle();
    for (const id of await endpointIds()) {
        const result = await runEndpoint({
            unit: await testSealedUnit(id),
            input: refVideoInput(id),
            mode: "replay",
            fixture,
        });
        assertEquals(result.httpStatus, 200, id);
        const model = bundle.endpoints[id].usage.model!;
        const expected = assembleUsage(model, {
            "480p_with_video": REF_VIDEO_TOKENS,
        });
        assertEquals(result.usage, {
            credits: expected.credits,
            evidence: { "480p_with_video": REF_VIDEO_TOKENS },
        }, id);
        // The line is chosen from the REQUEST (design D4) — nothing in the
        // recorded task body says "this run had a reference video".
        assert(
            model.kind === "COMPOSITE" &&
                model.components["480p_with_video"].consumes.amount <
                    model.components["480p"].consumes.amount,
            `${id}: the with-video column must be the cheaper one`,
        );
    }
});

Deno.test("bytedance: modelling ONE rate column would have overcharged the recorded run", async () => {
    // Guards design D2 with the live numbers rather than an argument. v1
    // billed every run at the no-video column; on this real recording that is
    // a ~67% overcharge against what BytePlus actually charges.
    const bundle = await testBundle();
    const model = bundle.endpoints["bytedance#seedance-2.0-mini"].usage.model!;
    assert(model.kind === "COMPOSITE");
    const actual = REF_VIDEO_TOKENS *
        model.components["480p_with_video"].consumes.amount;
    const v1Style = REF_VIDEO_TOKENS * model.components["480p"].consumes.amount;
    assertEquals(Number(actual.toFixed(6)), 0.169617);
    assertEquals(Number(v1Style.toFixed(6)), 0.282695);
    assert(v1Style / actual > 1.66);
});

Deno.test("bytedance: task failure → synthesized 500, zero usage, digested error", async () => {
    const fixture = await loadFixture(
        `${HERE}fixtures/synthetic-task-failed.json`,
    );
    const id = "bytedance#seedance-2.0";
    const result = await runEndpoint({
        unit: await testSealedUnit(id),
        input: inputFor(id),
        mode: "replay",
        fixture,
    });
    assertEquals(result.isProviderError, true);
    assertEquals(result.httpStatus, 500); // OURS — the TASK failed
    assertEquals(result.providerHttpStatus, 200); // THEIRS — the GET was fine
    assertEquals(result.usage, { credits: {}, evidence: {} });
    const output = result.output as Record<string, unknown>;
    assertEquals(output.message, "generation failed, please try again");
    assertEquals(output.code, "InternalServiceError");
    assert("raw" in output); // digest, never hide
});

Deno.test("bytedance: success with no video_url → synthesized 502, zero usage", async () => {
    const fixture = await loadFixture(
        `${HERE}fixtures/synthetic-task-no-video-url.json`,
    );
    const id = "bytedance#seedance-2.5";
    const result = await runEndpoint({
        unit: await testSealedUnit(id),
        input: inputFor(id),
        mode: "replay",
        fixture,
    });
    assertEquals(result.isProviderError, true);
    assertEquals(result.httpStatus, 502);
    assertEquals(result.providerHttpStatus, 200);
    // The chain's task body DOES carry a usage block: the zero-bill comes
    // from the error path (a fn cannot bill an error), not from a missing
    // meter.
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test("bytedance: rejected submit is DATA — vendor status, zero usage, unwrapped envelope", async () => {
    const fixture = await loadFixture(`${HERE}fixtures/submit-rejected.json`);
    const id = "bytedance#seedance-2.0-mini";
    const result = await runEndpoint({
        unit: await testSealedUnit(id),
        input: inputFor(id),
        mode: "replay",
        fixture,
    });
    assertEquals(result.isProviderError, true);
    assertEquals(result.httpStatus, 400);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    // Ark buries the message at error.message; fromError lifts it so clients
    // do not have to know the envelope (design D12).
    const output = result.output as Record<string, unknown>;
    assertEquals(output.code, "InvalidParameter");
    assert(
        (output.message as string).includes("is not valid: resource not found"),
    );
});

Deno.test("bytedance: a failing poll THROWS rather than abandoning a paid generation", async () => {
    const fixture = await loadFixture(
        `${HERE}fixtures/synthetic-poll-failed.json`,
    );
    const id = "bytedance#seedance-2.0-mini";
    const unit = await testSealedUnit(id);
    // Design D7: retriable infrastructure failure, NOT a settled provider
    // error — the task is still running and still billing upstream.
    await assertRejects(
        () =>
            runEndpoint({ unit, input: inputFor(id), mode: "replay", fixture }),
        Error,
        "503",
    );
});

/** Estimates are PURE — a transport that rejects proves no IO happens. */
async function estimateFor(id: string, body: Json) {
    const engine = new Engine({
        transport: directTransport({
            params: () => Promise.resolve({ apiKey: "test-key" }),
            fetch: () => Promise.reject(new Error("estimate must not do IO")),
        }),
    });
    const loaded = await engine.load(await testSealedUnit(id));
    return loaded.estimate({ body });
}

Deno.test("bytedance: estimates are deduced from the vendor's token formula", async () => {
    const text = [{ type: "text", text: "a sea lion plays with a cat" }];
    // 720p 16:9 × 5s = 1280×720×24×5/1024 = 108,000 tokens (the published
    // BytePlus worked example), at 2.0's $7.00/1M = $0.756.
    assertEquals(
        await estimateFor("bytedance#seedance-2.0", { content: text }),
        { credits: { default: 0.756 }, evidence: { "720p": 108000 } },
    );

    // 4K 21:9 × 10s — the ratio table is consulted, not assumed 16:9.
    const uhd = await estimateFor("bytedance#seedance-2.0", {
        content: text,
        resolution: "4k",
        ratio: "21:9",
        duration: 10,
    });
    assertEquals(uhd.evidence, { "4k": 1944053 });

    // A reference video moves the estimate to the cheaper column BEFORE the
    // run, so the hold matches what the vendor will actually charge.
    const ref = await estimateFor("bytedance#seedance-2.0", {
        content: [...text, {
            type: "video_url",
            video_url: { url: "https://example.test/clip.mp4" },
            role: "reference_video",
        }],
    });
    assertEquals(ref.evidence, { "720p_with_video": 108000 });

    // "auto" defers the LENGTH to the model, so the estimate must reserve the
    // worst case it may pick (30s), not collapse to the 5s default. v1 shipped
    // `Number("auto")` here — NaN — and under-held a 30s run by ~6×.
    const auto = await estimateFor("bytedance#seedance-2.5", {
        content: text,
        duration: "auto",
    });
    assertEquals(auto.evidence, { "720p": 648000 });
});

Deno.test("bytedance: the input schema rejects before the wire", async () => {
    const text = [{ type: "text", text: "a cat" }];
    const rejects = async (body: Json, why: string) => {
        await assertRejects(
            () => estimateFor("bytedance#seedance-2.5", body),
            Error,
            "INVALID_INPUT",
            why,
        );
    };
    // `.strict()` survives compilation — v1's excluded knobs stay excluded
    await rejects({ content: text, seed: 42 }, "unknown key");
    // a resolution 2.5 does not serve (and has no rate line for)
    await rejects({ content: text, resolution: "4k" }, "unserved resolution");
    // past this model's 30s ceiling
    await rejects({ content: text, duration: 45 }, "duration over the cap");
    // "auto" is a NAMED mode; the raw Ark sentinel is not accepted
    await rejects({ content: text, duration: -1 }, "raw -1 sentinel");
    // content must not be empty — the one cross-item rule JSON Schema keeps
    await rejects({ content: [] }, "empty content");

    // Reference URLs: the schema promises a public https:// URL, so it has to
    // ENFORCE one. `.regex()` compiles to a JSON Schema `pattern` (a
    // `.refine()` would be silently dropped), which is what makes these four
    // fail locally instead of on Ark's dime.
    const withUrl = (url: string): Json => ({
        content: [{ type: "image_url", image_url: { url } }],
    });
    await rejects(
        withUrl("data:image/png;base64,iVBOR"),
        "inline base64 data: URL",
    );
    await rejects(withUrl("asset://abc123"), "asset:// reference");
    await rejects(withUrl("http://example.test/a.png"), "plain http://");
    await rejects(withUrl("not-a-url"), "malformed reference URL");
});

Deno.test({
    name:
        "bytedance#seedance-2.0-mini live: generates a real video and bills actual tokens",
    ignore: liveSkip("bytedance"),
    fn: async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit("bytedance#seedance-2.0-mini"),
            input: {
                body: {
                    content: [{ type: "text", text: "a cat on a beach" }],
                    resolution: "480p",
                    duration: 4,
                },
            },
            mode: "live",
        });
        assertEquals(result.httpStatus, 200);
        const output = result.output as Record<string, unknown>;
        assert((output.content as Record<string, string>).video_url);
        assert(!("usage" in output), "the meter is stripped from the payload");
        // Real generations vary in token count, so assert the SHAPE: the
        // no-video line billed, and a positive charge derived from it.
        assertEquals(Object.keys(result.usage.evidence), ["480p"]);
        assert(result.usage.evidence["480p"] > 0);
        assert(result.usage.credits.default > 0);
    },
});
