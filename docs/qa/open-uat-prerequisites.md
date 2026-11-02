# Remaining UAT prerequisites and feature gaps

These are separate from verified local code corrections. Deployment was explicitly excluded from this burn-down.

| Item | Disposition | What resolves it |
| --- | --- | --- |
| Computed CG/envelope, original53 | Deferred by user; other journeys continue using explicit weight-only/manual-procedure notices | Approved per-aircraft empty weight/moment, station arms, loading limits/envelopes, applicable aircraft/configuration and revision/source. No generic values or inferred approval. |
| Ground-team acknowledgment and completion notification | Existing assignment, payload, fuel and photo workflows tested. Timestamped received/working/complete states and completion notifications do not exist. | Separate workflow addition with actor/time audit, team authorization, reassignment behavior, idempotent transitions, pilot/dispatch readiness visibility and notification tests. Photo upload alone does not imply load complete. |
| LMS media/SCORM/view tracking | Separate feature project, as chosen by user | See lms-expansion.md. Existing author/assign/learn/quiz/certificate/currency paths tested. |
| Maintenance inventory/RTS queue/inspection/vendor/roster modules | Some modules remain unimplemented; UI now distinguishes them from live Due List/Work Orders | Separate feature definitions and data ownership; do not claim hidden/disabled navigation means those modules shipped. |
| Old duplicate scenario flights, invalid fuel orders, invoice identity/numbering, August drafts | Historical source-environment data cannot be reconciled from a fresh fixture | Inspect the actual source DB and provenance; review with the responsible operator. Do not submit pilot logs, certify inspections or renumber invoices to make a demo look clean. Recurring legacy scenario writes now refuse by default; deployed old scheduler still needs retirement. |
| Missing employee titles / real runway records / company weather policy | Required source data, not safe to invent | Operator supplies titles and approved operational configuration/data. Local seed metadata repair is restricted to exact synthetic records. App minimums currently read configurable 600 ft / 2 sm; old scenario 1000 ft / 3 sm is a separate stricter test threshold, not approval. |
| Remote loading/deployment | Deferred deployment scope | Local production Settings/Academy/Accounting Export fully rendered in 143 / 225 / 144 ms; verify remote auth/API/network after deployment access is restored. |

Local UAT type-qualification enforcement was explicitly enabled through Settings → Currency. Prepared Demo Pilot has current Caravan PIC records; refresh preserves company policy and does not manufacture qualifications for ordinary staff.
