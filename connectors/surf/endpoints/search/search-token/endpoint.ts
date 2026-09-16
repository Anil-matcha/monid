import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zSearchTokenQueryParams } from "./schema/inputs.ts";

/**
 * GET /search/token — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Token Symbol Resolution",
        summary: "Resolves an exact token ticker symbol to likely " +
            "contract address candidates on supported chains.",
        description: "Resolves an exact token ticker symbol to likely " +
            "contract address candidates on supported chains. Use " +
            "this before calling token endpoints that require a " +
            "contract address. Pass a returned chain + address only " +
            "to endpoints that support that chain. Results are " +
            "ranked by Surf registry, listing, and market signals. " +
            "volume_usd is kept for response compatibility, always " +
            "returns 0, and must not be used as a candidate ordering " +
            "signal. Included fields: symbol, chain, address, " +
            "decimals, volume_usd. Chains: Ethereum, Base, BSC, " +
            "Arbitrum, Solana, Polygon, Optimism, Avalanche, Fantom, " +
            "Tron, Linea, Mantle, Blast, Gnosis, zkSync, Scroll.",
        docsUrl: "https://docs.asksurf.ai/data-api/search/token",
        categories: ["token-prices"],
    },
    request: { method: "GET", path: "/search/token" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zSearchTokenQueryParams.extend({
                limit: zSearchTokenQueryParams.shape.limit.unwrap().default(20),
                offset: zSearchTokenQueryParams.shape.offset.unwrap().default(
                    0,
                ),
            }),
        },
    },
    usage: {
        // Surf's published Light tier — v1 makePerCallPrice(surfCredits(1)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 1 },
        },
    },
});
