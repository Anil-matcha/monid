# Proposal: add-connector-opoint

## Why

Opoint is a live v1 monid-services provider: global news search across
200+ countries under a Special Terms agreement (2026-06-25) that fixes what
each article may expose. Its five synchronous endpoints — four article
searches on one upstream operation and a free filter-id lookup on a public
host — port to the declarative model with no new engine capability; the
two places where the vendor's protocol does not fit the declarative
defaults (an in-band failure on HTTP 200, a request built from path
segments) are covered by existing hooks.

## What Changes

- **connectors/opoint** — 5 endpoints, `Authorization: Token` auth (inline
  inject), 60 s timeouts:
  - `/search`, `/search-advanced`, `/search-by-ids`, `/search-headlines`:
    all `POST https://api.opoint.com/search/` with a per-doc wire profile
    layered under the caller's `params`; PER_CALL, 1 Search API call each;
    the agreement-bound per-article projection (v1's allow-list: headline,
    author, publication time, original URL, site / language / country /
    rank / source / media-type / word-count / readership metadata, topics,
    and a ≤256-char snippet; article bodies and the account-bearing
    tracking `url` dropped) in a provider-level `output.fromResponse`.
  - `/suggest`: `GET https://suggest.api.opoint.com/…` (public host, no
    credential), query params translated into path segments, rows
    projected to `{type, id, name, url}`; FREE.
- **Provider-level `lifecycle.start`** (design D1): a 2xx whose
  `searchresult` reports `response_code ≠ 200` or an `errors` string is
  completed as 422 over providerHttpStatus 200, so the engine forces zero
  usage — v1's synthesized 422, same posture as hunterio.
- **One credit pool** `default` ("Opoint search calls", design D3): the
  vendor meters a monthly band of Search API calls and puts no receipt in
  any response — no `consolidate`.
- **Compiler fix carried from PR #6** (fae4f0e, cherry-picked): `{param}`
  placeholders survive url normalization; `/suggest` is the second doc
  with a path-param url. Drops out of this PR's diff once #6 merges.
- Fixtures: `/suggest` happy + empty and every search's 401 are RECORDED
  (public host; invalid key); search successes are `synthetic-`.

## Capabilities

- `opoint-connector`.

## Non-goals

- The v1 balance probe (`/customers/self/usage/`) — a hosted concern.
- `access_group` beyond public sites (1): Monid's own bit is not readable
  with the Search key; sites added under agreement §4.2 stay invisible to
  `/suggest` until the mask changes (v1 parity).
- An `auth.token` preset — owner call: inline inject for one provider.

## Impact

New connector tree + README row; no schema/engine contract changes. One
shared compiler fix (already in #6).
