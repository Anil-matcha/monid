import { assert, assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { RunInput } from "@shared/core";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

/**
 * THE minimax provider suite (fixture strategy v2): minimal shared shape
 * chains under fixtures/ exercise every endpoint of the provider. The
 * BLOCKING chains bind to any of the three sync endpoints via
 * {{request.url}}; the Hailuo and H3 chains additionally use
 * {{request.origin}} for their poll hops.
 *
 * What is pinned here is the PROTOCOL — provenance, envelope handling,
 * status synthesis, and the zero-billing guarantee. Per-endpoint billing
 * arithmetic lives in each endpoint's own test.
 */

const FIXTURES = fromFileUrl(new URL("./fixtures/", import.meta.url));

/** The three endpoints that inherit the provider's blocking start. */
const BLOCKING = [
    "minimax#v1/music_generation",
    "minimax#v1/image_generation",
    "minimax#v1/t2a_v2",
] as const;

/** The four H3 models — one chain settles all of them. */
const H3 = [
    "minimax#v1/video/minimax-h3",
    "minimax#v1/video/minimax-h3-max",
    "minimax#v1/video/minimax-h3-max-turbo",
    "minimax#v1/video/minimax-h3-fast",
] as const;

/** One schema-valid body per endpoint — the curated record-table inputs. */
const INPUTS: Record<string, RunInput["body"]> = {
    "minimax#v1/music_generation": {
        lyrics: "[Verse]\nthe tide came in slow\n[Chorus]\nand carried us home",
        prompt: "dreamy indie folk, acoustic guitar, soft female vocal",
    },
    "minimax#v1/image_generation": {
        prompt: "a lighthouse at dusk, long exposure",
        n: 3,
    },
    "minimax#v1/t2a_v2": {
        text: "The tide came in slow, and carried us home.",
        voice_setting: { voice_id: "English_Graceful_Lady" },
    },
    "minimax#v1/video/minimax-hailuo-2.3": {
        prompt: "a lighthouse beam sweeping across fog [Pan left]",
    },
    "minimax#v1/video/minimax-h3": {
        model: "MiniMax-H3",
        resolution: "768P",
        duration: 6,
        ratio: "16:9",
        content: [{ type: "text", text: "a lighthouse beam sweeping fog" }],
    },
    "minimax#v1/video/minimax-h3-max": {
        model: "MiniMax-H3-Max",
        resolution: "768P",
        duration: 5,
        ratio: "16:9",
        content: [{ type: "text", text: "a lighthouse beam sweeping fog" }],
    },
    "minimax#v1/video/minimax-h3-max-turbo": {
        model: "MiniMax-H3-Max-Turbo",
        resolution: "768P",
        duration: 5,
        ratio: "16:9",
        content: [{ type: "text", text: "a lighthouse beam sweeping fog" }],
    },
    "minimax#v1/video/minimax-h3-fast": {
        model: "MiniMax-H3-Fast",
        resolution: "480P",
        duration: 5,
        ratio: "16:9",
        content: [{ type: "text", text: "a lighthouse beam sweeping fog" }],
    },
};

const run = async (id: string, fixtureName: string) =>
    await runEndpoint({
        unit: await testSealedUnit(id),
        input: { body: INPUTS[id] },
        mode: "replay",
        fixture: await loadFixture(`${FIXTURES}${fixtureName}.json`),
    });

// ---------------------------------------------------------------------------
// provenance
// ---------------------------------------------------------------------------

Deno.test("minimax: all eight docs share ONE pool and the provider's fns", async () => {
    const ids = [...BLOCKING, "minimax#v1/video/minimax-hailuo-2.3", ...H3];
    const units = await Promise.all(ids.map((id) => testSealedUnit(id)));

    const fromResponse = units[0].doc.output.fromResponse?.$fn.key;
    const fromError = units[0].doc.output.fromError?.$fn.key;
    assert(fromResponse !== undefined, "provider fromResponse must resolve");
    assert(fromError !== undefined, "provider fromError must resolve");

    for (const unit of units) {
        // one pool, provider-declared, narrowed onto every doc (pdl D6)
        assertEquals(unit.doc.usage.credits, {
            default: { label: "US dollars" },
        });
        // MiniMax reports no meter — nothing to consolidate (design D2)
        assertEquals(unit.doc.usage.consolidate, undefined);
        // the presentation + error projections are the provider's, shared
        assertEquals(unit.doc.output.fromResponse?.$fn.key, fromResponse);
        assertEquals(unit.doc.output.fromError?.$fn.key, fromError);
    }
});

Deno.test("minimax: the blocking three share the provider start and carry NO pollMs; the video five poll", async () => {
    const blocking = await Promise.all(
        BLOCKING.map((id) => testSealedUnit(id)),
    );
    const startKey = blocking[0].doc.lifecycle?.start.$fn.key;
    assert(startKey !== undefined, "provider lifecycle.start must resolve");
    for (const unit of blocking) {
        assertEquals(unit.doc.lifecycle?.start.$fn.key, startKey);
        assertEquals(unit.doc.lifecycle?.poll, undefined);
        // pollMs is emitted iff lifecycle.poll resolves
        assertEquals(unit.doc.timeouts.pollMs, undefined);
    }

    const video = await Promise.all(
        ["minimax#v1/video/minimax-hailuo-2.3", ...H3].map((id) =>
            testSealedUnit(id)
        ),
    );
    for (const unit of video) {
        assert(unit.doc.lifecycle?.poll !== undefined, "video docs poll");
        assertEquals(unit.doc.timeouts.pollMs, 10_000);
        // each overrides the provider's blocking start
        assert(unit.doc.lifecycle?.start.$fn.key !== startKey);
        // no stop anywhere — MiniMax exposes no usable cancel
        assertEquals(unit.doc.lifecycle?.stop, undefined);
    }

    // the four H3 polls are byte-identical and intern to ONE fnTable entry
    const h3 = video.slice(1);
    const pollKeys = new Set(h3.map((u) => u.doc.lifecycle?.poll?.$fn.key));
    assertEquals(pollKeys.size, 1);
});

// ---------------------------------------------------------------------------
// the blocking relay
// ---------------------------------------------------------------------------

Deno.test("minimax blocking: a clean envelope settles 200 and strips the internals", async () => {
    const result = await run(
        "minimax#v1/image_generation",
        "synthetic-blocking-ok",
    );
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);

    const output = result.output as Record<string, unknown>;
    // the transport envelope is gone
    assertEquals("base_resp" in output, false);
    assertEquals("trace_id" in output, false);
    // ...and so are the billing-side counters, deeply
    const extra = output.extra_info as Record<string, unknown>;
    assertEquals("word_count" in extra, false);
    assertEquals("invisible_character_ratio" in extra, false);
    assertEquals("audio_size" in extra, false);
    // THE BASES SURVIVE: users must be able to check what they paid for
    assertEquals(extra.usage_characters, 1200);
    assertEquals(extra.audio_length, 12000);
});

