# Free Contract Engine — Technical Design

Status: design specification for the MVP. The current `index.html` implementation is a browser-only simulator, not a production contract engine.

## 1. Product rules

| Rule | Value |
|---|---:|
| Contract | Free virtual contract demo |
| Session duration | 8 hours |
| Points per completed session | 10 simulated points |
| Maximum session starts | 3 per local date |
| Maximum points per active date | 30 |
| Required active dates | 30 distinct dates |
| Missed activation | Pause; preserve completed progress |
| Cycle type | Rolling active-day count, not calendar month |
| Planned minimum withdrawal | USD 5 equivalent, disabled |
| Current point value | No cash or crypto value |

A session is one eight-hour interval. A new session cannot start while another is active. Session starts are limited to three per local date. A date becomes an active date only after at least one session started on that date completes. Additional completed sessions on that date add 10 points each, up to 30 points total for that date.

A contract cycle completes after 30 distinct active dates. The user may therefore complete the cycle with 300–900 simulated points depending on whether they complete one, two or three sessions on each active date. Missing dates do not count, but they do not erase prior active dates or points. This is a 30-active-day rule, not a promise that completion takes exactly 30 calendar days.

The browser demo uses the visitor's current local date. Production must use a server-defined timezone/day-boundary policy that is fixed for the contract; do not trust the browser timezone or clock.

## 2. State model

Contract states:

- `not_started`: no session has been activated.
- `active`: an eight-hour session is running.
- `paused`: no session is running and the 30-active-day cycle is incomplete. A missed date leaves the contract paused without loss of progress.
- `completed`: 30 distinct active dates have been recorded.
- `under_review`: optional future risk/compliance hold. This must not silently erase points.
- `eligible`: optional future state after review, only for a separately funded and legally approved reward program.

Session states:

- `active`: server-issued start and end timestamps exist.
- `completed`: the full eight-hour interval elapsed and exactly one completion event was posted.
- `cancelled`: only if a documented future policy allows cancellation. Cancellation does not create points.

Transitions:

```text
not_started -> active -> completed -> paused -> active
                                  \-> completed contract (after 30 active dates)
paused -> active
completed -> no new sessions in the same cycle
```

A session started before midnight is attributed to its activation date even if it ends after midnight. This rule avoids a session counting against two dates.

## 3. Production data model

Use a relational database as the source of truth. Suggested tables:

### `contracts`

- `id` UUID primary key
- `user_id` foreign key
- `contract_type` (for example, `free_virtual_v1`)
- `status`
- `rules_version`
- `timezone` fixed when the contract is created
- `started_at`, `completed_at`
- `created_at`, `updated_at`

### `contract_sessions`

- `id` UUID primary key
- `contract_id` foreign key
- `user_id` foreign key
- `activation_day` date in the contract's fixed timezone
- `started_at`, `ends_at` server timestamps
- `status`
- `completion_event_id` unique nullable reference
- `idempotency_key` unique
- `created_at`

Constraints: one active session per contract; no more than three session starts per activation date; `ends_at = started_at + 8 hours` according to the server's stored rule. Enforce these through database transactions/constraints or a serialized server-side activation operation, not JavaScript alone.

### `contract_active_days`

- `contract_id`
- `activation_day`
- `first_completed_session_id`
- `completed_at`

Unique key: (`contract_id`, `activation_day`). Insert only when the first session for that date completes. This table is the source of the 30-day progress count.

### `points_ledger`

- `id` UUID primary key
- `user_id`
- `contract_id`
- `session_id`
- `event_type` (`session_reward`, `reversal`, `admin_adjustment`)
- `points_delta` signed integer
- `idempotency_key` unique
- `rules_version`
- `created_at`
- `metadata` JSON

Use append-only entries. Never update a past credit to rewrite history; corrections are new reversal or adjustment entries with an audit reason. The points balance is a sum/projection of ledger entries, not a client-editable field.

