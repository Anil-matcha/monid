import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zHyperliquidTradesQueryParams } from "./schema/inputs.ts";

/**
 * GET /hyperliquid/trades — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Closed Trades",
        summary: "Returns a wallet's closed round-trip trades — one row " +
            "per open→close position lifecycle, with realized " +
            "per-trade P&L (gross, net = gross − fees, fees, and " +
            "funding_pnl as a separate field that net EXCLUDES), " +
            "entry/exit price, size, and hold time.",
        description: "Returns a wallet's closed round-trip trades — one row " +
            "per open→close position lifecycle, with realized " +
            "per-trade P&L (gross, net = gross − fees, fees, and " +
            "funding_pnl as a separate field that net EXCLUDES), " +
            "entry/exit price, size, and hold time. Newest close " +
            "first. This is the journal / calendar / attribution " +
            "source; for fill-level executions use " +
            "/hyperliquid/fills instead. Returns EVERY closed trade " +
            "in the window — it does NOT filter by symbol or " +
            "direction (a symbol/direction query param is ignored, " +
            "not applied); for per-symbol / per-direction rollups " +
            "use /hyperliquid/trades/aggregate, or " +
            "/hyperliquid/fills for symbol-scoped fills. funding_pnl " +
            "is 0 for warehouse rows and populated only on the live " +
            "tail, so a funding-inclusive total is incomplete before " +
            "the watermark. Cursor-paged over the full history " +
            "(warehouse + a live gap-fill for the most recent days): " +
            "follow meta.next_cursor to page back. The cursor is a " +
            "complete continuation token (it encodes the window + " +
            "position), so pass it with only address and limit — " +
            "combining it with from/to is rejected. from/to (Unix " +
            "seconds or a date) bound the window on the first page. " +
            "A wallet with an extremely large live (post-warehouse) " +
            "trade history may require a from/to window. NOTE: " +
            "Surf's own document declares symbol, direction, dex on " +
            "this endpoint while also stating they are rejected, so " +
            "they are deliberately NOT accepted here.",
        docsUrl: "https://docs.asksurf.ai/data-api/hyperliquid/trades",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/hyperliquid/trades" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zHyperliquidTradesQueryParams.extend({
                limit: zHyperliquidTradesQueryParams.shape.limit.unwrap()
                    .default(20),
            }),
        },
    },
    usage: {
        // Surf's published Heavy tier — v1 makePerCallPrice(surfCredits(4)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 4 },
        },
    },
});
