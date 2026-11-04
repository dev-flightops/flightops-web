# Phil follow-up — Academy and AI assistance

Verified November 3, 2026 (Phoenix; November 4 UTC). These are additions to the eight founder journeys above. Earlier November 1 findings remain historical evidence, not a statement that the current production build still has every reported defect.

## Verification status

The journeys are acceptance targets, not a guarantee of flawless production behavior. Prior local walkthroughs passed after fixes; production spot checks confirmed the current-day demo, flight boards and invoice export. This follow-up verified Academy authoring through completion in production, and found an empty-course enrollment defect. Do not describe every journey or every AI provider integration as production-certified. CG/envelope calculations still require approved aircraft weight-and-balance data; the larger media/SCORM LMS expansion remains a separate project.

## Journey 9 — Create an Academy lesson and document completion

Primary users: Chief Pilot / DO / executive admin as course author; the assigned learner; training administrator reviewing the record.
Trigger: A new company lesson must be delivered and its completion evidenced.

Happy path:
1. Open Academy → Course Studio → New Course. Enter a clear title, description, category and certificate validity. Create a draft.
2. Under Add a lesson, enter a title and lesson text, then Add Lesson. Repeat in learner order as needed.
3. For an assessment, choose Attach Quiz on that lesson. Save the quiz title and pass threshold; add questions, answer options and the correct answer. Return to the course in Studio.
4. Leave Linked currency item at No link for a demo or general exercise. Link approved training only when it actually satisfies an eligible currency item; never use synthetic completion to establish a pilot's qualification.
5. Set Publish status to Published and Save. Open Training assignments, choose the course and learners, assign, and confirm their enrollments. Alternatively, a learner can open a published course and Enrol.
6. As the learner, open My Training and the course. Read a lesson and take its quiz if attached. A failed attempt must leave the lesson incomplete; review feedback and retry.
7. After passing, return to the lesson and select Mark Complete. Passing a quiz alone does not complete the lesson. Repeat until every lesson is marked complete.
8. Confirm Completed, completed-lesson count and completion/expiry dates. Open Academy → Certificates, open the issued certificate, and verify learner, course, certificate number and dates. My Training must retain the completed record after navigation/reload.
9. As training administrator, verify the enrollment/completion in Training assignments and the issued certificate in Certificates. Aggregate Academy Reports and CSV export are not implemented; use the underlying Assignments and Certificates records. A general course with No link must not change regulatory currency.

Acceptance checks:
- A course with no lessons must not accept a new self-enrollment or assignment that can never finish. Draft authoring stays hidden from learners.
- The course, lesson and quiz persist after leaving and reopening the editor. Quiz answers and pass/fail history belong to the correct enrollment.
- Failed quiz → no lesson completion. Passed quiz → Mark Complete unlocked. Mark all lessons complete → one completed enrollment and its certificate; repeated completion is idempotent.
- Learner and administrator views agree on who completed what and when. UTC labels on recorded dates are explicit; a late Phoenix/Alaska evening can be the following UTC date.
- A certificate proves this Academy course completion; qualification/currency depends on approved linked training and policy, not the existence of a demo certificate.

AI assistance for Journey 9:
Peregrine Assistant can explain navigation, lesson creation, assignment, quiz gating and completion from the app's help. It receives the page and help content, not live learner records. Example: “How do I create a lesson and record its completion?” Verify its instructions against the actual controls. It cannot create/publish a course, assign a learner, answer the assessment or mark completion. Fleet Brain and AI Query do not provide Academy enrollment/certificate lookup; use My Training, Assignments and Certificates for evidence.

Current limits: text lessons and optional lesson quizzes are implemented. Media uploads, SCORM import/player, lesson viewing-duration tracking aggregate Academy Reports/CSV, and AI course authoring are outside the existing workflow.

Production evidence: synthetic course “UAT — Academy lesson completion — 3 Nov”, course ID 44677d65-be76-4b95-a715-4f2a51ccc4d8; enrollment 0c5ce578-c54e-4a7a-ae5c-faea608a097a; certificate ACAD-0C5CE5-2026. Actor: Peregrine Admin, acting as author and learner. No compliance link. The failed and passing quiz attempts, explicit Mark Complete, completed My Training entry and issued certificate were observed in the browser. Assignment to Prepared Demo Pilot was subsequently verified (Assigned 1 / Skipped 0); the administrator also saw its 0/1 in-progress enrollment and the admin learner’s 1/1 completed enrollment. Aggregate Academy Reports is an explicit unavailable feature, not a passed check.

## AI assistance — attached to each existing journey

The following clauses extend the corresponding numbered journeys. All recommendations remain advisory. A helper showing a useful answer does not replace the underlying record, operator policy, release gate or authorized person's sign-off. Model-dependent helpers require a configured provider and may be unavailable; that should be shown explicitly rather than treated as a successful answer.

### Journey 1 — Reservation and manifest
Peregrine Assistant explains booking/search/return-leg and recovery steps, but cannot inspect live seats, book a passenger or change a manifest. AI Query can read supported booking/flight fields for authorized leadership, with a bounded result set (default 50, maximum 200 rows); it cannot perform arbitrary joins, write a booking or certify that every matching record was returned. Example: ask how to book a return trip, then verify both dates, legs and passenger occupancy on the actual booking and manifest. CSA access must not imply access to leadership-only AI Query.

