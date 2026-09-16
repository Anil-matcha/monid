import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import {
    loadFixture,
    runEndpoint,
    testBundle,
    testSealedUnit,
} from "@shared/testing";

const ID = "ahrefs#site-explorer/domain-rating";
const INPUT = {
    queryParams: { target: "example.com", date: "2026-09-01" },
};
const FIXTURE = fromFileUrl(
    new URL("./fixtures/synthetic-metered.json", import.meta.url),
);
const METER = "x-api-units-cost-total-actual";

// Synthetic header cases based on the documented wire contract:
// https://docs.ahrefs.com/en/api/docs/limits-consumption (2026-09-16).
// The explicit zero tests exercise the engine's pruning of zero claims:
// consolidate alone cannot override a positive derived charge with zero.
const cases: {
    name: string;
    headers: Record<string, string>;
    units: number;
    free?: boolean;
}[] = [
    { name: "paid meter", headers: { [METER]: "50" }, units: 50 },
    {
        name: "vendor meter wins over the card",
        headers: { [METER]: "63" },
        units: 63,
    },
    {
        name: "cache hit with an explicit zero",
        headers: { [METER]: "0", "x-api-cache": "hit" },
        units: 0,
        free: true,
    },
    {
        name: "explicit zero without a cache header (free target)",
        headers: { [METER]: "0" },
        units: 0,
        free: true,
    },
    {
        name: "cache hit without a meter",
        headers: { "x-api-cache": "hit" },
        units: 0,
        free: true,
    },
    {
        name: "cache hit with an unusable meter",
        headers: { [METER]: "invalid", "x-api-cache": "hit" },
        units: 0,
        free: true,
    },
    {
        name: "actual meter takes precedence over cache metadata",
        headers: { [METER]: "63", "x-api-cache": "hit" },
        units: 63,
    },
    { name: "missing headers use the card", headers: {}, units: 50 },
];

for (const scenario of cases) {
    Deno.test(`ahrefs billing headers: ${scenario.name}`, async () => {
        const unit = await testSealedUnit(ID);
        const fixture = await loadFixture(FIXTURE);
        fixture.calls[0].res.headers = scenario.headers;
        const result = await runEndpoint({
            unit,
            input: INPUT,
            mode: "replay",
            fixture,
        });
        assertEquals(result.httpStatus, 200);
        assertEquals(result.output, fixture.calls[0].res.body);
        assertEquals(result.usage, {
            credits: scenario.free ? {} : { default: scenario.units },
            evidence: scenario.free
                ? { rows: 0, minimum_top_up: 0 }
                : { rows: 1, minimum_top_up: 48 },
            ...(scenario.units !== 0 && scenario.units !== 50
                ? { mismatch: { derived: { default: 50 } } }
                : {}),
        });
    });
}

Deno.test("ahrefs billing headers: malformed values cannot become free consumption", async () => {
    const unit = await testSealedUnit(ID);
    for (
        const value of [
            "",
            " ",
            "-1",
            "NaN",
            "Infinity",
            "1e2",
            "0x0",
            "50x",
            "9007199254740992",
        ]
    ) {
        const fixture = await loadFixture(FIXTURE);
        fixture.calls[0].res.headers = { [METER]: value };
        const result = await runEndpoint({
            unit,
            input: INPUT,
            mode: "replay",
            fixture,
        });
        assertEquals(result.usage, {
            credits: { default: 50 },
            evidence: { rows: 1, minimum_top_up: 48 },
        }, value);
    }
});

Deno.test("ahrefs billing headers: provider errors still settle zero", async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(FIXTURE);
    fixture.calls[0].res.status = 403;
    fixture.calls[0].res.headers = { [METER]: "63" };
    fixture.calls[0].res.body = { error: "not permitted" };
    const result = await runEndpoint({
        unit,
        input: INPUT,
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 403);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(result.output, {
        message: "not permitted",
        raw: { error: "not permitted" },
    });
});

Deno.test("ahrefs: all endpoints share the meter relay, claim, and zero-billing counter", async () => {
    const bundle = await testBundle();
    const reference = bundle.endpoints[ID];
    assertEquals(typeof reference.lifecycle?.start?.$fn.key, "string");
    assertEquals(typeof reference.usage.consolidate?.$fn.key, "string");
    for (
        const doc of Object.values(bundle.endpoints).filter((d) =>
            d.id.startsWith("ahrefs#")
        )
    ) {
        assertEquals(doc.lifecycle?.start, reference.lifecycle?.start, doc.id);
        assertEquals(
            doc.usage.consolidate,
            reference.usage.consolidate,
            doc.id,
        );
        assertEquals(doc.usage.evidence, reference.usage.evidence, doc.id);
    }
});
