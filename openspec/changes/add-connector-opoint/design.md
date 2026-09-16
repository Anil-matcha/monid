# Design: add-connector-opoint

Decision record for the opoint port (v1 `adaptors/opoint`, 5 defs). Only
the choices the declarative model forced are recorded.

## D1 — In-band 200 failures: `lifecycle.start` on a sync provider

Opoint answers some failed searches with HTTP 200 and
`searchresult.response_code: 500` + `errors` (drill 2026-09-13, "Solr
could not handle the query"). The declarative path judges by HTTP status
alone and would bill the call and hand the error envelope back as data.
v1 synthesized 422 inside its relay. The v2 seam that can change the
billed status is `lifecycle.start`, so the provider declares one: default
relay (`utils.request()`), non-2xx relayed as data, 2xx + a failing
`searchresult` completed as `httpStatus: 422, providerHttpStatus: 200`
(ours/theirs, D12 of add-async-run-protocol), everything else relayed
verbatim. Same posture the owner chose for hunterio's 222 (2026-09-15).
The verdict is scoped to the search envelope: the suggestion host has no
`searchresult`, so its bodies pass through — narrower than v1's
`isOpointBodyError`, which also failed a 2xx without the envelope; that
arm was a predicate test, never an observed response.

## D2 — An empty success consumes the call

v1 billed 0 units on a 200 with zero documents ("Opoint still counts the
call, Monid absorbs it", 2026-09-13). In v2 `consumes.amount` is vendor
cost, and the vendor's band counts the request regardless of hits, so the
PER_CALL line stands on an empty success. Whether to absorb it for the
caller is a broker-card decision, not a connector fact. Pinned by the
`synthetic-empty` test.

## D3 — The pool is Search API calls, not amortized dollars

Opoint sells monthly bands (USD 600 / 10,000 calls at the current tier);
v1 amortized that to USD 0.06 per call. The pool rule (2026-09-15: follow
the vendor's unit, no toDollars conversion) makes the pool "Opoint search
calls" with `amount: 1` per search doc; the band price stays on the
broker card. No response carries a meter, so there is no `consolidate`
and the derived fold settles. `/suggest` is FREE (v1 makePerCallPrice(0)).

## D4 — Wire profiles in `toRequest`; caller params stay a strict allow-list

v1 deep-merged a per-def `defaults.params` profile under the caller's
`params`. Those keys (`main`, `max_article_length`, `allsubject`,
`readership`, `select_by_ids`) are not caller-facing — the strict schema
rejects them on purpose (content toggles pinned by the agreement;
`update_search` / `watch_id` / `track_id_*` would keep account state on
Monid's shared token). So the profiles are wire shaping, not schema
defaults: the ARTICLE profile lives on the provider (`/search`,
`/search-advanced` inherit), HEADLINE and by-ids override with their own.
`requestedarticles` 10 / 20 are v1's page sizes, not vendor defaults, so
they ride the same hook (`?? 10`) rather than a schema `.default()`. The
v1 bounds (2000-char expression, 1–100 articles, ≤20 filters, ≤10 lines)
stay in the mirror: Opoint documents no maxima, so v1's pinned scope is
the only source. Every profile is proven by the RECORDED 401 fixtures'
`req.body` (the recorder captures the wire body); re-recorded 2026-09-16
after the profile change (`summary` dropped, D5).

## D5 — The agreement projection is `output.fromResponse`

Special Terms (2026-06-25) bound the article TEXT Monid may expose: the
headline, author, publication date, original URL, and at most 256
verbatim characters; no summaries. Site and readership METADATA is not
text and is licensed on this account, so v1's allow-list (`DOCUMENT_KEYS`,
the ground truth for the port) keeps it: `id_site`, `id_article`,
`author`, `unix_timestamp`, `local_time`, `orig_url`, `url_common`,
`language`, `countrycode`, `countryname`, `site_rank`, `first_source`,
`mediatype`, `word_count`, `similarweb`, plus `header.text`, `topics` →
`{id, text}`, and the snippet (body text only, tags stripped, sliced to
256). Opoint's `summary` is the article lede (docs: search-response) and
the agreement excludes summaries, so it is neither projected nor
requested: `max_article_length` truncates summary + text jointly, summary
first, and a requested lede would spend the 256 budget on text never
emitted (CodeRabbit, 2026-09-16). Dropped: the tracking `url` (embeds the
account id), `body`, `summary`, `short_body`, `quotes`, `caption`,
`matches`, `identical_documents`, and search internals (`search_start`,
`host`, `cputime`, …). `debug` is NOT an internal: it is the parser's
record of search-term corrections (a missing quote, …), which a caller
needs to know its query was reinterpreted — kept, as v1 did. This is an
honest, caller-visible removal — exactly what `fromResponse` is for
(there is no host redaction in this standard); one provider-level fn,
`/suggest` overrides with its row projection. Two hooks were considered
instead (strip in `consolidate`): rejected — nothing is a billing field.

## D6 — `/suggest`: derived path params, credential-less inject

The suggestion server takes its arguments as path segments
(`/suggest/en_GB_1/single/{limit}/{offsets}/0/1/nometa/{term}`). The doc
keeps `{placeholders}` in `request.path`, pins `endpoint: "/suggest"`
(the identity grammar forbids braces), and its `toRequest` maps the
validated `queryParams` to `pathParams` — `types` → `geo:0,site:0`,
`limit ?? 5`, `query` → `term` — returning no `queryParams` at all. The
engine percent-encodes each segment; verified 2026-09-15 against the live
host that `geo%3A0%2Csite%3A0` answers identically to the raw form. The
host is public: the doc's inject returns the request untouched (the
compiler requires every doc to resolve an inject, and the Search token
must not travel there). The default `{apiKey}` credentials shape still
applies, so a run needs the provider key configured even though it is
never sent — the recordings used a placeholder value.

## D7 — Recorded where possible, synthetic where a key is needed

No `OPOINT_API_KEY` is held. Recorded anyway: `/suggest` happy + empty
(public host) and each search's `provider-error` (a real 401 — DRF's
`{"detail": "Invalid token."}` — which also captures every wire profile;
re-recorded 2026-09-16 after D5 and D8 changed the wire).
Synthetic (`synthetic-` prefix): search successes and the in-band 200
failure, shaped from the v1 adaptor tests (drill shape 2026-09-13).
Unverified against real traffic; replace via `deno task record`.

## D8 — `Accept: application/json` pinned at provider level

The first run with a valid token (2026-09-16) came back HTTP 200 with
Django REST framework's BROWSABLE API page: HTML, the search result
embedded as XML. DRF content-negotiates on `Accept`, and the engine sends
none (Deno's `*/*`), so Opoint picked its HTML renderer. v1 never saw this
because `httpProviderRuntime` always sent `Accept: application/json`.
The existing mechanism covers it: provider `request.headers` (bytedance
precedent; compiler merges key-wise into every doc, D20), so `/suggest`
carries it too — harmless on the public JSON host. Side effect: the 401
recordings turned from the HTML login page into
`{"detail": "Invalid token."}`.
