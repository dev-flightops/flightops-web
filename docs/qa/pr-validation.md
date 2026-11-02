# PR validation after upstream integration

The browser evidence in `uat-burndown.md` and the Google Doc records the original local acceptance run. Before opening the PR, the frontend branch was rebased onto `d504b7a` and the backend onto `2887b54`.

- Frontend: **4,146 tests across 456 files passed**, plus lint, TypeScript and a production build using `NEXT_PUBLIC_API_URL=http://localhost:8000`.
- Retained upstream Aircraft today APIs/actions and the flight-specific draft log handoff. Removed the duplicate morning API/action implementation. Explicit pilot completion acknowledgment remains required.
- EOD retains upstream estimated-arrival behavior. Released flights without departures remain visible under Planned; they are excluded from Airborne. Regression coverage checks both sections.
- The post-flight handoff has regression coverage for intermediate stops and upstream draft/submitted log links.
- Backend migrations are now **0155** (demo ownership journal) and **0156** (waiting-bag provenance), following the newly added upstream migrations 0153/0154. Apply the full migration chain before the matching backend.

The earlier screenshots were captured before this upstream rebase; this document distinguishes those browser runs from the fresh automated integration checks. Deployment remains deferred. Approved aircraft loading data, the separately scoped LMS expansion and other unbuilt features remain listed in `open-uat-prerequisites.md`.
