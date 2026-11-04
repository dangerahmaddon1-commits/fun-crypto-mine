# Fun Crypto Mine

A separate, compliance-first rewards platform prototype.

## Current state

The site is a static responsive prototype with a browser-only virtual contract demonstration. Firebase Authentication is connected in the preview for email/password and Google sign-in. User profile names are stored in Firebase Auth. Contract progress is still browser-local and is not synced to accounts. It is not connected to advertising providers, offerwalls, mining infrastructure, payment processors or cryptocurrency wallets. Demo points are stored in the visitor's browser, are editable/resettable, have no monetary value and are not withdrawable. No balances, earnings, payouts, mining output or subscription purchases are real.

## Public and member access

Visitors who are signed out can access only the public overview, membership information and help/rules. The dashboard, rewards, mining hub, virtual contract, wallet, activity ledger and account settings require Firebase sign-in. Authentication state is checked through Firebase Auth; the browser UI gate is not a substitute for server-side authorization.

The Admin console is shown only to the verified Google identity `dangerahmaddon1@gmail.com`, with Firestore rules independently enforcing owner access. This is the current first factor, not complete multi-factor protection. A second admin verification step must use Firebase Authentication MFA or a trusted server-side challenge/custom-claim flow; never embed an admin password or secret in client JavaScript. Until that is implemented, treat owner access as needing additional hardening.

## SEO and analytics

The public page now references the square `logo.svg` brand asset as its favicon, social preview image and Organization structured-data logo. Google may choose whether to display it and can take time to recrawl the site; this markup does not guarantee a branded search result.

The public overview includes a canonical URL, descriptive title and metadata, Open Graph/Twitter metadata and WebSite structured data. `robots.txt` and `sitemap.xml` expose the public homepage to crawlers. Vercel Web Analytics' script snippet was already present in `index.html`; it has been retained without adding a duplicate. Analytics data collection still depends on enabling Web Analytics for the project in the Vercel dashboard.

## Ad-blocker access check

A client-side ad-blocker bait check displays a full-screen access notice and retries detection after page load and when the visitor requests another check. This is a best-effort site-access gate, not a security control, and can be affected by aggressive privacy filters. No advertising provider or ad inventory is connected.

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


## Firestore member data foundation

The member data module uses the existing Firebase project `fun-crypto` and its default Cloud Firestore database. It creates a minimal user profile, a unique invite code, one-time referral attribution, membership requests and owner-managed membership records. It does not create financial balances, reward credits, purchases or payouts.

### Publish Firestore rules

The repository includes `firestore.rules` and `firebase.json`. Publish the rules to the existing `(default)` database before testing member data. You can use Firebase Console → Firestore Database → Rules and paste the contents of `firestore.rules`, then Publish. Do not use test mode. The rules restrict member profile reads/writes to the owner, referrals to the parties involved, and membership administration to the verified owner Google identity `dangerahmaddon1@gmail.com`. Client-side hiding is not the security boundary.

The owner must sign in with Google using that exact verified address for Firestore admin permissions. Email/password sign-in alone is not sufficient.

### Membership and referrals status

- Invite codes and referral attribution are for tracking only. No referral commissions or rewards are active.
- Membership requests are requests for manual review, not purchases. There is no checkout or payment collection.
- Only the owner can activate or reject a membership request. Activation is a manual account entitlement and must follow independently verified payment or an explicitly complimentary decision.
- Withdrawal requests are an intake queue only: the site does not calculate eligible balances, reserve funds, or send crypto. The owner must independently verify source funds, eligibility, destination and network before approving; marking paid requires an external transaction reference. No payout is promised.

## Deploy

Static site entry point: `index.html`. No build command is required. Changes are developed on a feature branch and must be reviewed before merging.

## Next milestones

1. Review the virtual contract UI and rules.
2. Select and configure an authenticated backend with server-side time and database constraints.
3. Implement contract/session tables and an immutable points ledger.
4. Add idempotent completion processing, fraud controls and admin audit logs.
5. Assess approved reward providers and payout infrastructure only after legal review.
