import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const chains = fromFileUrl(new URL("../../fixtures/", import.meta.url));

Deno.test("firecrawl#map happy: no vendor meter, so the flat fold settles the run", async () => {
    const unit = await testSealedUnit("firecrawl#map");
    const result = await runEndpoint({
        unit,
        input: { body: { url: "https://example.com", limit: 3 } },
        mode: "replay",
        fixture: await loadFixture(`${chains}map-ok.json`),
    });

    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    // `/map` is the one Firecrawl response with no creditsUsed anywhere: the
    // claim is omitted and the derived flat 1 stands on its own
    assertEquals(result.usage, {
        credits: { default: 1 },
        evidence: { CALL: 1 },
    });
    assertEquals(result.usage.mismatch, undefined);
    const output = result.output as Record<string, unknown>;
    assertEquals((output.links as unknown[]).length, 2);
});

Deno.test("firecrawl#map: flat billing is independent of how many links return", async () => {
    const unit = await testSealedUnit("firecrawl#map");
    // `limit` is a behavior knob here, not a billing multiplier, so it is NOT
    // required at the binding and no estimate reads it
    const required = unit.doc.input.schema.body?.required as string[];
    assertEquals(required, ["url"]);
    assertEquals(unit.doc.usage.model.kind, "PER_CALL");
});

Deno.test({
    name: "firecrawl#map live (gated on FIRECRAWL_API_KEY)",
    ignore: liveSkip("firecrawl"),
    fn: async () => {
        const unit = await testSealedUnit("firecrawl#map");
        const result = await runEndpoint({
            unit,
            input: { body: { url: "https://example.com", limit: 3 } },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assertEquals(result.usage, {
            credits: { default: 1 },
            evidence: { CALL: 1 },
        });
    },
});