Deno.test("minimax blocking: HTTP 200 + base_resp error becomes a 502 and bills NOTHING", async () => {
    for (const id of BLOCKING) {
        const result = await run(id, "synthetic-envelope-error");
        assertEquals(result.httpStatus, 502, id);
        // theirs was a 200 — ours is synthesized (design D12)
        assertEquals(result.providerHttpStatus, 200, id);
        assertEquals(result.isProviderError, true, id);
        // the whole point: a flat PER_CALL doc must NOT append its CALL 1
        assertEquals(result.usage, { credits: {}, evidence: {} }, id);
    }
});

Deno.test("minimax blocking: the music flat fee would otherwise ride an envelope error", async () => {
    // the counterfactual, pinned: the SAME doc on a clean envelope DOES
    // bill its flat $0.15 — so the 502 above is what keeps an auth or
    // balance failure free, not a quirk of the model.
    const ok = await run(
        "minimax#v1/music_generation",
        "synthetic-blocking-ok",
    );
    assertEquals(ok.usage, {
        credits: { default: 0.15 },
        evidence: { CALL: 1 },
    });
});

Deno.test("minimax blocking: a 200 with NO base_resp is a 502, not a bill", async () => {
    // Regression for CodeRabbit PR #15 comment 3. `optionalNum` returns
    // undefined only when the path is ABSENT, and v1 read that as success.
    // A malformed 200 would then reach the billing gate and the engine
    // would append music's flat CALL 1 — charging for a failure. ONLY
    // status_code 0 counts as success now (design D3).
    for (const id of BLOCKING) {
        const unit = await testSealedUnit(id);
        const result = await runEndpoint({
            unit,
            input: { body: INPUTS[id] },
            mode: "replay",
            fixture: {
                name: "no-base-resp",
                description:
                    "a 200 whose body carries no base_resp at all — a " +
                    "malformed success envelope that must not be billed",
                calls: [{
                    req: { method: "POST", url: unit.doc.request.url },
                    res: {
                        status: 200,
                        body: { error: "upstream timeout" },
                    },
                }],
            },
        });
        assertEquals(result.httpStatus, 502, id);
        assertEquals(result.providerHttpStatus, 200, id);
        assertEquals(result.isProviderError, true, id);
        assertEquals(result.usage, { credits: {}, evidence: {} }, id);
    }
});

