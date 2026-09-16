import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));

Deno.test("pdl#v5/company/enrich happy (synthetic): flat envelope (no data wrapper); one company_enrich credit", async () => {
    const unit = await testSealedUnit("pdl#v5/company/enrich");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: { queryParams: { website: ["stripe.com"] } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, {
        credits: { company_enrich: 1 },
        evidence: { CALL: 1 },
    });
    // PDL's company record sits at the top level beside status/likelihood
    const output = result.output as Record<string, unknown>;
    assertEquals(output.likelihood, 10);
    assertEquals(output.name, "stripe");
    assertEquals("data" in output, false);
});