### Journey 2 — Schedule and disruption
Fleet Brain answers supported, read-only flight/fleet/crew/maintenance questions from tenant records. Ops Brief summarizes the recorded operating day. Dispatch Intelligence ranks candidate next legs for airborne aircraft using scheduled and waiting demand, configured costs and operational blocks; it is deterministic planning logic, not a general-purpose AI optimizer. It needs an eligible airborne example and demand. None creates, swaps, cancels or approves a flight. Delay Alerts uses historical route lateness/cancellations and aircraft maintenance context; it does not receive current weather or crew data. Example: inspect today's brief and a candidate next leg, then verify schedule, actual payload, weather and crew gates before an operator changes anything.

### Journey 3 — Dispatch and release
Peregrine Assistant explains packet steps without live flight access. Fleet Brain can surface recorded crew/aircraft status; its “legal” answer is limited to recorded data and the requested date, not dispatch clearance. Dispatch Intelligence suggests planning options, not a release. Document Limits can propose supported company wind/weather limit fields from an extracted document marked as a compliance source, with verified source quotations; an authorized person must review/apply a proposal. It cannot infer an approved aircraft CG envelope or approve operator policy. AI Review remains unavailable; the working packet Assistant is a different feature. Example: ask why release can be blocked, then demonstrate the actual hard gate, both signatures and named approval on the packet. No helper may bypass them.

### Journey 4 — Pilot acceptance and flight
Peregrine Assistant explains duty, briefing, FRAT and time-entry controls; it cannot see the pilot's actual enrollment/flight or sign acceptance. Fleet Brain supports recorded crew/hours/currency questions and caller-scoped self questions; verify the date and the actual crew record. No helper declares fitness, signs a FRAT, accepts a release or records movement for the pilot. Actual-movement tracking may record an audited operational exception rather than prevent recording an event that already happened; that is not permission to depart outside the release process. Example: ask how to return an overweight flight, then use the actual Return to dispatch workflow and verify the revised manifest.

### Journey 5 — Gate, ramp, loading and fuel
Peregrine Assistant explains check-in, manifest locking, load-team acknowledgement/completion, bumped items and fuel controls. It does not see live weighed passengers, loading photos, stock or supplier orders and cannot perform these actions. Dispatch Intelligence's planning weights are not a substitute for the actual weighed manifest. Example: ask how to recover a bumped bag, then show its waiting/reassignment record and the changed source/destination load. Verify fuel type, quantity and station/aircraft holds in the actual fuel form.

### Journey 6 — Records and closeout
Fleet Brain and Ops Brief summarize supported operational facts; AI Query supports flights, aircraft, squawks, work orders and bookings only. It does not query invoices, Academy records or every compliance source, and its row cap must be considered. None writes an e-log, closes the day, posts an invoice or reconciles the ledger. Peregrine Assistant explains those workflows but cannot read the records. Example: compare a flight count returned by a helper with the correctly dated EOD/Flight Following records; reconcile invoices with accounting/CSV, not AI prose. Repeating a flight number requires date/leg context.

### Journey 7 — Squawk and maintenance
MX Intelligence offers read-only maintenance guidance from the operator's recorded maintenance context, optionally scoped to an aircraft. Fleet Brain can list supported maintenance facts. Neither signs off work, returns an aircraft to service, grants a legal deferral or replaces approved maintenance manuals and the authorized maintainer. Peregrine Assistant explains filing/linking work. Example: ask about the selected aircraft's open issues, inspect the cited underlying squawk/work order, then perform the authorized maintenance action and verify dispatch sees the resulting hold/state. An answer with missing source evidence is not a maintenance disposition.

### Journey 8 — Executive operational picture
Ops Brief gives a read-only daily snapshot; Fleet Brain answers its supported operational intents; AI Query reads only its five supported entities with bounded rows. Safety Intelligence analyzes patterns from the last 90 days of hazard/incident reports, capped at the most recent 250 with omissions indicated; it drafts advisory findings, does not triage/close reports or corrective actions. Delay Alerts supplies a historical advisory, with weather and crew unassessed. Example: compare the brief with Home/Fleet Board/EOD, inspect any sampled/omitted data and trace a safety finding to a report. None guarantees a coherent story if source records are stale, missing or inconsistent, and none changes those records automatically.

## New defects and fixes in this follow-up

Academy empty-course dead end: reproduced in production by publishing a zero-lesson synthetic course, selecting Enrol, and landing on “0 of 0 lessons complete” with no completion path. Fix under review: API refuses new self/admin/bulk enrollments for zero-lesson courses before writing records; authoring UI starts courses as drafts and disables Published until a lesson exists; learner page and assignment errors explain the repair. Existing legacy empty enrollments remain recoverable when the author adds content. No destructive cleanup or production dataset reset.

Academy help/AI instructions: the help corpus incorrectly said quizzes unlock only at the end and a passing quiz automatically completes training, advertised a due-date control absent from Assignments, and described the working packet Assistant as unbuilt. Corrected help and two end-to-end Academy guides are included in the code change. These corrections are not yet deployed and are not green-highlighted as prior-commit fixes.

Still deferred: approved aircraft CG/weight-and-balance source data; the substantial LMS media/SCORM/viewing-tracking expansion; cleanup of legacy/imported operational records whose correct source values are not known. The original bug list remains the inventory; historical green marks continue to mean verified fixes from earlier commits, not new work from this follow-up.
