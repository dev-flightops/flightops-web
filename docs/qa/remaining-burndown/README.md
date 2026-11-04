# Remaining bug burn-down — November 3–4, 2026 (Phoenix)

The original document has **45 green numbered reports and 28 unhighlighted reports**. Formatting was read from the native document export, not inferred from an older local ledger. Some unhighlighted reports are mixed items or fixes from the earlier UAT pass; absence of green does not mean every part remains broken. The existing green highlights are preserved.

Academy fixes are in web #449 and services #362. Both code CI pipelines passed (web CI; all 19 backend checks). The PRs remain open. The web Vercel fork preview requires deployment authorization, separate from code CI.

## Dispatch acknowledgments — item 70

**Story:** a dispatcher changes a packet's acknowledgment → the server action writes the caller's acknowledgment → the API/database persist the latest choice → the same packet reads it back, without copying state to another flight.

Confirmed against original `origin/main`:

- A second save could start before a slower first save finished. A delayed tick followed by a faster untick could leave the server ticked despite the user's final unticked choice.
- Optimistic state and the debounce queue survived a flight-ID change. A PANC tick on PGR322 appeared checked on PGR326, although PGR326's PANC database record was withdrawn and its release gate still flagged it.
- An older failed save could roll back a newer queued choice.

Fix: serialize saves within each flight/kind, retain later queued choices, keep optimistic state separate for each packet, drain unsaved choices against their original flight on navigation, and refresh the packet after the queue drains. Saving state includes the debounce/queue as well as the request. Hard release gates, per-user attribution and audit history remain enforced.

| Boundary | Evidence |
| --- | --- |
| Original failure | Two regression tests failed against original main; delayed writes overlapped and a new flight inherited the earlier checkbox state. |
| Browser before | `ack-carried-to-second-flight-before-local-delayed.jpg`: PGR326 shows PANC checked while its release gate flags PANC. Local database confirms no active PANC acknowledgment on PGR326. |
| Browser after | `ack-second-flight-clean-after-local-delayed.jpg`: same navigation keeps PGR326's PANC unchecked, consistent with its gate and database. |
| Final choice | With a test-only 5,000 ms POST delay, the final untick was made at 1,436 ms, while the first POST was still running. The final database record is withdrawn; the reloaded packet remains unchecked (`ack-final-untick-persisted-after-local.jpg`). |
| Audit | Withdrawals retain acknowledgment history; no rows were deleted and no flight was released. |

The delay was injected only into the local Docker route to reproduce slow responses. The original backend file was restored and the container restarted afterward; no delay, diagnostic logging or backend change is included in the PR. Production data was not changed. This establishes a reproducible ordering/state defect; it does not claim the exact production 10-second latency has been diagnosed or eliminated.

Five new regression cases cover serialized tick/untick, flight switching, an older refusal followed by a newer choice, stale server props during a pending untick, and an old-flight failure arriving after navigation. The existing server-reconciliation test now waits for the save to settle before treating later server props as authoritative.

## Work-order list

Original item 36 is already green and works in production: old open work orders show Overdue in both list and detail; completed/closed records are not overdue. `overdue-work-order-detail-production.jpg` confirms WO-2026-1009, due August 26.

An adjacent defect was confirmed: the default view was labeled **Active**, yet displayed closed/completed orders. Its query deliberately retrieves all statuses. Rename the label **All** to reflect its real scope; named status filters remain available. Browser verification of the local Closed filter returns one closed order.

- Before: `work-orders-active-includes-closed-before.jpg`
- After: `work-orders-all-label-after-local.jpg`, `work-orders-closed-filter-after-local.jpg`

## Checks

- Complete frontend suite: **4,217 tests / 468 files passed** under Node 22.
- Dispatch packet suite: **361 tests / 41 files passed**.
- Lint and TypeScript passed.
- Production build and final diff checks are recorded with the PR after browser verification.

Current production financial readback and the status of all 28 unhighlighted reports are documented separately in `unhighlighted-status.md`. Historical financial or flight records are never rewritten merely to make a screenshot or total look consistent.

## Invoice/AR identity — item 11

Production readback confirms the numerical balance now reconciles: INV-000001 is 1,500 total less 400 paid = 1,100; the demo invoice is 450 less 100 = 350; the register and AR total are 1,450. Void invoices are excluded. No production financial records were changed.

A remaining identity defect was reproduced: the invoice says **Northrup Fisheries**, with **Attn: Alice Northrup**, but its AR row still says **Alice Northrup**. The aging query selected `Customer.full_name` instead of the invoice's existing `Customer.bill_to` rule. The backend fix reuses that rule for corporate/agency accounts, preserving the individual-name fallback and all amounts, customer IDs and aging buckets.

Local browser proof uses an explicitly synthetic $1 invoice to **UAT Corporate Account**, contact **UAT Billing Contact**. Before the backend fix AR showed the contact; afterward it shows the company. The total stays **351.00** in both screenshots (the $350 demo balance plus this $1 fixture). After verification, the fixture invoice was voided through the normal API with its synthetic-test reason; no payment or external invoice was sent.

- Before: `ar-contact-name-before-local.jpg`
- After: `ar-bill-to-name-after-local.jpg`
- Production diagnosis: `ar-contact-name-before-production.jpg`, `legacy-invoice-customer-payment-production.jpg`
- Backend checks: **242 billing tests passed**, including corporate-name trimming, blank-company fallback and individual-account behavior; Ruff 0.7.4 passed. Tests assert the name change leaves money and customer IDs unchanged.

Invoice-number history is not rewritten by this change. The mixed original report remains unhighlighted, with this narrower fix documented explicitly.

Backend AR fix PR: https://github.com/dev-flightops/flightops-services/pull/363
