# Tasks: add-connector-muapi

## 1. Provider and endpoint

- [x] 1.1 Add MuAPI provider metadata, API-key auth, base URL and timeouts.
- [x] 1.2 Add shared submit/poll lifecycle with terminal failure handling.
- [x] 1.3 Add vendor-cost consolidation and error digestion.
- [x] 1.4 Add Seedance 2.5 text-to-video input mirror and endpoint binding.
- [x] 1.5 Add the current resolution/second usage model and pure estimate /
      evidence functions.

## 2. Fixtures and tests

- [x] 2.1 Add synthetic success, task-failure and submit-rejection chains.
- [x] 2.2 Test async completion, cost stripping, error zero-billing and URL
      delivery through sealed-unit replay.
- [x] 2.3 Test all four pricing resolutions and input validation without I/O.

## 3. Verification

- [ ] 3.1 Run `deno task check` and `deno task test`.
- [ ] 3.2 Run formatter, linter, compiler and catalog smoke checks.
- [ ] 3.3 Open the focused upstream pull request after all local gates pass.

## 4. Follow-ups

- [ ] 4.1 Add further MuAPI models only with their own reviewed input
      capabilities and cost evidence.
- [ ] 4.2 Re-audit the pinned rate card if the public estimator changes.
