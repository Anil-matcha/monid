# connector-testing (delta)

## MODIFIED Requirements

### Requirement: Fixtures may carry allowlisted response headers
A recorded call's `res` MAY carry a `headers` map so a header-bearing exchange
(a 302 whose `Location` IS the payload) is replayable. Only headers on the
`RECORDED_RES_HEADERS` allowlist SHALL be captured — `location` today — and
growing the list is a deliberate edit in the same PR as the connector needing it.
Request headers SHALL continue to be never recorded: credentials cannot leak into
fixtures.

#### Scenario: Recording a 302
- **WHEN** `deno task record` captures an exchange answering `302` with a
  `Location` header and a `Set-Cookie` header
- **THEN** the written fixture's `res.headers` SHALL contain `location` only,
  and the response relayed to the live run SHALL carry it too (so the recording
  run and its replay observe the same exchange)

#### Scenario: Replaying a 302
- **WHEN** a fixture call carries `res.headers.location`
- **THEN** `replayFetch` SHALL serve a `Response` carrying that header, and the
  fn SHALL receive it at `res.headers.location`

#### Scenario: Existing fixtures are unaffected
- **WHEN** a committed fixture has no `res.headers`
- **THEN** it SHALL parse unchanged and replay SHALL yield `headers: {}`

#### Scenario: A non-allowlisted header fails to load
- **WHEN** a hand-edited fixture carries `res.headers["set-cookie"]`
- **THEN** `zRecordedCall` SHALL reject it, so a forbidden header cannot be
  replayed by editing a file rather than recording one

### Requirement: Recorded URL headers are stripped of credentials
An allowlisted header value MAY ITSELF be a credential — a redirect `location`
to a presigned URL carries its authorization in the query string. Before a
recording is persisted, every query parameter VALUE in a URL-valued response
header SHALL be replaced with a fixed placeholder, while the scheme, host, path
and parameter NAMES are preserved. Redaction SHALL be value-level rather than a
denylist of known-secret parameter names. Header values that are not URLs, and
URLs with no query string, SHALL pass through untouched.

#### Scenario: A presigned redirect is recorded
- **WHEN** `deno task record` captures a `302` whose `location` is
  `https://bucket.s3.amazonaws.com/o.glb?X-Amz-Signature=<secret>&X-Amz-Expires=900`
- **THEN** the written fixture SHALL contain neither `<secret>` nor any other
  query value, and SHALL still carry the host, path and the parameter names
  `X-Amz-Signature` / `X-Amz-Expires`

#### Scenario: A plain redirect stays readable
- **WHEN** a recorded `location` is `https://api.example.com/v1/news/`
- **THEN** it SHALL be persisted verbatim
