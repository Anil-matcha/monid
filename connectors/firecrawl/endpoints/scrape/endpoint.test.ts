import { assert, assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const chains = fromFileUrl(new URL("../../fixtures/", import.meta.url));

Deno.test("firecrawl#scrape happy: vendor meter is the claim, receipt stays as page provenance", async () => {
    const unit = await testSealedUnit("firecrawl#scrape");
    const result = await runEndpoint({
        unit,
        input: { body: { url: "https://example.com", formats: ["markdown"] } },
        mode: "replay",
        fixture: await loadFixture(`${chains}scrape-ok.json`),
    });

    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    // claim (1) and derived fold (flat page = 1) agree — no mismatch rides out
    assertEquals(result.usage, {
        credits: { default: 1 },
        evidence: { page: 1 },
    });
    // the nested meter is per-page provenance, not a bare receipt: it stays
    const output = result.output as Record<string, Record<string, unknown>>;
    assertEquals(
        (output.data.metadata as Record<string, unknown>).creditsUsed,
        1,
    );
});

Deno.test("firecrawl#scrape json format: the +4 line is derived from the formats array", async () => {
    const unit = await testSealedUnit("firecrawl#scrape");
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                url: "https://example.com",
                formats: [{ type: "json", prompt: "the title" }],
            },
        },
        mode: "replay",
        fixture: await loadFixture(`${chains}scrape-ok.json`),
    });

    // the chain's document reports creditsUsed 1 (a plain scrape), so the
    // vendor claim WINS at 1 while our fold says 5 — exactly the disagreement
    // signal D27 exists to surface, never a failed run
    assertEquals(result.usage.credits, { default: 1 });
    assertEquals(result.usage.evidence, { json: 1, page: 1 });
    assertEquals(result.usage.mismatch, { derived: { default: 5 } });
});

Deno.test("firecrawl#scrape PDF: pdf_page offsets the page already covered by the base fee", async () => {
    const unit = await testSealedUnit("firecrawl#scrape");
    const result = await runEndpoint({
        unit,
        input: { body: { url: "https://example.com/report.pdf" } },
        mode: "replay",
        fixture: await loadFixture(`${chains}scrape-pdf-ok.json`),
    });

    // 3 parsed pages -> 2 beyond the first; derived 1 + 2 = 3 = the claim
    assertEquals(result.usage, {
        credits: { default: 3 },
        evidence: { pdf_page: 2, page: 1 },
    });
});

Deno.test("firecrawl#scrape provider error: 402 is data, zero usage", async () => {
    const unit = await testSealedUnit("firecrawl#scrape");
    const result = await runEndpoint({
        unit,
        input: { body: { url: "https://example.com" } },
        mode: "replay",
        fixture: await loadFixture(`${chains}provider-error.json`),
    });

    assertEquals(result.httpStatus, 402);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(
        (result.output as Record<string, unknown>).message,
        "Insufficient credits to perform this request.",
    );
});

Deno.test("firecrawl#scrape: the mirror is the vendor's, so unknown options pass through", async () => {
    const unit = await testSealedUnit("firecrawl#scrape");
    const properties = unit.doc.input.schema.body?.properties as Record<
        string,
        unknown
    >;
    // faithful mirror: the vendor's own field names, no invented scalars
    for (const field of ["formats", "parsers", "redactPII", "lockdown"]) {
        assert(field in properties, `${field} must be on the mirror`);
    }
    for (const invented of ["json", "jsonSchema", "jsonPrompt"]) {
        assert(
            !(invented in properties),
            `${invented} is not a Firecrawl field and must not be invented`,
        );
    }
    // and no toRequest: the validated input IS the wire body
    assertEquals(unit.doc.input.toRequest, undefined);
});

Deno.test({
    name: "firecrawl#scrape live (gated on FIRECRAWL_API_KEY)",
    ignore: liveSkip("firecrawl"),
    fn: async () => {
        const unit = await testSealedUnit("firecrawl#scrape");
        const result = await runEndpoint({
            unit,
            input: {
                body: { url: "https://example.com", formats: ["markdown"] },
            },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assertEquals(result.usage.evidence, { page: 1 });
        assertEquals(result.usage.credits.default, 1);
        // the pinned rates agree with the vendor's live meter
        assertEquals(result.usage.mismatch, undefined);
    },
});
