# connector-engine (delta)

## ADDED Requirements

### Requirement: Response headers are data
The transport port SHALL carry the vendor's response headers alongside the
status and body, and the engine SHALL surface them to lifecycle fns.
`TransportResponse.headers` is OPTIONAL (a transport that omits it stays
source-compatible); `HttpResult.headers` is REQUIRED, defaulting to `{}` when the
transport omitted them, so a fn never branches on presence. Header keys SHALL be
lowercased. Only the vendor's RESPONSE headers are exposed — request headers,
where credentials live, remain invisible to fns.

#### Scenario: A 302 Location reaches the fn
- **WHEN** a lifecycle fn calls `utils.request()` and the vendor answers
  `302 Found` with `Location: https://s3.example/mesh.glb?sig=…` and an empty body
- **THEN** the fn receives `{status: 302, headers: {location: "https://s3.example/mesh.glb?sig=…"}, body: null}`
  and MAY project it into a COMPLETED outcome

#### Scenario: Redirects are still never followed
- **WHEN** any transport request receives a 3xx
- **THEN** the engine SHALL NOT re-issue the request against the redirect target,
  so the provider credential never travels to a foreign origin

#### Scenario: A transport that omits headers
- **WHEN** a `Transport` implementation returns no `headers`
- **THEN** `utils.http` and `utils.request` SHALL yield `headers: {}`

### Requirement: Header exposure is a versioned ABI change
Extending the fn-facing `HttpResult` SHALL bump `ENGINE_VERSION` and
`schema.async_since` in lockstep, so an ASYNC LIFECYCLE doc whose fns read
response headers cannot be executed by an engine that does not provide them.
`schema.fn_abi_since` SHALL NOT move: `utils.http` / `utils.request` are held
only by the lifecycle family, so a pure-hook doc gains no capability and must
not be floored at a newer engine.

#### Scenario: Only async docs take the new floor
- **WHEN** the compiled catalog is inspected after the bump
- **THEN** every doc resolving a lifecycle fn SHALL carry
  `minEngineVersion` = `schema.async_since`, and a pure-hook doc (e.g.
  `exa#search`) SHALL still carry `schema.fn_abi_since`

#### Scenario: The version gate fires
- **WHEN** `shared/core/schema/hooks/lifecycle.ts` or `config.yml` changes
- **THEN** `deno task version:check` SHALL fail unless `engine/deno.json`
  differs from the base ref
