# Fun Crypto Mine

A separate, compliance-first rewards platform prototype.

## Current state

The site is a static responsive prototype with a browser-only virtual contract demonstration. It is not connected to authentication, advertising providers, offerwalls, mining infrastructure, payment processors or cryptocurrency wallets. Demo points are stored in the visitor's browser, are editable/resettable, have no monetary value and are not withdrawable. No balances, earnings, payouts, mining output or subscription purchases are real.

## Virtual free-contract demo

- One session lasts 8 hours.
- Each completed session awards 10 simulated points.
- Up to three sessions may be started per local calendar date.
- A local date counts as one active day after at least one session started on that date completes.
- The cycle completes after 30 distinct active days.
- Missing a day pauses progress; it does not erase completed active days or points.
- Up to 30 simulated points can be earned per active date. A full 30-day cycle can therefore produce up to 900 demo points if all three sessions are completed on every active date.
- This is a UI demonstration only. Browser storage is not authoritative and must never be used for real balances or payouts.

## Product model

- Potential eligible surveys, sponsored tasks and offerwalls, only where provider terms permit.
- Potential independently verified mining proceeds as a separate future module.
- Premium subscriptions, if launched, provide software features only; no guaranteed earning increase.
- Crypto payouts and any points-to-value conversion are disabled pending legal, provider, security, funding and compliance approval.
- Internal margin and revenue-allocation assumptions are not presented as public reward promises. User-facing reward rules must still explain eligibility, calculations, fees, reversals and payment timing accurately.

## Security and launch gates

Do not accept deposits, sell mining contracts, issue tokens, activate paid subscriptions or process withdrawals until legal, licensing, tax, privacy, security, provider and operational requirements have been reviewed and approved. Never present virtual mining visuals as actual mining or promise fixed returns.

Production contract progress must be server-authoritative. Do not trust browser clocks, localStorage, client-calculated balances or client-submitted session completions. Use immutable, idempotent ledger events, signed provider webhooks, reconciliation, risk controls and admin audit logs. Keep non-cash demo points separate from any future financial ledger.

## Deploy

Static site entry point: `index.html`. No build command is required. The current branch is a draft preview and must be reviewed before merging.

## Next milestones

1. Review the virtual contract UI and rules.
2. Select and configure an authenticated backend with server-side time and database constraints.
3. Implement contract/session tables and an immutable points ledger.
4. Add idempotent completion processing, fraud controls and admin audit logs.
5. Assess approved reward providers and payout infrastructure only after legal review.
