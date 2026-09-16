# monid-connectors

The open connector definitions for [Monid](https://monid.ai) — the platform that
gives AI agents metered, pay-per-use access to hundreds of external APIs.

This repo defines Monid's **endpoints**: each connector is authored in
TypeScript (zod schemas + a few small functions), compiled into inert JSON docs,
and executed by a small generic engine — the same artifact runs locally with
your own API key, in tests via recorded fixtures, and inside the hosted
platform.

## Examples

Run an endpoint (JIT-compiles, cached):

```bash
deno task engine:run 'exa#search' --body '{"query":"solid-state batteries","numResults":3}'
# requires EXA_API_KEY in the environment

deno task engine:run 'akta#news' --query-params '{"query":"warehouse automation","limit":5}'
# requires AKTA_API_KEY
```

Browse the compiled catalog:

```bash
deno task catalog providers                  # what exists
deno task catalog endpoints --provider exa   # …under one provider
deno task catalog endpoints --category web-search
deno task catalog inspect 'exa#search'       # one endpoint's full contract
```

Verify everything:

```bash
deno task check && deno task test            # types + replay tests (zero network)
```

## Connectors

| Provider    | Endpoints                                                                                                                                                                                                           | Auth        | Usage (native units)                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `exa`       | search, contents                                                                                                                                                                                                    | `x-api-key` | results + vendor usd cost                                                                                                                        |
| `tinyfish`  | search, fetch (multi-host)                                                                                                                                                                                          | `X-API-Key` | free — 1 call                                                                                                                                    |
| `akta`      | company-search, company-enrichment, news, industry-search, product-reviews, employee-reviews                                                                                                                        | `x-api-key` | credits (+ derived $, $1 = 20 credits)                                                                                                           |
| `octen`     | search, broad-search, extract, embedding                                                                                                                                                                            | `x-api-key` | calls / sub-queries / successful URLs / tokens from `meta.usage`                                                                                 |
| `ploid`     | v1/search, v1/socials, v1/enrich, v1/agent (async), v1/linkedin/{profile, search, posts, profiles/comments, companies/get, companies/posts}                                                                         | `Bearer`    | ACU from `meta.credits_charged` / `meta.acu_used` (1 ACU = USD 0.10)                                                                             |
| `fundable`  | deals, deal, deal/investors, companies, company, company/deals, company/search, investors, investor, investor/deals, investor/search, people, person, person/deals, person/search, industry/search, location/search | `Bearer`    | credits (1 per row or lookup, 0.1 per fuzzy search; permalink resolvers free)                                                                    |
| `pdl`       | v5/person/enrich, v5/person/search, v5/company/enrich, v5/company/search                                                                                                                                            | `X-Api-Key` | credits by PDL type (people_enrich / people_search / company_enrich / company_search): 1 per match or record                                     |
| `firecrawl` | scrape, map, search, crawl (async), crawl/{id}, batch/scrape (async), batch/scrape/{id}, agent (async)                                                                                                              | `Bearer`    | credits (1 per page or map call, 2 per 10 search results; per-page surcharges for LLM formats, PDF pages, ZDR and x.com routing; job reads free) |

## Adding a connector

```
connectors/<name>/
├── provider.ts                    # defineProvider: name, meta, auth, defaults
├── schema/                        # provider-shared zod: fragments used by 2+ endpoints
└── endpoints/<endpoint>/
    ├── endpoint.ts                # defineEndpoint (id "<provider>#<endpoint>" inferred)
    ├── schema/inputs.ts           # request schemas — this endpoint's only, never re-exported
    ├── endpoint.test.ts           # replay + gated live tests
    └── fixtures/*.json
```

See `connectors/exa/` for the reference implementation.

## Learn more

Everything else — how defs compile to docs, the hook system, the engine
pipeline, usage & billing, configuration, versioning, the full CLI reference —
lives in **[DEVELOPMENT.md](./DEVELOPMENT.md)**. The complete decision record is
under `openspec/changes/*/design.md`.
