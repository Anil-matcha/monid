import { assert, assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { RunInput } from "@shared/core";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testBundle,
    testSealedUnit,
} from "@shared/testing";

/**
 * THE suzanne suite (fixture strategy v2): provider-level shared chains under
 * `fixtures/`, bound to whichever endpoint is under test via
 * `{{request.url}}` / `{{request.origin}}`, with one schema-valid input per
 * endpoint in `test-inputs.json`.
 *
 * Suzanne is the first MIXED-MODE provider, so the suite's job is to prove
 * the seam: the two generation docs inherit the async lifecycle, the two
 * utilities override `start`, and all four settle their own flat draw.
 */

const HERE = fromFileUrl(new URL("./", import.meta.url));
const INPUTS = JSON.parse(
    await Deno.readTextFile(`${HERE}test-inputs.json`),
) as Record<string, RunInput>;

const GENERATIONS = [
    "suzanne#v1/generations/text-to-3d",
    "suzanne#v1/generations/photo-to-3d",
] as const;

const inputFor = (id: string): RunInput => {
    const input = INPUTS[id.split("#")[1]];
    assert(input !== undefined, `${id}: no test input in test-inputs.json`);
    return input;
};

const fixture = (name: string) => loadFixture(`${HERE}fixtures/${name}.json`);

// ---------------------------------------------------------------------------
// the async pair
// ---------------------------------------------------------------------------

Deno.test("suzanne: both generations park, poll to done, and bill the flat $0.65", async () => {
    for (const id of GENERATIONS) {
        const result = await runEndpoint({
            unit: await testSealedUnit(id),
            input: inputFor(id),
            mode: "replay",
            fixture: await fixture("synthetic-job-succeeded"),
        });
        assertEquals(result.httpStatus, 200, id);
        assertEquals(result.isProviderError, false, id);
        // flat model: the engine appends the reserved CALL line and folds
        // 1 × $0.65. The two outputs[] entries never move the bill.
        assertEquals(
            result.usage,
            { credits: { default: 0.65 }, evidence: { CALL: 1 } },
            id,
        );
        const output = result.output as {
            status: string;
            outputs: Array<{ format: string; download_url: string }>;
        };
        assertEquals(output.status, "done", id);
        assertEquals(output.outputs.length, 2, id);
    }
});

Deno.test("suzanne: a failed job is a synthesized 500 carrying the job's own error, zero-billed", async () => {
    for (const id of GENERATIONS) {
        const result = await runEndpoint({
            unit: await testSealedUnit(id),
            input: inputFor(id),
            mode: "replay",
            fixture: await fixture("synthetic-job-failed"),
        });
        // OURS 500 (the JOB failed) / THEIRS 200 (the poll exchange was fine)
        assertEquals(result.httpStatus, 500, id);
        assertEquals(result.isProviderError, true, id);
        // the vendor refunds vendor_model_error; the engine zero-bills it
        assertEquals(result.usage, { credits: {}, evidence: {} }, id);
        const output = result.output as Record<string, unknown>;
        // fromError digested the job's FLAT {code, message} shape
        assertEquals(
            output.message,
            "The upstream model produced no mesh for this prompt.",
            id,
        );
        assertEquals(output.code, "vendor_model_error", id);
        assert(output.raw !== undefined, `${id}: the raw body is kept`);
    }
});

Deno.test("suzanne: a rejected submit never starts a job — error-as-data, zero usage", async () => {
    for (const id of GENERATIONS) {
        const result = await runEndpoint({
            unit: await testSealedUnit(id),
            input: inputFor(id),
            mode: "replay",
            fixture: await fixture("synthetic-start-rejected"),
        });
        assertEquals(result.httpStatus, 409, id);
        assertEquals(result.isProviderError, true, id);
        assertEquals(result.usage, { credits: {}, evidence: {} }, id);
        const output = result.output as Record<string, unknown>;
        // fromError digested the API's NESTED envelope, request_id included
        assertEquals(output.code, "concurrent_limit_reached", id);
        assertEquals(output.type, "rate_limit", id);
        assertEquals(output.request_id, "req_01HZYXR8N3K2P5Q7", id);
    }
});

