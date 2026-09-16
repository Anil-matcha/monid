import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json } from "@shared/core";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testBundle,
    testSealedUnit,
} from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));
const ID = "contactout#v1/linkedin/enrich/work-email";
const PROFILE = "https://www.linkedin.com/in/example-person";

/** The seven docs that ride the PERSONAL key (design D1). */
const PERSONAL_DOCS = [
    "contactout#v1/email/enrich/personal-email",
    "contactout#v1/linkedin/enrich/personal-email",
    "contactout#v1/people/decision-makers/personal-email",
    "contactout#v1/people/enrich/personal-email",
    "contactout#v1/people/linkedin/personal-email",
    "contactout#v1/people/linkedin/personal_email_status",
    "contactout#v1/people/search/personal-email",
];

type Line = { kind: string; consumes?: { credit: string; amount: number } };
type Model = Line & { components?: Record<string, Line> };

Deno.test("contactout: two keys — one credential object on every doc, and each endpoint's inject picks one of them", async () => {
    const bundle = await testBundle();
    const ids = Object.keys(bundle.endpoints).filter((id) =>
        id.startsWith("contactout#")
    ).sort();
    assertEquals(ids.length, 20);
    const injects = { work: new Set<string>(), personal: new Set<string>() };
    for (const id of ids) {
        const doc = bundle.endpoints[id];
        const personal = PERSONAL_DOCS.includes(id);
        // the credential is ONE object with both keys (v1 parity: both
        // required), declared on the provider and inherited by every doc
        assertEquals(
            (doc.auth.credentials as { required?: string[] }).required,
            ["workApiKey", "personalApiKey"],
            id,
        );
        injects[personal ? "personal" : "work"].add(doc.auth.inject.$fn.key);
    }
    // one inline inject per key kind (thirteen work / seven personal, each
    // set interning to a single fnTable entry), and they differ
    assertEquals(injects.work.size, 1);
    assertEquals(injects.personal.size, 1);
    assertEquals([...injects.work][0] === [...injects.personal][0], false);
});

Deno.test("contactout: rate literals — every line draws exactly 1 credit from a pool of its own key kind (no consolidate, so the tests hold the card)", async () => {
    const bundle = await testBundle();
    const ids = Object.keys(bundle.endpoints).filter((id) =>
        id.startsWith("contactout#")
    );
    let metered = 0;
    for (const id of ids) {
        const doc = bundle.endpoints[id];
        assertEquals(doc.usage.consolidate, undefined, id);
        const kind = PERSONAL_DOCS.includes(id) ? "personal" : "work";
        const model = doc.usage.model as Model;
        const lines = model.components
            ? Object.values(model.components)
            : model.kind === "FREE"
            ? []
            : [model];
        for (const line of lines) {
            const consumes = line.consumes!;
            assertEquals(consumes.amount, 1, `${id}: ${consumes.credit}`);
            // verifier is the one pool both keys share; every other pool
            // is suffixed by the account that owns it
            if (consumes.credit !== "verifier") {
                assertEquals(consumes.credit.endsWith(`_${kind}`), true, id);
            }
            metered++;
        }
        // each doc narrows to the pools its own lines drain (pdl D6)
        assertEquals(
            Object.keys(doc.usage.credits).sort(),
            [...new Set(lines.map((line) => line.consumes!.credit))].sort(),
            id,
        );
    }
    // five 3-line pairs + the 2-line contact-info pair = 34, plus the four
    // single-line docs (domain-enrich, company-search, verify, person)
    assertEquals(metered, 38);
});

