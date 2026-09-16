import { z } from "zod";

/** Vendor cap on domains per request. */
export const DOMAIN_ENRICH_MAX_DOMAINS = 30;

/** POST /v1/domain/enrich body (ported from v1). */
export const zDomainEnrichBody = z.object({
    domains: z.array(z.string().min(1)).min(1).max(DOMAIN_ENRICH_MAX_DOMAINS)
        .describe(
            "Company website domains, e.g. 'example.com'. Max 30 per " +
                "request.",
        ),
}).strict();
