# Academy and AI journey follow-up

Phil requested Academy lesson creation/completion and explicit AI capabilities/limits in each founder journey. `journey-additions.md` captures the new journey and detailed helper clauses; the native Google Doc also has a short AI clause inside each original journey.

Production browser verification (Nov 3 Phoenix / Nov 4 UTC), using an explicitly synthetic course with **no compliance link**:

- Course authoring, lesson/quiz persistence, publication and self-enrollment.
- Failed quiz retained as a non-passing attempt; passing attempt unlocked Mark Complete without completing the lesson.
- Mark Complete produced a completed enrollment, persisted My Training entry and certificate **ACAD-0C5CE5-2026**.
- Administrator Assignments showed the same completion and successfully assigned the course to Prepared Demo Pilot (Assigned 1 / Skipped 0).
- A separate pilot-login completion was not performed. The administrator acted as author and learner for the completed example.
- Academy Reports remains a placeholder. Assignments and Certificates are the implemented evidence surfaces.

Confirmed defects and code changes:

1. **Empty-course dead end:** production allowed enrollment in a published zero-lesson course and stranded it at 0/0. Backend companion rejects new self/admin/bulk enrollments before any write. Frontend creates drafts, disables Published until a lesson exists, and explains empty-course recovery instead of offering enrollment. Legacy empty enrollments are retained and recover when an author adds content.
2. **Incorrect AI instructions:** production Assistant explicitly claimed passing automatically records completion and advertised a nonexistent assignment due-date field. Corrected the actual help corpus and added author/learner guides; also removed stale Assistant/Home/Maintenance capability descriptions. The local screenshot is corrected help content, not a claimed post-deployment model response.
3. **Lesson authoring clarity:** title/body controls lacked accessible names, and the plain-text player was advertised as accepting rendered Markdown. Added names and truthful plain-text hints. Completed learners now have a direct link to Certificates.

Backend PR: https://github.com/dev-flightops/flightops-services/pull/362

Validation:

- All 4,204 frontend tests passed under Node 22 (467 files). This host's Node 26 made jsdom localStorage undefined in two unrelated pre-existing suites; the project's Node 22 runtime passed them unchanged.
- Final focused Academy/help checks: 50 passed; lint and TypeScript passed.
- Production Next.js build passed using the local API URL, never production as a local test default.
- Academy backend: 86 tests passed against a newly created dedicated test database; exact Ruff 0.7.4 passed. No migration required.
- Local browser confirmed draft-only creation, disabled empty-course publication and corrected help text. No shared production dataset reset.

The original numbered bug ledger remains in `../uat-burndown.md`. CG remains deferred pending approved aircraft data; the LMS media/SCORM/view-time expansion remains a separate project. Unknown legacy staff qualifications, imported flights and company policy are not fabricated to make tests pass. Green in the original Google Doc continues to mean prior-commit fixes, not these new changes.

The synthetic production course and its audit/certificate records are retained as clearly named UAT evidence; it must never be used as regulatory qualification evidence. Its course ID is `44677d65-be76-4b95-a715-4f2a51ccc4d8`.

An initial GitHub Desktop push inherited origin/main. The change was immediately reverted with a normal revert; main's file tree was verified identical to its previous state. The isolated backend PR reapplies the guard for review. No force push or destructive data cleanup was used.
