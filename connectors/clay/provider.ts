import { defineProvider, presets } from "@shared/core";

/**
 * Clay (clay.com) — GTM data: a query-language search over a proprietary
 * people/company database, plus seven curated Clay-managed enrichment
 * functions. One host (`https://api.clay.com/public/v0`), one key
 * (`clay-api-key` header), two execution shapes:
 *
 *   - SEARCH (sync, three docs): fetch the query-language reference,
 *     create a search (`search_id`), page the forward-only iterator.
 *     Only the run step returns rows, and only rows draw.
 *   - ENRICHMENT (async, seven docs): each doc bakes ONE Clay-managed
 *     routine id into its `request.path`; start submits a single item and
 *     parks on `routine_run_id`, poll reads the results (HTTP 202 is the
 *     documented pending signal — a status code, not a body field).
 *
 * THE LIFECYCLE LIVES HERE (v2 form of v1's `routineStart(id)`/
 * `routinePoll` attached to every def): `poll` requires a resolved
 * `start`, so the three search docs override `start` with a plain relay
 * and inherit a `poll` that can never fire. v1 lineage: ClayProvider
 * (getProviderRuntime) + endpoints/common.ts (routineStart/routinePoll).
 *
 * Billing: Clay meters against THREE independent vendor pools (design
 * D26) — data credits and actions for enrichment, an annual results quota
 * for search. Declared once HERE; each doc's model drains exactly the
 * pools it touches, and the compiler checks every declared pool is
 * drained by at least one endpoint. Responses carry NO cost field, so
 * there is no `usage.consolidate`: the derived fold settles (see D8).
 *
 * Clay's own answer reaches the caller essentially unchanged: the HTTP 402
 * body substitution v1 did is NOT ported (faithful relay — the vendor's
 * refusal is the run's answer). The one thing that does not travel is
 * `period_quota`, OUR shared workspace's annual ledger (design D7).
 */