Deno.test("suzanne: a 2xx submit without a job_id is a contract violation, not a billed success", async () => {
    // The dangerous shape: a 2xx that started nothing. Settling it would bill
    // $0.65 for an empty answer, so start THROWS (v1 parity).
    const unit = await testSealedUnit(GENERATIONS[0]);
    await assertRejects(
        () =>
            runEndpoint({
                unit,
                input: inputFor(GENERATIONS[0]),
                mode: "replay",
                fixture: {
                    name: "no-job-id",
                    description:
                        "A 2xx submit that returns no job_id — Suzanne contract violation.",
                    calls: [{
                        req: { method: "POST", url: unit.doc.request.url },
                        res: { status: 202, body: { status: "queued" } },
                    }],
                },
            }),
        Error,
        "job_id",
    );
});

// ---------------------------------------------------------------------------
// the sync pair
// ---------------------------------------------------------------------------

Deno.test("suzanne#v1/uploads: one POST, completed inline, flat $0.01", async () => {
    const result = await runEndpoint({
        unit: await testSealedUnit("suzanne#v1/uploads"),
        input: inputFor("suzanne#v1/uploads"),
        mode: "replay",
        fixture: await fixture("synthetic-upload-created"),
    });
    assertEquals(result.httpStatus, 201);
    assertEquals(result.isProviderError, false);
    assertEquals(result.usage, {
        credits: { default: 0.01 },
        evidence: { CALL: 1 },
    });
    const output = result.output as Record<string, string>;
    assertEquals(output.upload_id, "upl_01HZYXB4M2N7K9Q3R5T8V1WXYZ");
    assert(output.upload_url.startsWith("https://"));
});

Deno.test("suzanne#v1/models/download: the 302 Location becomes download_url, free", async () => {
    const result = await runEndpoint({
        unit: await testSealedUnit("suzanne#v1/models/download"),
        input: inputFor("suzanne#v1/models/download"),
        mode: "replay",
        fixture: await fixture("synthetic-download-redirect"),
    });
    // OURS 200 (the redirect IS the success) / THEIRS 302
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    const output = result.output as { download_url: string };
    // assert on the PARSED url, never a substring: a prefix test would also
    // accept `https://api.suzanne3d.com.example.test/…`, so it proves less
    // than it reads (CodeQL js/incomplete-url-substring-sanitization)
    const url = new URL(output.download_url);
    assertEquals(
        url.hostname,
        "suzanne-meshes.s3.amazonaws.com",
        "the caller is sent to S3 directly, not back to the authenticated API",
    );
    assertEquals(
        url.searchParams.has("X-Amz-Signature"),
        true,
        "the presigned signature is handed over verbatim — no credential needed",
    );
});

Deno.test("suzanne#v1/models/download: a 3xx without Location is a visible error, never a silent success", async () => {
    const result = await runEndpoint({
        unit: await testSealedUnit("suzanne#v1/models/download"),
        input: inputFor("suzanne#v1/models/download"),
        mode: "replay",
        fixture: await fixture("synthetic-download-opaque-redirect"),
    });
    assertEquals(result.httpStatus, 302);
    assertEquals(result.isProviderError, true);
    const output = result.output as Record<string, unknown>;
    assertEquals(output.message, "Redirect missing Location header");
});

Deno.test("suzanne#v1/models/download: a non-3xx relays verbatim (409 job_not_done)", async () => {
    const result = await runEndpoint({
        unit: await testSealedUnit("suzanne#v1/models/download"),
        input: inputFor("suzanne#v1/models/download"),
        mode: "replay",
        fixture: await fixture("synthetic-download-not-done"),
    });
    assertEquals(result.httpStatus, 409);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(
        (result.output as Record<string, unknown>).code,
        "job_not_done",
    );
});

// ---------------------------------------------------------------------------
// provenance: the mixed-mode seam, read off the compiled artifact
// ---------------------------------------------------------------------------

