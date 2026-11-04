# Production journey recheck — November 4, 2026

The core workflows were exercised against the active production API with designated synthetic demo records. This was **not a flawless production pass**: new defects below are fixed in proposed code, with original production and local-after evidence distinguished. No new finding was colored green in the original bug document.

## Deployment

Web production: Vercel `dpl_dcUFzwKRf1SaYoDCgvCt5dYVCWp6`, commit `0a96815a5535a5d109f4983eaa32e35c17a9f10e`, Ready on www.peregrineflight.com. Contains merged #454 and #455.

Services #362/#363 are merged at `feb59632e6d622503b339f16aadaa69c9e857795`. The actual website still uses `offshore-texas-maker-tiles.trycloudflare.com`; the ops runbook describes manual updates on that demo host. Render's intended auto-deploy blueprint does not establish rollout on this host. Initial live AR still used Alice Northrup rather than Northrup Fisheries. The user is obtaining SSH access from its maintainer. No deployment or environment setting changed in this pass.

## Founder journeys

| Journey | Executed result and limits |
| --- | --- |
| 1 Reservation → manifest | Return booking filed and confirmed both ways with named 175 lb UAT Journey. Both original manifests contained the passenger once. Company-day candidate-search defect reproduced and fixed locally. Cancellation/reaccommodation also preserved the same return booking and passenger. |
| 2 Schedule and disruption | Company-day/Tomorrow navigation; moved DEMO107 ten minutes later without losing its passenger; cancelled it with a reason; booking returned to awaiting dispatch. Built DEMO108 from that booking, added it to the new manifest, and assigned Prepared Demo Pilot. Full intermediate-stop labels repaired locally in manifest, ramp, ramper and EOD. |
| 3 Dispatch and release | PIC assignment, all-stop weather, current currency/type checks, rapid NOTAM save persistence, payload 1,940 lb / 270 lb remaining, separate pilot/dispatcher FRAT signatures, release and saved packet. Normal controls refused missing acknowledgments/unsigned FRAT. Dispatcher FRAT suggestions used the wrong person's duty/currency; backend PR #364 fixes this. Pilot-owned FRAT was used for the production spine. |
| 4 Pilot | Separate Prepared Demo Pilot login; duty in, aircraft take, daily preflight/run-up, own FRAT and signature, all eight checklist steps, release acceptance, departure and arrival. Arrival under five minutes was correctly refused; later arrival generated a pilot-owned draft. Submitted, reopened with a reason, corrected engine times, resubmitted, duty out. The normal segmented-time control saved correctly; automation fill alone did not trigger React change state. |
| 5 Gate and ground | Three weighed, seated passengers checked in and boarded; 15 lb baggage bumped to waiting with booking/passenger provenance, then reloaded as cargo alongside 1,400 lb mail without double counting. Closed boarding locked manifest. Synthetic fuel confirmed and delivered with actuals and two audit transitions. Separate repository-seeded Nina ground login acknowledged DEMO105, uploaded a clearly marked application screenshot, completed its load, and dispatch showed person/time/one photo. This upload is not a physical aircraft inspection. Different-flight baggage recovery remains a separate variant; this pass reloaded the queued bag onto its original eligible flight. |
| 6 Records and closeout | EOD showed two completed flights, 1.1 recorded hours and one separate airborne example. Outbound passenger booking was explicitly completed after arrival. N94DM remained at 1,000.1 h after arrival and corrected-log resubmission: no double increment. Signed FRAT PDF matches both signers and audit hash. Completed-flight packet-download dead end repaired locally, then downloaded the retained six-page packet from the live API; saved weather/NOTAMs/notes/FRAT retained. |
| 7 Maintenance | Synthetic grounding squawk on N95DM made dispatch Not airworthy. Required resolution notes cleared it; closed register retained the record. Local repair exposes its saved resolution reason, resolver and time, previously hidden by the table. No physical maintenance approval was invented. |
| 8 Executive demo | Reservation → weighed/boarded manifest → signed FRAT/release → pilot acceptance → departed/arrived → submitted/corrected log → EOD/aircraft hours traced with consistent identifiers. Return disruption recovery and separate ground/maintenance/Academy branches also exercised. AI helpers remain advisory/read-only; approved CG data, real qualifications and real policy decisions remain human prerequisites. |
| 9 Phil's Academy | Authored plain-text lesson and quiz, published, self-enrolled, failed then passed retake, explicitly marked complete, verified certificate/My Training/admin record. Separately assigned the same no-currency-link synthetic course to the seeded ground learner: learner passed, explicitly completed, received certificate, and admin saw Completed 1/1. Archived verification course after checks. Academy assistant accurately explains completion and its read-only limits. SCORM/media/view-time expansion remains deferred per user decision. |