Deno.test("contactout: fn provenance — the twins intern to one estimate and one evidence each", async () => {
    const bundle = await testBundle();
    const pairs = [
        "v1/linkedin/enrich",
        "v1/email/enrich",
        "v1/people/linkedin",
        "v1/people/search",
        "v1/people/decision-makers",
    ];
    for (const path of pairs) {
        const work = bundle.endpoints[`contactout#${path}/work-email`];
        const personal = bundle.endpoints[`contactout#${path}/personal-email`];
        assertEquals(
            work.usage.evidence.$fn.key,
            personal.usage.evidence.$fn.key,
            path,
        );
        assertEquals(
            work.usage.estimate.$fn.key,
            personal.usage.estimate.$fn.key,
            path,
        );
    }
    // people-enrich's estimate reads its key's own `include` vocabulary, so
    // the twins legitimately differ there — but share the evidence
    assertEquals(
        bundle.endpoints["contactout#v1/people/enrich/work-email"].usage
            .evidence.$fn.key,
        bundle.endpoints["contactout#v1/people/enrich/personal-email"].usage
            .evidence.$fn.key,
    );
    // the four FREE docs and the flat PER_CALL doc take the synthesized fns
    const synthesized = bundle.endpoints["contactout#v1/people/count"].usage
        .estimate.$fn.key;
    assertEquals(
        bundle.fnTable[synthesized].provenance,
        "core#usage.synthesizedEmpty",
    );
    assertEquals(
        bundle.endpoints["contactout#v1/people/person"].usage.evidence.$fn
            .key,
        synthesized,
    );
});

Deno.test(`${ID} happy (synthetic): a hit with email + phone draws one of each, no search credit`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: { queryParams: { profile: PROFILE } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    // no vendor claim ⇒ the derived fold IS usage; zUsage is strict, so
    // deep equality proves there is no `mismatch` key
    assertEquals(result.usage, {
        credits: { email_work: 1, phone_work: 1 },
        evidence: { email_found: 1, phone_found: 1, profile_only: 0 },
    });
    // nothing is stripped — the body carries no billing field
    const output = result.output as { profile: Record<string, unknown> };
    assertEquals(output.profile.email, ["person@example.com"]);
});

Deno.test(`${ID} profile_only (synthetic): no contacts back ⇒ exactly one search credit`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(
        `${fixturesDir}synthetic-profile-only.json`,
    );
    const result = await runEndpoint({
        unit,
        input: { queryParams: { profile: PROFILE, profile_only: true } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.usage, {
        credits: { search_work: 1 },
        evidence: { email_found: 0, phone_found: 0, profile_only: 1 },
    });
});

Deno.test(`${ID} miss (synthetic): 200 with profile [] is free`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-miss.json`);
    const result = await runEndpoint({
        unit,
        input: { queryParams: { profile: PROFILE } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.isProviderError, false);
    assertEquals(result.usage, {
        credits: {},
        evidence: { email_found: 0, phone_found: 0, profile_only: 0 },
    });
});

Deno.test(`${ID} provider error (synthetic 401): data, zero usage`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(
        `${fixturesDir}synthetic-provider-error.json`,
    );
    const result = await runEndpoint({
        unit,
        input: { queryParams: { profile: PROFILE } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.isProviderError, true);
    assertEquals(result.httpStatus, 401);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    // fromError digests the flat envelope and keeps the raw body
    const output = result.output as Record<string, unknown>;
    assertEquals(output.message, "Unauthorized");
    assertEquals(output.code, 401);
    assertEquals(output.raw, { status_code: 401, message: "Unauthorized" });
});

Deno.test(`${ID} schema gate: company URLs and unknown keys are rejected before the wire`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    for (
        const bad of [
            { profile: "https://www.linkedin.com/company/example" },
            { profile: "example-person" },
            { profile: PROFILE, bogus: true },
            { profile: PROFILE, profile_only: "yes" },
        ] as Record<string, Json>[]
    ) {
        await assertRejects(
            () =>
                runEndpoint({
                    unit,
                    input: { queryParams: bad },
                    mode: "replay",
                    fixture,
                }),
            Error,
            "INVALID_INPUT",
            JSON.stringify(bad),
        );
    }
});

Deno.test({
    name: `${ID} live (gated on CONTACTOUT_CREDENTIALS)`,
    ignore: liveSkip("contactout"),
    fn: async () => {
        const unit = await testSealedUnit(ID);
        const result = await runEndpoint({
            unit,
            input: {
                queryParams: {
                    profile: "https://www.linkedin.com/in/williamhgates",
                    profile_only: true,
                },
            },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        // shape only — which lines fire depends on what is on file
        assertEquals(
            Object.keys(result.usage.evidence).sort(),
            ["email_found", "phone_found", "profile_only"],
        );
    },
});
