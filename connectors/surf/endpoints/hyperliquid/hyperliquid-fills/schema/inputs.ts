import { z } from "zod";

/** GET /hyperliquid/fills query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zHyperliquidFillsQueryParams = z.object({
    address: z.string().min(1).describe(
        "Wallet address: a 0x EVM address or an ENS name (e.g. " +
            "vitalik.eth). Solana addresses are not supported.",
    ),
    from: z.string().min(1).describe(
        "Window start (Unix seconds or a date). With the default " +
            "order=desc, results cover the window forward from this " +
            "point and are capped at ~2000 of the earliest fills in " +
            "range (narrow the range to see the most-recent fills). With " +
            "order=asc this is the start of a complete-history walk: " +
            "follow meta.next_cursor to page through every fill in the " +
            "window with no cap. Example: 2026-03-01.",
    ).optional(),
    to: z.string().min(1).describe(
        "Window end (Unix seconds or a date), inclusive. Defaults to " +
            "now. With order=desc, page back within the most-recent " +
            "results by setting this to the oldest time you received " +
            "(prefer to_ms for millisecond precision); with order=asc it " +
            "bounds the walk. Example: 2026-03-01.",
    ).optional(),
    to_ms: z.number().int().min(0).describe(
        "Window end in Unix milliseconds, for millisecond-precise " +
            "desc paging: pass the time_ms of the oldest fill you " +
            "received to fetch the next page. On its own the boundary is " +
            "exclusive (fills AT to_ms are dropped), so when more than " +
            "limit fills share one millisecond the remainder is skipped " +
            "— pair it with to_fill_id to page losslessly through a " +
            "boundary millisecond. Takes precedence over to (which is " +
            "ignored when to_ms is set). Like to, it pages within the " +
            "recent (~2000-fill) window. desc-only: rejected with " +
            "order=asc (use cursor instead).",
    ).optional(),
    to_fill_id: z.string().min(1).describe(
        "Cursor tiebreak for to_ms: pass the fill_id of the oldest " +
            "fill you received alongside its time_ms as to_ms. The next " +
            "page then resumes strictly after that (time_ms, fill_id) " +
            "pair — fills at the boundary millisecond with a lower " +
            "fill_id are included instead of skipped, so paging never " +
            "loses fills that share a millisecond. Requires to_ms; " +
            "desc-only. Equivalent to following meta.next_cursor, which " +
            "encodes the same position. An empty page can mean the " +
            "window is exhausted (set from to reach older history), not " +
            "that no older fills exist.",
    ).optional(),
    order: z.enum(["desc", "asc"]).describe(
        "desc (default): newest first — the recent feed, or the " +
            "earliest-anchored ~2000-fill slice when from is set. asc: " +
            "oldest first, a complete-history walk from from (required) " +
            "up to to — each page links the next via meta.next_cursor " +
            "with no result cap, the reliable mode for full " +
            'trade-history or PnL reconstruction. Defaults to "desc".',
    ).optional(),
    cursor: z.string().min(1).describe(
        "Opaque continuation token from a previous response's " +
            "meta.next_cursor. It encodes the paging direction, " +
            "position, and window, so pass it with only symbol and limit " +
            "— combining it with from, to, to_ms, or to_fill_id is " +
            "rejected with 400.",
    ).optional(),
    symbol: z.string().min(1).describe(
        "Filter to one market (exact match, e.g. xyz:GOLD). Applied " +
            "client-side: with order=desc it filters after the recent " +
            "cap (pair it with from/to so older fills are not missed); " +
            "with order=asc the cursor walk scans past non-matching " +
            "fills, so a page may return fewer than limit items (or " +
            "none) while meta.next_cursor still advances.",
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Page size (1-100). Defaults to 20.",
    ).optional(),
}).strict();