### `admin_audit_logs`

Record actor, action, target, before/after metadata, reason, timestamp and request context for all privileged actions. Require server-enforced role checks and MFA for production administration.

## 4. Server-side operations

### Activate a session

1. Authenticate the user.
2. Begin a database transaction and lock the contract row.
3. Confirm contract is not completed or under review.
4. Confirm no active session exists.
5. Calculate the activation date using the contract's fixed timezone.
6. Count starts for that date; reject if three already exist.
7. Create a session with server timestamps and an idempotency key.
8. Commit and return the authoritative end time.

### Complete a session

A scheduled worker should scan due sessions. A user request may also trigger the same idempotent completion routine, but it must never supply its own completion time.

1. Lock the session and contract rows.
2. Confirm status is active and server time is at or after `ends_at`.
3. Insert exactly one 10-point ledger credit using a unique key derived from the session ID.
4. Insert the active-day row if one does not already exist.
5. Mark the session completed.
6. If the active-day count reaches 30, mark the contract completed.
7. Commit atomically.

A repeated worker run or duplicate request must not award duplicate points. Use a unique constraint on the completion event/idempotency key.

### Read progress

Return points ledger totals, session state, completed active dates, starts used for the current activation date and contract status from the server. The client displays values but does not calculate authoritative balances.

## 5. Accounting and payout separation

The current points ledger is a non-cash engagement ledger. It must not be represented as a financial liability, USDT, mined cryptocurrency or a withdrawable balance.

If a real rewards program is approved later:

- Establish an actual funding source and reconcile it before creating redeemable credits.
- Keep the points ledger separate from the financial double-entry ledger.
- Define a published conversion rate, eligible events, fees, thresholds, reversals and payout timing before enabling conversion.
- Keep the proposed USD 5 minimum disabled until a real payout provider and cost model are approved.
- Do not use customer deposits or new-member payments to fund existing-user rewards.
- Do not use Google-served rewarded ads to fund cash or crypto-equivalent rewards; confirm written provider terms for every incentive type.
- A failed payout must restore the user's eligible balance through a compensating ledger transaction.
- Never make withdrawals deliberately impossible or hide the conditions users must satisfy.

The internal platform margin is a business accounting matter. It need not be displayed as a public split, but users must receive truthful, complete terms about how their own reward amounts are calculated and whether they are redeemable.

## 6. Security controls

- Server-authoritative clock and fixed contract timezone.
- Authenticated activation and completion endpoints.
- Transactional row locking and idempotency keys.
- Database uniqueness for one active session, one active-day row and one completion credit per session.
- Rate limits and abuse detection for account creation and activation endpoints.
- No client ability to submit points, end timestamps, completed days or payout status.
- Immutable point and financial journals; compensating entries for corrections.
- MFA, least-privilege roles and immutable admin audit logs.
- Backups, restore tests, monitoring and reconciliation alerts.

## 7. Current browser demo limitations

The current prototype stores demo state in `localStorage`. Visitors can edit or clear it, switch browsers/devices, change their system clock or use developer tools. It has no identity, shared database, authoritative server time, fraud checks or financial backing. It is suitable only for demonstrating the interface and product flow. Do not use it to decide real rewards, collect fees or authorize payouts.

## 8. Acceptance tests for production

1. A user can start one eight-hour session when eligible.
2. A second overlapping session is rejected.
3. A fourth session start on one activation date is rejected.
4. No points are credited before the session end timestamp.
5. Exactly 10 points are credited once after completion.
6. Retrying completion does not duplicate points.
7. At least one completed session creates exactly one active-day record for that date.
8. Additional sessions on that date award points but do not increase active-day progress twice.
9. A missed date does not erase points or active-day history.
10. The contract completes at 30 distinct active dates, not at 30 consecutive dates.
11. Browser clock changes and client payload edits do not change server state.
12. No demo points appear in the financial or withdrawal ledger.
