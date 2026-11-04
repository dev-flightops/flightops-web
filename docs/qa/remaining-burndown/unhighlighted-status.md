# Unhighlighted reports — reconciled status

Read from native Google Doc formatting on November 3 Phoenix / November 4 UTC. All 28 remain unhighlighted here; green remains reserved for the prior-commit fixes identified in the original audit. New UAT repairs are described explicitly rather than silently recolored.

| Report | Current disposition |
| --- | --- |
| 5 | Mixed: release/type checks already fixed; 1900D demo metadata repair merged. Missing real staff qualifications still require approved source records. |
| 6 | Historical imported overlaps/duplicate flights need source-record review. New release guards and distinct demo flights do not rewrite that history. |
| 8 | EOD correction merged in #445/#359 and passed prior local lifecycle acceptance; full deployed lifecycle replay remains separate. |
| 9 | Home/dashboard hold and unique-aircraft corrections merged in #445/#359; prior local browser totals reconciled. |
| 11 | New confirmed fix: AR still used the contact name while the invoice/picker used the company. Reuse Customer.bill_to in aging output. Production balances reconcile at 1,100 + 350 = 1,450; local before/after and 242 billing tests pass. No production financial writes or renumbering. |
| 14 | Old drafts require the responsible pilot/records reviewer. Do not fabricate submission or delete records; the existing draft-completion path remains available. |
| 15 | Production timing spot-check: Settings 1.99 s, Academy 1.02 s; no remaining Loading indicator. Single samples do not close an intermittent complaint. |
| 16 | Emergency-training seed description corrected in merged #359; prior learner completion/writeback verified 135.331. This was a new UAT repair, so left unhighlighted. |
| 18 | Original developer-copy cleanup merged; additional help-corpus cleanup is merged in #454. Historical synthetic reports are covered by item 47. |
| 21 | Scoped aircraft-type/name repair merged in #359/#445. Do not invent staff authorizations. |
| 22 | Department/role labels are mapped correctly. Missing employee titles require actual personnel source data. |
| 23 | Mobile dock and contained table/filter layout fix merged in #445; prior responsive browser evidence retained. |
| 33 | Dead/unimplemented navigation removed or disabled. The substantial unbuilt maintenance subsystems remain separate feature projects. |
| 40 | Runway formatting/fake demo alias repairs merged; missing real runway records still require approved airport source data. |
| 42 | Hub station totals and Ramp flight/team counts are different populations. Display-code labels passed prior browser checks; no matching-population count defect reproduced. |
| 43 | Company-day, booking/assignment counts and capacity/search fixes merged in #445/#359; Fleet Board counts bookings, not flights/legs. |
| 44 | Past-date/no-flight flags and charter build lifecycle passed. Historical requests need an operator disposition rather than automatic cancellation. |
| 45 | Invoice-date register/amounts export merged in #445/#359 and browser-download verified. Old scenario notes remain item 47. |
| 46 | Production timing spot-check: Accounting Export 1.38 s; Settings/Academy as item 15. Intermittent timing remains unproven. |
| 47 | Legacy recurring tick guard merged in #359, refusing automatic network/credential use without explicit opt-in. Any externally scheduled old checkout and accumulated historical records still require source-environment review. |
| 53 | Deferred: approved aircraft empty-weight/moment, loading arms and CG envelope are required. Weight-only limitation is explicit; #454 corrects AI help. |
| 54 | Lower manifest crew-count/weight display repaired in merged #445; prior manifest tests and browser evidence retained. |
| 58 | Maintenance-aware ground/hold counts and unique airborne-aircraft correction merged in #445/#359. |
| 61 | Deferred-story developer wording removed in merged #445; additional stale AI/help wording is merged #454. |
| 62 | Seat assignment was already implemented and passed the prior weighed-passenger/boarding browser lifecycle. No fabricated seat assignments. |
| 63 | Mixed: existing release guards cover overloaded/unknown-route/unqualified/unsigned/high-risk cases. Full CG portion remains deferred under item 53. |
| 64 | Missing/unknown weather handling fixed; the operator must confirm its approved configurable minimums. Do not invent company policy. |
| 70 | New reproducible fix in this pass: serialized saves and flight-scoped optimistic state; five regression cases and delayed-save browser/DB proof. Exact remote latency is still a separate measurement. |


## November 4 production recheck

Historical green marks remain unchanged. Reports 8/9/43/54/58/62 were exercised again through live reservation → weighed manifest → dispatch → eight-step pilot flow → movement → corrected submitted log → EOD/aircraft-hours reconciliation; the return cancellation/reaccommodation preserved its passenger. Report 70's rapid PANC/PABE save sequence persisted after reload on deployed #455. Original intermittent timing and historical-data/source-policy items remain unproven or require their responsible owner's source records.

Report 11's backend correction (#363) is merged but rollout on the active manually updated tunnel host remains unverified. The user is obtaining host access. Phil's Academy journey passed both self-enrollment and separate administrator assignment → seeded learner completion → certificate → administrator record. Media/SCORM/view-time expansion remains separate.

Additional fixes from this pass: company-day booking candidate search, full intermediate-stop labels across operational views, saved release PDF access after flight completion, accurate closed-flight/flight-planning-note wording, company-calendar board hints, resolved-squawk audit visibility, and removal of closed flights from actionable ground loads. Backend PR #364 corrects dispatcher FRAT suggestions/history to use the assigned PIC. Full evidence and exact limits are in [production-recheck](../production-recheck/README.md); these are new UAT repairs, not historical-green closures.
