import { assert, assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const chains = fromFileUrl(new URL("../../fixtures/", import.meta.url));

/**
 * The job-read endpoints — `firecrawl#crawl/{id}` and
 * `firecrawl#batch/scrape/{id}`. Both are the vendor's own operation, both
 * FREE, and both share the one trap worth a test: a job status body repeats
 * the WHOLE JOB's `creditsUsed` on every chunk, so inheriting the provider's
 * vendor-claim consolidate would re-bill the entire crawl on every read.
 */
const IDS = ["firecrawl#crawl/{id}", "firecrawl#batch/scrape/{id}"];

Deno.test("firecrawl job reads: the identity IS the vendor's path", async () => {
    for (const id of IDS) {
        const unit = await testSealedUnit(id);
        // what the caller sees is what we call — no invented pin
        assertEquals(unit.doc.id, id);
        assertEquals(unit.doc.request.method, "GET");
        assert(
            unit.doc.request.url.endsWith("/{id}"),
            `${id}: the placeholder must survive url normalization unencoded`,
        );
    }
});

Deno.test("firecrawl#crawl/{id}: reads a chunk, substitutes {id}, bills NOTHING", async () => {
    const unit = await testSealedUnit("firecrawl#crawl/{id}");
    const result = await runEndpoint({
        unit,
        input: { pathParams: { id: "JOB1" }, queryParams: { skip: 2 } },
        mode: "replay",
        fixture: await loadFixture(`${chains}crawl-status-ok.json`),
    });

    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    // THE regression this file exists for: the body says creditsUsed 3 (the
    // whole job), and reading it must still cost zero
    assertEquals(result.usage, { credits: {}, evidence: {} });
    const output = result.output as Record<string, unknown>;
    assertEquals((output.data as unknown[]).length, 1);
    // the meter stays in the output as the job's own provenance
    assertEquals(output.creditsUsed, 3);
});

Deno.test("firecrawl#batch/scrape/{id}: same contract on the batch half", async () => {
    const unit = await testSealedUnit("firecrawl#batch/scrape/{id}");
    const result = await runEndpoint({
        unit,
        input: { pathParams: { id: "JOB1" }, queryParams: { skip: 2 } },
        mode: "replay",
        fixture: await loadFixture(`${chains}batch-scrape-status-ok.json`),
    });

    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test("firecrawl job reads: `id` is required, `skip` is not", async () => {
    const unit = await testSealedUnit("firecrawl#crawl/{id}");
    assertEquals(unit.doc.input.schema.pathParams?.required, ["id"]);
    const query = unit.doc.input.schema.queryParams as
        | { required?: string[]; properties?: Record<string, unknown> }
        | undefined;
    assert(query?.properties && "skip" in query.properties);
    assertEquals(query?.required, undefined);
});
