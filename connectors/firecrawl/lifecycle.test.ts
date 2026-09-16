import { assert, assertEquals } from "@std/assert";
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
 * THE firecrawl async suite (fixture strategy v2): four shared shape chains
 * drive every job endpoint. `{{request.url}}` binds each chain to the endpoint
 * under test, which is what lets ONE `job-succeeded` chain serve both `/crawl`
 * (`.../v2/crawl/JOB1`) and `/batch/scrape` (`.../v2/batch/scrape/JOB1`) —
 * the same property that lets the three endpoints share one lifecycle fn.
 */

const chains = fromFileUrl(new URL("./fixtures/", import.meta.url));

/** One schema-valid input per async endpoint. */
const INPUTS: Record<string, RunInput> = {
    "firecrawl#crawl": { body: { url: "https://example.com", limit: 2 } },
    "firecrawl#batch/scrape": {
        body: {
            urls: ["https://example.com", "https://example.com/pricing"],
            formats: ["markdown"],
        },
    },
    "firecrawl#agent": {
        body: {
            prompt: "What is the heading on this page?",
            urls: ["https://example.com"],
            maxCredits: 10,
        },
    },
};

const PAGE_JOBS = ["firecrawl#crawl", "firecrawl#batch/scrape"];

Deno.test("firecrawl async: the three job endpoints share ONE interned fn per lifecycle phase", async () => {
    const bundle = await testBundle();
    const keys = (id: string) => {
        const lifecycle = bundle.endpoints[id].lifecycle;
        assert(lifecycle, `${id} must carry a lifecycle`);
        return {
            start: lifecycle.start?.$fn.key,
            poll: lifecycle.poll?.$fn.key,
            stop: lifecycle.stop?.$fn.key,
        };
    };
    const crawl = keys("firecrawl#crawl");
    assert(crawl.start && crawl.poll && crawl.stop);
    // byte-identical sources -> content-addressed to the same fnTable entry,
    // which is how the duplication the closed-term rule forces stays free
    assertEquals(keys("firecrawl#batch/scrape"), crawl);
    assertEquals(keys("firecrawl#agent"), crawl);
});

Deno.test("firecrawl async: the sync endpoints carry NO lifecycle", async () => {
    const bundle = await testBundle();
    // a provider-level `start` would be inherited leaf-wise and replace their
    // declarative execution, so the lifecycle lives on the async endpoints
    for (
        const id of ["firecrawl#scrape", "firecrawl#map", "firecrawl#search"]
    ) {
        assertEquals(bundle.endpoints[id].lifecycle, undefined, id);
    }
});

for (const id of PAGE_JOBS) {
    Deno.test(`${id} job-succeeded: parks RUNNING, polls to completed, settles on the vendor meter`, async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit(id),
            input: INPUTS[id],
            mode: "replay",
            fixture: await loadFixture(`${chains}job-succeeded.json`),
        });

        assertEquals(result.httpStatus, 200);
        assertEquals(result.isProviderError, false);
        // completed=2 pages, vendor claims 2 credits, derived fold agrees
        assertEquals(result.usage, {
            credits: { default: 2 },
            evidence: { page: 2 },
        });
        assertEquals(result.usage.mismatch, undefined);
        const output = result.output as Record<string, unknown>;
        assertEquals((output.data as unknown[]).length, 2);
    });

    Deno.test(`${id} job-paginated: the poll follows \`next\` and returns one complete result set`, async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit(id),
            input: INPUTS[id],
            mode: "replay",
            fixture: await loadFixture(`${chains}job-paginated.json`),
        });

        assertEquals(result.httpStatus, 200);
        const output = result.output as Record<string, unknown>;
        // 2 rows on the first page + 1 on the second, concatenated
        assertEquals((output.data as unknown[]).length, 3);
        // `next` needs a Firecrawl key the caller does not hold, so an
        // exhausted chain must not leave it in the output
        assertEquals("next" in output, false);
        assertEquals(result.usage.credits, { default: 3 });
        assertEquals(result.usage.evidence, { page: 3 });
    });

    Deno.test(`${id} job-failed: an in-body failure is zero-billed error data`, async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit(id),
            input: INPUTS[id],
            mode: "replay",
            fixture: await loadFixture(`${chains}job-failed.json`),
        });

        // OURS synthesized; THEIRS stays the real 200 the status API answered
        assertEquals(result.httpStatus, 500);
        assertEquals(result.providerHttpStatus, 200);
        assertEquals(result.isProviderError, true);
        assertEquals(result.usage, { credits: {}, evidence: {} });
    });

    Deno.test(`${id} submit rejected: a 402 on submit is data, never a job`, async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit(id),
            input: INPUTS[id],
            mode: "replay",
            fixture: await loadFixture(`${chains}provider-error.json`),
        });

        assertEquals(result.httpStatus, 402);
        assertEquals(result.isProviderError, true);
        assertEquals(result.usage, { credits: {}, evidence: {} });
    });
}

Deno.test("firecrawl#agent: an object `data` short-circuits the pagination walk", async () => {
    const result = await runEndpoint({
        unit: await testSealedUnit("firecrawl#agent"),
        input: INPUTS["firecrawl#agent"],
        mode: "replay",
        fixture: await loadFixture(`${chains}agent-succeeded.json`),
    });

    assertEquals(result.httpStatus, 200);
    const output = result.output as Record<string, Record<string, unknown>>;
    // the agent returns one extracted object, not an array of pages — the
    // shared poll must hand it back untouched rather than replacing it
    assertEquals(output.data.heading, "Example Domain");
    // dynamic pricing: the vendor's own draw IS the quantity, so the claim
    // and the derived fold agree by construction
    assertEquals(result.usage, {
        credits: { default: 4 },
        evidence: { CREDIT: 4 },
    });
    assertEquals(result.usage.mismatch, undefined);
});

Deno.test("firecrawl#agent: `maxCredits` is required — the ceiling is the estimate", async () => {
    const unit = await testSealedUnit("firecrawl#agent");
    const required = unit.doc.input.schema.body?.required as string[];
    assert(required.includes("maxCredits"));
    assert(required.includes("prompt"));
});

Deno.test("firecrawl#crawl: `limit` is required — the vendor default is 10,000 pages", async () => {
    const unit = await testSealedUnit("firecrawl#crawl");
    const required = unit.doc.input.schema.body?.required as string[];
    assert(required.includes("limit"));
});

Deno.test("firecrawl#batch/scrape: `urls` stays untightened — a multiplier array is the caller's own list", async () => {
    const unit = await testSealedUnit("firecrawl#batch/scrape");
    const required = unit.doc.input.schema.body?.required as string[];
    assertEquals(required, ["urls"]);
});

Deno.test({
    name: "firecrawl#crawl live (gated on FIRECRAWL_API_KEY)",
    ignore: liveSkip("firecrawl"),
    fn: async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit("firecrawl#crawl"),
            input: { body: { url: "https://example.com", limit: 2 } },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assertEquals(typeof result.usage.credits.default, "number");
        // the pinned per-page rate agrees with the vendor's live meter
        assertEquals(result.usage.mismatch, undefined);
    },
});