Deno.test("suzanne: the two generations share the provider lifecycle; the utilities own their start", async () => {
    const bundle = await testBundle();
    const docs = Object.fromEntries(
        Object.entries(bundle.endpoints).filter(([id]) =>
            id.startsWith("suzanne#")
        ),
    );
    assertEquals(Object.keys(docs).length, 4);

    const startKey = (id: string) =>
        docs[id].lifecycle!.start.$fn.key as string;
    // both generations resolve the SAME provider-level start and poll
    assertEquals(startKey(GENERATIONS[0]), startKey(GENERATIONS[1]));
    assertEquals(
        docs[GENERATIONS[0]].lifecycle!.poll!.$fn.key,
        docs[GENERATIONS[1]].lifecycle!.poll!.$fn.key,
    );
    // the utilities override start with their OWN fns — distinct from the
    // provider's and from each other
    const overrides = [
        startKey("suzanne#v1/uploads"),
        startKey("suzanne#v1/models/download"),
    ];
    assertEquals(new Set([...overrides, startKey(GENERATIONS[0])]).size, 3);
    // nobody declares stop: Suzanne's cancel endpoint is a documented
    // non-goal of this change
    for (const doc of Object.values(docs)) {
        assertEquals(doc.lifecycle!.stop, undefined);
    }
});

Deno.test("suzanne: compiled requests, identities and the flat rate card", async () => {
    const bundle = await testBundle();
    const doc = (id: string) => bundle.endpoints[id];

    // the download doc keeps its placeholder on the wire while carrying a
    // brace-free public identity (design D5)
    const download = doc("suzanne#v1/models/download");
    assertEquals(
        download.request.url,
        "https://api.suzanne3d.com/v1/models/{job_id}/download",
    );
    assertEquals(download.usage.model.kind, "FREE");

    for (const id of GENERATIONS) {
        assertEquals(doc(id).usage.model, {
            kind: "PER_CALL",
            label: "generation",
            consumes: { credit: "default", amount: 0.65 },
        });
        // the async pair carries the generation run budget + the poll cadence
        assertEquals(doc(id).timeouts.runMs, 600_000);
        assertEquals(doc(id).timeouts.pollMs, 10_000);
    }
    assertEquals(doc("suzanne#v1/uploads").usage.model, {
        kind: "PER_CALL",
        label: "upload url",
        consumes: { credit: "default", amount: 0.01 },
    });
    // every BILLABLE doc draws on the one declared pool; the FREE doc has no
    // card row at all, so the compiler prunes the pool it never touches
    for (const id of [...GENERATIONS, "suzanne#v1/uploads"]) {
        assertEquals(doc(id).usage.credits, {
            default: { label: "US dollars" },
        });
    }
    assertEquals(download.usage.credits, {});
});

Deno.test("suzanne#v1/generations/photo-to-3d: the inline channel is rejected at the boundary", async () => {
    const unit = await testSealedUnit("suzanne#v1/generations/photo-to-3d");
    const emptyFixture = {
        name: "never-called",
        description:
            "Input validation must fail BEFORE any wire call — an exhausted chain proves it.",
        calls: [{
            req: { method: "POST", url: unit.doc.request.url },
            res: { status: 202, body: {} },
        }],
    };
    // inline base64 is mirrored in the schema but removed at the binding
    await assertRejects(() =>
        runEndpoint({
            unit,
            input: { body: { images_inline: { front: "aGVsbG8=" } } },
            mode: "replay",
            fixture: emptyFixture,
        })
    );
    // and the remaining channel is mandatory
    await assertRejects(() =>
        runEndpoint({
            unit,
            input: { body: { model: "sculptor" } },
            mode: "replay",
            fixture: emptyFixture,
        })
    );
});

// ---------------------------------------------------------------------------
// live (gated)
// ---------------------------------------------------------------------------

Deno.test({
    name: "suzanne#v1/uploads live (gated on SUZANNE_API_KEY)",
    ignore: liveSkip("suzanne"),
    fn: async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit("suzanne#v1/uploads"),
            input: {},
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        const output = result.output as Record<string, string>;
        assert(output.upload_id.startsWith("upl_"));
        assertEquals(result.usage.evidence, { CALL: 1 });
    },
});

Deno.test({
    name:
        "suzanne#v1/models/download live: 404 for an unknown job (free, no mesh spent)",
    ignore: liveSkip("suzanne"),
    fn: async () => {
        // the FREE endpoint's live probe: an unknown job id proves auth,
        // routing and the error digest without paying for a generation
        const result = await runEndpoint({
            unit: await testSealedUnit("suzanne#v1/models/download"),
            input: {
                pathParams: { job_id: "job_doesnotexist" },
                queryParams: { format: "glb" },
            },
            mode: "live",
        });
        assertEquals(result.isProviderError, true);
        assertEquals(result.usage, { credits: {}, evidence: {} });
    },
});
