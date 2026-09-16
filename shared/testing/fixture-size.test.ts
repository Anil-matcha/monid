import { assert, assertEquals } from "@std/assert";
import { walk } from "@std/fs";
import { fromFileUrl, join, relative } from "@std/path";
import {
    pickRecordedHeaders,
    RECORDED_RES_HEADERS,
    recordingFetch,
    REDACTED_QUERY_VALUE,
    replayFetch,
    scrubCalls,
    scrubUrlCredentials,
    trimCalls,
    trimJson,
    zRecordedCall,
} from "./fixtures.ts";

/**
 * FIXTURE-SIZE LINT (fixture-diet policy, design D11 of
 * add-async-run-protocol): fixtures are TRIMMED recordings — the wire chain
 * is real, the payload bulk is capped at record time. This lint bounds the
 * files so untrimmed recordings (or bloated synthetics) cannot land:
 * warn > 32 KiB, fail > 128 KiB. Over the warn line? Re-record (trim is the
 * default) or run the trim over the existing recording.
 */
const WARN_BYTES = 32 * 1024;
const FAIL_BYTES = 128 * 1024;

const REPO_ROOT = fromFileUrl(new URL("../../", import.meta.url));

Deno.test("fixture-size lint: fixtures stay trimmed (warn 32KiB, fail 128KiB)", async () => {
    const failures: string[] = [];
    for await (
        const entry of walk(join(REPO_ROOT, "connectors"), {
            includeDirs: false,
            exts: [".json"],
            match: [/fixtures/],
        })
    ) {
        const bytes = (await Deno.stat(entry.path)).size;
        const where = relative(REPO_ROOT, entry.path);
        if (bytes > FAIL_BYTES) {
            failures.push(`${where}: ${bytes} bytes > ${FAIL_BYTES}`);
        } else if (bytes > WARN_BYTES) {
            console.warn(
                `[fixture-size] WARN ${where}: ${bytes} bytes > ${WARN_BYTES} — ` +
                    `consider re-recording (trim is the default)`,
            );
        }
    }
    assert(
        failures.length === 0,
        `untrimmed fixtures (re-record, or apply trimCalls):\n${
            failures.join("\n")
        }`,
    );
});

Deno.test("trimJson: arrays capped, long strings truncated, structure/keys intact", () => {
    const long = "x".repeat(600);
    assertEquals(
        trimJson({
            items: [1, 2, 3, 4],
            nested: { deep: [{ text: long }, "b", "c"] },
            short: "ok",
            n: 5,
            none: null,
        }),
        {
            items: [1, 2],
            nested: { deep: [{ text: "x".repeat(500) }, "b"] },
            short: "ok",
            n: 5,
            none: null,
        },
    );
});

Deno.test("trimCalls: responses trimmed, the wire chain (requests/statuses) untouched", () => {
    const calls = [{
        req: {
            method: "POST",
            url: "https://api.test/jobs",
            body: { many: [1, 2, 3, 4, 5] }, // request bodies are NEVER trimmed
        },
        res: { status: 201, body: { rows: [1, 2, 3, 4, 5] } },
    }];
    assertEquals(trimCalls(calls), [{
        req: {
            method: "POST",
            url: "https://api.test/jobs",
            body: { many: [1, 2, 3, 4, 5] },
        },
        res: { status: 201, body: { rows: [1, 2] } },
    }]);
});

// ---------------------------------------------------------------------------
// RESPONSE HEADERS: allowlisted, round-tripped between record and replay.
// ---------------------------------------------------------------------------

Deno.test("pickRecordedHeaders: only the allowlist survives", () => {
    assertEquals(
        pickRecordedHeaders(
            new Headers({
                location: "https://s3.test/mesh.glb?sig=abc",
                "set-cookie": "session=secret",
                "x-ratelimit-remaining": "41",
                "content-type": "application/json",
            }),
        ),
        { location: "https://s3.test/mesh.glb?sig=abc" },
        "set-cookie / ratelimit / content-type never reach disk",
    );
    assertEquals(
        pickRecordedHeaders(
            new Headers({ "content-type": "application/json" }),
        ),
        undefined,
        "no allowlisted header ⇒ the field is omitted entirely",
    );
});

Deno.test("recordingFetch: an allowlisted header is captured AND relayed", async () => {
    const sink: Parameters<typeof scrubCalls>[0] = [];
    const wrapped = recordingFetch(
        () =>
            Promise.resolve(
                new Response("", {
                    status: 302,
                    headers: {
                        location: "https://s3.test/mesh.glb?sig=abc",
                        "set-cookie": "session=secret",
                    },
                }),
            ),
        sink,
    );
    const relayed = await wrapped("https://api.test/models/j1/download", {
        method: "GET",
    });
    // the FIXTURE carries it …
    assertEquals(sink[0].res.headers, {
        location: "https://s3.test/mesh.glb?sig=abc",
    });
    // … and so does the response the live run observes (without this the
    // recording run and its replay would see different exchanges)
    assertEquals(
        relayed.headers.get("location"),
        "https://s3.test/mesh.glb?sig=abc",
    );
    assertEquals(relayed.headers.get("set-cookie"), null);
});