The browser pass demonstrates the listed happy paths and selected hard gates, not exhaustive certification of every optional branch. Approved CG/envelope calculations remain deferred; the UI explicitly says weight-only.

## New fixes

- **Booking date:** UTC `requested_departure_at.slice(0,10)` searched tomorrow for an Alaska evening booking. Use company-calendar date, matching Fleet Board. Original regression failed; all 29 booking-detail tests passed after. Local browser on the same booking/API showed DEMO104.
- **Intermediate stops:** use shared route formatter in manifest schedule, ramp flight cards, departing ramper list and EOD. DEMO103 no longer reads PANC → PANC instead of PANC → PABE → PANC.
- **FRAT pilot context — services PR #364:** prefill duty/currency/recent-type history and previous-block lookup now use the same tenant-scoped assigned-PIC resolver as filing. Four dispatcher/Exec Admin regressions failed before; 102 relevant backend tests and Ruff passed after. Not deployed.
- **Resolved squawk audit:** expose existing resolution notes, resolver and local/Zulu time in a native disclosure. Original regression failed; local browser read the live saved closure record.
- **Completed release record:** retain the saved dispatch PDF download after completion/cancellation when a release exists; hide actions that would attempt to generate/release a closed flight. Original regression failed; local download retrieved six-page retained packet with the live signed FRAT.
- **Closed-flight descriptions:** cancelled/completed packets no longer label themselves Released or instruct users to pull back a closed flight; locked PIC is labeled locked.
- **Pilot review wording:** planning notes are identified as planning notes; the full PDF contains the separate dispatcher instructions. The live packet retained the explicit synthetic dispatcher note.
- **Calendar hints:** Tomorrow no longer claims a rolling 24–48-hour window when the next company-calendar day starts in under an hour.
- **Ground worklist:** exclude completed/cancelled flights from actionable team loads; their records remain on the operations overview.

The React review retained server components, shared formatting, native disclosure semantics, existing authorization and backend gates. No new dependencies, credentials, schema migrations or AI write capabilities.

## Trace identifiers

Demo collection prepared Nov 3 23:03:26 America/Anchorage (Nov 4 Phoenix/UTC). No second refresh during testing. Tests crossed Alaska midnight; historical Nov 3 evidence remains Nov 3, while new-day boards correctly change dates.

- Main outbound DEMO104: `62b43648-3c15-47be-9861-22993295aed5`, N94DM.
- Outbound booking: `11cb4480-bb8d-4c7b-8aa7-0d13d5775fd8`; preserved return: `bb907943-dd25-4bf2-b5b1-85b27973fa71`.
- Cancelled original return DEMO107: `0753be6d-e6dc-4334-bc26-212e11d12704`; replacement DEMO108: `bc991441-d036-4971-86dd-ae1112e8cb75`.
- Pilot log: `e0ce4384-5aff-49ba-a77d-10155fe3bf6f`, LOG-20261104-084340, 0.1 h airborne / engine / Hobbs, explicit synthetic routing annotation.
- FRAT audit: `3825-D1EC-ADC5`; SHA256 `3825d1ecadc52acdbbe13e2e4daf8ec954dc84e068abc4b33f7eef57f8c5e4ed`.
- Course: `e2f6a4a1-f2d3-4fe1-ae0d-7943997ad9d2`; no linked currency item.
- Author enrollment/certificate: `60a7b22f-6620-4f74-a454-f5f8db9c3a95` / ACAD-60A7B2-2026.
- Separate learner enrollment/certificate: `056fdb68-bc04-4479-a434-379e5a7bc66e` / ACAD-056FDB-2026 (`a02caff9-203f-43af-928b-ef05eac80d3c`).
- Synthetic photo: `847d7004-27ea-4cd1-a6ce-fa0f385e1aeb` on DEMO105, General category, explicit test-only note.

## Evidence and validation

Files named `production` show the live deployed site. Files named `local` show proposed frontend fixes against the same active synthetic API, never a deployed fix. `signed-frat-production.pdf` is the live signed record; `retained-dispatch-packet-live-api.pdf` came through the repaired local download link against that API. The six-page contact sheet is visual review evidence.

Final validation: all 4,235 frontend tests (471 files), full lint, TypeScript and git diff whitespace checks passed. Backend: 102 relevant integration tests and Ruff passed. No claim that a merged service is deployed until the active host is verified.
