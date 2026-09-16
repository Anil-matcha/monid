import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import {
    DEFAULT_T2A_MODEL,
    MAX_T2A_CHARS,
    zTextToSpeechBody,
} from "./schema/inputs.ts";

/**
 * MiniMax Text-to-Speech — `POST /v1/t2a_v2`, one blocking call.
 *
 * MODEL-DEPENDENT RATE AS A COMPOSITE (design D5): MiniMax prices T2A by
 * tier — $100/M characters for the `*-hd` models, $60/M for `*-turbo`. A
 * LEAF PER_UNIT carries exactly one rate, so the doc declares BOTH lines
 * and the fns route the character count to whichever the selected `model`
 * names. That is the D19 rule: selection is a COUNTING rule owned by the
 * fns, never a model shape. The unselected line carries no count at all —
 * it is absent from evidence, not zero.
 *
 * RATES ARE PER CHARACTER, not per million. `every` is a BLOCK rate — the
 * fold is `ceil(quantity / every) × amount` — so `$100` with
 * `every: 1_000_000` would round a 500-character run up to a whole block
 * and bill $100 for it. $0.0001 and $0.00006 with `every: 1` are the same
 * card, correctly folded.
 */
export default defineEndpoint({
    meta: {
        displayName: "MiniMax Text to Speech",
        summary: "Turn text into lifelike speech across hundreds of voices, " +
            "with emotion, pacing and voice-mixing control.",
        description: "Synthesize natural speech from up to 10,000 " +
            "characters of text. Pick any system, cloned or AI-designed " +
            "voice with 'voice_setting.voice_id', or blend up to four " +
            "voices with 'timbre_weights'. Control delivery through speed, " +
            "volume, pitch and 'emotion' (happy, sad, angry, fearful, " +
            "disgusted, surprised, calm, plus fluent and whisper on the " +
            "speech-2.6 models), insert timed pauses with <#1.5#>, override " +
            "pronunciations with 'pronunciation_dict', and post-process " +
            "with 'voice_modify'. 'audio_setting' controls sample rate, " +
            "bitrate, format and channels; 'subtitle_enable' returns a " +
            "timed subtitle file. The 'model' you choose IS the rate: the " +
            "'-hd' models bill $100 per million characters, the '-turbo' " +
            "models $60 per million, charged on MiniMax's own billed " +
            "character count. Returns a CDN URL that EXPIRES after 24 " +
            "hours.",
        docsUrl:
            "https://platform.minimax.io/docs/api-reference/text-to-speech",
        categories: ["speech"],
    },
    request: { method: "POST", path: "/v1/t2a_v2" },
    input: {
        schema: {
            // vendor-documented API defaults, applied at the binding (D25).
            // `model` matters most: it is the PRICING SELECTOR, so its
            // default here and the tier the fns below assume must be the
            // same constant, or a body omitting `model` would hold one
            // rate and settle another (design D5).
            body: zTextToSpeechBody.extend({
                model: zTextToSpeechBody.shape.model.unwrap()
                    .default(DEFAULT_T2A_MODEL),
                subtitle_enable: zTextToSpeechBody.shape.subtitle_enable
                    .unwrap().default(false),
                output_format: zTextToSpeechBody.shape.output_format.unwrap()
                    .default("url"),
                stream: zTextToSpeechBody.shape.stream.unwrap().default(false),
            }),
        },
    },
    usage: {
        /** Published audio card: $100 / M characters on hd, $60 / M on
         *  turbo — expressed per character so the fold is exact. */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                hd_character: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.CHARACTER,
                    consumes: { credit: "default", amount: 0.0001 },
                    label: "hd characters",
                    description:
                        "characters synthesized on a speech-*-hd model ($100 / M)",
                },
                turbo_character: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.CHARACTER,
                    consumes: { credit: "default", amount: 0.00006 },
                    label: "turbo characters",
                    description:
                        "characters synthesized on a speech-*-turbo model ($60 / M)",
                },
            },
        },
        /** The submitted text length IS the promisable quantity — MiniMax
         *  bills its own count, which can differ slightly, so the settle
         *  trues it up. Capped at the vendor ceiling, which the schema
         *  already enforces. */
        estimate: ({ data }) => {
            const model = data.input.body.model;
            const hd = model === "speech-2.8-hd" || model === "speech-2.6-hd" ||
                model === "speech-02-hd";
            const chars = Math.min(data.input.body.text.length, 10000);
            return {
                counts: hd
                    ? { "hd_character": chars }
                    : { "turbo_character": chars },
            };
        },
        /** THE settlement basis: MiniMax's OWN billed character count. A
         *  missing or unreadable stamp bills 0 characters, NEVER 1 (v1
         *  invariant) — an unmeasurable run is not a chargeable one. */
        evidence: ({ data, utils }) => {
            const model = data.input.body.model;
            const hd = model === "speech-2.8-hd" || model === "speech-2.6-hd" ||
                model === "speech-02-hd";
            const raw = utils.json.optionalNum(
                data.output,
                "$.extra_info.usage_characters",
            );
            const chars = raw !== undefined && raw > 0 ? Math.ceil(raw) : 0;
            return {
                counts: hd
                    ? { "hd_character": chars }
                    : { "turbo_character": chars },
            };
        },
    },
});

/** Re-exported for the test that pins the binding default against the
 *  tier the fns assume (design D5). */
export { DEFAULT_T2A_MODEL, MAX_T2A_CHARS };