Deno.test("replayFetch: recorded headers are served back; absent ⇒ none", async () => {
    const serve = replayFetch({
        name: "redirect",
        description: "302 whose Location is the payload",
        calls: [
            {
                req: { method: "GET", url: "https://api.test/d" },
                res: {
                    status: 302,
                    headers: { location: "https://s3.test/m.glb" },
                    body: null,
                },
            },
            {
                req: { method: "GET", url: "https://api.test/plain" },
                res: { status: 200, body: { ok: true } },
            },
        ],
    });
    const redirect = await serve("https://api.test/d", { method: "GET" });
    assertEquals(redirect.status, 302);
    assertEquals(redirect.headers.get("location"), "https://s3.test/m.glb");
    const plain = await serve("https://api.test/plain", { method: "GET" });
    assertEquals(plain.headers.get("location"), null);
});

Deno.test("trimCalls/scrubCalls: response headers ride through both passes", () => {
    const calls = [{
        req: { method: "GET", url: "https://api.test/d" },
        res: {
            status: 302,
            headers: { location: "https://s3.test/m.glb" },
            body: { rows: [1, 2, 3, 4, 5], who: "a@b.com" },
        },
    }];
    assertEquals(trimCalls(calls)[0].res.headers, {
        location: "https://s3.test/m.glb",
    });
    // no query string ⇒ nothing to redact, the value stays readable
    assertEquals(scrubCalls(calls)[0].res.headers, {
        location: "https://s3.test/m.glb",
    });
});

Deno.test("scrubUrlCredentials: query VALUES redacted, url shape intact", () => {
    // a presigned S3 url IS a bearer credential — the signature must not
    // reach disk, but the shape a fixture exists to pin must survive
    const signed = "https://bucket.s3.amazonaws.com/cus_1/job_1/mesh.glb" +
        "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900" +
        "&X-Amz-Signature=deadbeefcafe";
    const scrubbed = new URL(scrubUrlCredentials(signed));
    assertEquals(scrubbed.origin, "https://bucket.s3.amazonaws.com");
    assertEquals(scrubbed.pathname, "/cus_1/job_1/mesh.glb");
    // parameter NAMES survive (assertions read `has`, not the value) …
    assertEquals(
        [...scrubbed.searchParams.keys()].sort(),
        ["X-Amz-Algorithm", "X-Amz-Expires", "X-Amz-Signature"],
    );
    // … every VALUE is gone
    for (const value of scrubbed.searchParams.values()) {
        assertEquals(value, REDACTED_QUERY_VALUE);
    }
    assert(!scrubUrlCredentials(signed).includes("deadbeefcafe"));

    // pass-throughs: no query, and not a url at all
    assertEquals(
        scrubUrlCredentials("https://api.test/v1/news/"),
        "https://api.test/v1/news/",
    );
    assertEquals(scrubUrlCredentials("/relative/path"), "/relative/path");
});

Deno.test("scrubCalls: a recorded presigned location is redacted before disk", () => {
    const calls = [{
        req: { method: "GET", url: "https://api.test/models/j1/download" },
        res: {
            status: 302,
            headers: {
                location:
                    "https://s3.test/mesh.glb?X-Amz-Signature=secret&X-Amz-Expires=900",
            },
            body: null,
        },
    }];
    const location = scrubCalls(calls)[0].res.headers!.location;
    assert(!location.includes("secret"), "the signature never reaches disk");
    assert(
        location.includes("X-Amz-Signature=" + REDACTED_QUERY_VALUE),
        "the parameter survives so the fixture still pins the shape",
    );
});

Deno.test("zRecordedCall: response headers outside the allowlist are rejected", () => {
    const allowed = {
        req: { method: "GET", url: "https://api.test/d" },
        res: {
            status: 302,
            headers: { location: "https://s3.test/m" },
            body: null,
        },
    };
    assertEquals(zRecordedCall.safeParse(allowed).success, true);
    // the recorder is not the only way a fixture gets written — a
    // hand-edited one must fail to LOAD, not replay a forbidden header
    const smuggled = {
        req: { method: "GET", url: "https://api.test/d" },
        res: {
            status: 302,
            headers: { "set-cookie": "session=secret" },
            body: null,
        },
    };
    assertEquals(zRecordedCall.safeParse(smuggled).success, false);
});
