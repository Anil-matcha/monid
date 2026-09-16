import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { PAGE_SIZE_MAX } from "../../schema/common.ts";
import { zPeopleSearchBody } from "./schema/inputs.ts";

/** POST /people — filtered people search, billed per row. */
export default defineEndpoint({
    meta: {
        displayName: "Search People",
        summary: "Search founders, executives, partners, and angels with " +
            "cross-type filters.",
        description: "Search founders, executives, partners, and angel " +
            "investors with filters on role, available contact types, job " +
            "title, school and employer; on the current employer (semantic " +
            "description, location, industry, headcount, IPO status, total " +
            "raised, latest round, who invested); and on investor activity " +
            "(firm, angel vs institutional, lead-only, round types, deal " +
            "size and date, portfolio industry and location); or " +
            "batch-look-up up to 100 LinkedIn, Crunchbase or Twitter URLs. " +
            "Returns per person: id, name, title, LinkedIn/Crunchbase/" +
            "Twitter URLs, location, about, is_founder, current_company, " +
            "recent employment_history and education_history (3 each), " +
            "is_investor, is_angel, has_led_deal, investment_firms, and " +
            "investor_highlights (deal counts, top industries, locations, " +
            "round types). Location, industry and super-category filters " +
            "take exact permalinks — resolve names with /location/search " +
            "and /industry/search first. Suited for finding " +
            "decision-makers at newly funded companies and angels or " +
            "partners who invest in a given space.",
        docsUrl: "https://docs.tryfundable.ai/api-reference/people/list",
        categories: ["funding-data", "people-enrichment"],
    },
    request: { method: "POST", path: "/people" },
    // `page_size` REQUIRED and CAPPED at the binding (design D25; see
    // endpoints/deals/endpoint.ts for the rule).
    input: {
        schema: {
            body: zPeopleSearchBody.extend({
                page_size: zPeopleSearchBody.shape.page_size.unwrap()
                    .max(PAGE_SIZE_MAX),
            }),
        },
    },
    usage: {
        /** 1 credit per returned row — v1 drill (2026-09-01). Settle is
         *  inherited (provider evidence counts `data.people`). */
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.RESULT,
            label: "rows",
            consumes: { credit: "default", amount: 1 },
        },
        estimate: ({ data }) => ({
            counts: { "RESULT": data.input.body.page_size },
        }),
    },
});