export default defineProvider({
    name: "clay",
    meta: {
        displayName: "Clay",
        summary:
            "GTM data: cross-entity people and company search, plus curated enrichment.",
        description: "Clay (clay.com) — GTM data for agents: search a " +
            "proprietary database of people and companies with " +
            "cross-entity queries (current VP Sales at 500+-employee " +
            "Software Development companies using Salesforce), then " +
            "enrich through Clay-managed waterfalls — company domain, " +
            "employee count, industry, and live job openings; person " +
            "profiles, verified work emails, and mobile numbers. The " +
            "company-domain resolver is the entry point: a bare company " +
            "name becomes a domain, and the domain unlocks every other " +
            "company enrichment. Enrichment runs are asynchronous " +
            "(seconds on a hit, up to ~3 minutes when a contact-data " +
            "waterfall exhausts every vendor).",
        homepageUrl: "https://clay.com",
        docsUrl: "https://developers.clay.com",
        categories: ["people-enrichment", "company-enrichment"],
    },
    auth: { inject: presets.auth.header("clay-api-key") },
    request: { baseUrl: "https://api.clay.com/public/v0" },
    // mirrors services/workflows/endpointExecution/config.yml (clay):
    // request 60s, run 300s, poll every 5s (drill: routines settle in 3-26s)
    timeouts: { requestMs: 60_000, runMs: 300_000, pollMs: 5_000 },
    usage: {
        /** THE credit systems (design D26): Clay meters against three
         *  INDEPENDENT pools, and the account holds all three — so the
         *  set is declared once here and each doc's model drains only
         *  what it touches (the key-wise resolution + per-provider drain
         *  check, pdl D6). No dollar conversion lives in the doc: the
         *  Launch-plan rates ($0.046/data credit, $0.004/action, search
         *  rows bundled in the subscription) are the broker card's job. */
        credits: {
            data_credit: { label: "Clay data credits" },
            action: { label: "Clay actions" },
            search_result: {
                label: "Clay search results",
                description:
                    "the subscription's annual search-results quota (Launch: " +
                    "1M rows/year); HTTP 402 past the cap",
            },
        },
        /** NO `usage.consolidate` (design D27 — the hook is optional):
         *  Clay responses carry no cost field at all. The routine
         *  envelope's `estimatedCreditCost` is NOT a meter — drills
         *  2026-08-20 / 2026-09-08 found it wrong in BOTH directions
         *  (Company Domain quoted 0.8, measured 1.0; Work Email quoted
         *  1.1, measured 0.6; Mobile Phone quoted 10.8, measured 10.0) —
         *  so lifting it would settle a false claim over a measured fold.
         *  The derived fold is the answer; the pinned rates are
         *  re-measured by the monthly `clay credits balance`
         *  reconciliation. */
    },
    output: {
        /** The ONE thing that does not relay (design D7, restoring v1's
         *  decision 7): every successful search page carries
         *  `period_quota` — `{limit, used, remaining, resets_at}` for the
         *  WORKSPACE, not for the caller. One Clay workspace serves every
         *  tenant, so `remaining` tells a caller how much of a shared pool
         *  everyone else has burned; the caller's own metering arrives as
         *  `usage.evidence`. Stripped like fundable's `*_remaining` and
         *  ploid's `acu_remaining` — billing facts never reach
         *  user-facing output. A no-op on the other nine docs (the key is
         *  absent), and it cannot touch a bill: `usage` settles on the RAW
         *  envelope, before this hook runs. */
        fromResponse: ({ data, utils }) =>
            utils.json.omit(data.output, ["period_quota"]),
    },
    lifecycle: {
        /**
         * START — the curated-enrichment shape (v1 `routineStart`): submit
         * the run's single item against the routine id baked into the
         * doc's own `request.path`. Clay does not dedupe item ids, so the
         * id is naming, not idempotency.
         *
         * Non-2xx is DATA (the engine zero-bills it). A 2xx WITHOUT a
         * `routine_run_id` has nothing to poll, so the body is the final
         * answer (defensive — the spec says 202 always carries one, but
         * a live 200 `{}` was observed).
         *
         * The three SEARCH docs override this with a plain relay.
         */
        start: async ({ data, utils, logger }) => {
            const res = await utils.request({
                body: {
                    items: [{
                        id: "item-1",
                        inputs: data.input.body ?? {},
                    }],
                },
            });
            if (res.status < 200 || res.status >= 300) {
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const runId = utils.json.optionalGet(res.body, "$.routine_run_id");
            if (typeof runId !== "string" || runId === "") {
                logger.warn("clay routine start returned no routine_run_id", {
                    status: res.status,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            return { kind: "RUNNING", state: { externalRunId: runId } };
        },
        /**
         * POLL — `GET /routines/run/{id}/results?limit=100` (v1
         * `routinePoll`). The HTTP STATUS decides: 202 is Clay's
         * documented pending signal; 429 and 5xx are not answers either
         * (rate limit / upstream infra — ask again, `runMs` bounds the
         * wait); every other status is terminal, 2xx or not. `limit=100`
         * returns the whole run in one page (inline runs cap at 100 items
         * and ours submit exactly one).
         *
         * NOTE `utils.http({path})` is relative to the request ORIGIN, not
         * to `request.baseUrl` — Clay's base carries a `/public/v0`
         * prefix, so the poll path repeats it (design D6).
         */
        poll: async ({ data, utils }) => {
            const runId = data.lifecycle.state.externalRunId;
            if (runId === undefined) {
                throw Object.assign(
                    new Error("clay poll without externalRunId in state"),
                    { retriable: false },
                );
            }
            const res = await utils.http({
                method: "GET",
                path: "/public/v0/routines/run/" + encodeURIComponent(runId) +
                    "/results",
                queryParams: { limit: "100" },
            });
            if (
                res.status === 202 || res.status === 429 || res.status >= 500
            ) {
                return { kind: "RUNNING" };
            }
            return {
                kind: "COMPLETED",
                httpStatus: res.status,
                output: res.body,
            };
        },
        // No `stop`: an in-flight Clay routine run cannot be cancelled
        // upstream — results simply expire (v1 had no stopExecution either).
    },
});