Deno.test("minimax blocking: a transport 401 is data, zero usage, digested", async () => {
    const result = await run("minimax#v1/t2a_v2", "synthetic-http-error");
    assertEquals(result.httpStatus, 401);
    // relayed verbatim — nothing was synthesized
    assertEquals(result.providerHttpStatus, undefined);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });

    const output = result.output as Record<string, unknown>;
    assertEquals(output.message, "invalid api key");
    assertEquals(output.type, "invalid_request_error");
    assert("raw" in output, "the raw body is kept, never hidden");
});

// ---------------------------------------------------------------------------
// the Hailuo V1 chain
// ---------------------------------------------------------------------------

Deno.test("minimax hailuo: submit -> poll -> poll -> files/retrieve settles a download url", async () => {
    const result = await run(
        "minimax#v1/video/minimax-hailuo-2.3",
        "synthetic-hailuo-succeeded",
    );
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    assertEquals(result.output, {
        task_id: "TASK1",
        file_id: "FILE1",
        download_url: "https://cdn.minimax.io/video/TASK1.mp4",
        video_width: 1366,
        video_height: 768,
        filename: "MiniMax-Hailuo-2.3-TASK1.mp4",
        bytes: 2318844,
    });
    // default cell: 768P / 6s
    assertEquals(result.usage, {
        credits: { default: 0.28 },
        evidence: { "768p_6s": 1 },
    });
});

Deno.test("minimax hailuo: an unrecognized status keeps polling, it does not settle", async () => {
    // Regression for CodeRabbit PR #15 comment 2. The chain answers
    // "Queued" (a spelling we do not handle), then a 200 with no status at
    // all, then Success. Both unknown ticks must be treated as in-flight;
    // before the guard they fell into the Success path, found no file_id,
    // and ended a live task with a synthesized 502.
    const result = await run(
        "minimax#v1/video/minimax-hailuo-2.3",
        "synthetic-hailuo-unknown-status",
    );
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    assertEquals(
        (result.output as Record<string, unknown>).download_url,
        "https://cdn.minimax.io/video/TASK3.mp4",
    );
    // and it still bills the cell the request selected
    assertEquals(result.usage.evidence, { "768p_6s": 1 });
});

Deno.test("minimax hailuo: a failed task synthesizes 500 and bills nothing", async () => {
    const result = await run(
        "minimax#v1/video/minimax-hailuo-2.3",
        "synthetic-hailuo-failed",
    );
    assertEquals(result.httpStatus, 500);
    assertEquals(result.providerHttpStatus, 200);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

// ---------------------------------------------------------------------------
// the H3 V2 chain
// ---------------------------------------------------------------------------

Deno.test("minimax h3: submit -> running -> succeeded settles the task envelope", async () => {
    const result = await run(
        "minimax#v1/video/minimax-h3",
        "synthetic-h3-succeeded",
    );
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);

    const task = (result.output as Record<string, Record<string, unknown>>)
        .task;
    const usage = task.usage as Record<string, unknown>;
    // token accounting stripped...
    assertEquals("total_tokens" in usage, false);
    assertEquals("prompt_tokens" in usage, false);
    assertEquals("completion_tokens" in usage, false);
    // ...bases kept
    assertEquals(usage.total_seconds, 21);
    assertEquals(usage.input_image_count, 7);
});

Deno.test("minimax h3: a failed task synthesizes 500 and bills nothing, on every model", async () => {
    for (const id of H3) {
        const result = await run(id, "synthetic-h3-failed");
        assertEquals(result.httpStatus, 500, id);
        assertEquals(result.providerHttpStatus, 200, id);
        assertEquals(result.isProviderError, true, id);
        assertEquals(result.usage, { credits: {}, evidence: {} }, id);
    }
});
