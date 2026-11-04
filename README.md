# Fun Crypto Mine

A separate, compliance-first rewards platform prototype.

## Current state

The site is a static responsive prototype with a browser-only virtual contract demonstration. Firebase Authentication is connected in the preview for email/password and Google sign-in. User profile names are stored in Firebase Auth. Contract progress is still browser-local and is not synced to accounts. It is not connected to advertising providers, offerwalls, mining infrastructure, payment processors or cryptocurrency wallets. Demo points are stored in the visitor's browser, are editable/resettable, have no monetary value and are not withdrawable. No balances, earnings, payouts, mining output or subscription purchases are real.

## Public and member access

Visitors who are signed out can access only the public overview, membership information and help/rules. The dashboard, rewards, mining hub, virtual contract, wallet, activity ledger and account settings require Firebase sign-in. Authentication state is checked through Firebase Auth; the browser UI gate is not a substitute for server-side authorization.

The Admin console is available only to the verified Google identity `dangerahmaddon1@gmail.com` after a separate server-side password check. The backend issues a short-lived custom claim, and Firestore rules enforce its 15-minute expiry on every protected operation. The second-factor password and Firebase service-account key are server-only Vercel environment variables; never embed either secret in client JavaScript or commit them to GitHub. Admin access remains locked until those environment variables are configured.

## SEO and analytics

The public page now references the square `logo.svg` brand asset as its favicon, social preview image and Organization structured-data logo. Google may choose whether to display it and can take time to recrawl the site; this markup does not guarantee a branded search result.

The public overview includes a canonical URL, descriptive title and metadata, Open Graph/Twitter metadata and WebSite structured data. `robots.txt` and `sitemap.xml` expose the public homepage to crawlers. Vercel Web Analytics' script snippet was already present in `index.html`; it has been retained without adding a duplicate. Analytics data collection still depends on enabling Web Analytics for the project in the Vercel dashboard.

## Ad-blocker access check

A client-side ad-blocker bait check displays a full-screen access notice and retries detection after page load and when the visitor requests another check. This is a best-effort site-access gate, not a security control, and can be affected by aggressive privacy filters. No advertising provider or ad inventory is connected.

## Virtual free-contract demo

- One new session lasts 1 hour. Existing browser-local 8-hour demo sessions are allowed to finish after the duration change; new sessions use the 1-hour duration.
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


## Admin second-factor verification

Admin Firestore access now requires all of the following: the verified owner Google identity, a successful server-side second-factor password check, and a short-lived custom claim. The elevated admin session expires after 15 minutes; Firestore rules check the expiry on every protected operation. The password is never shipped to the browser.

Before the admin verification button can work, configure these **Vercel environment variables** for the environments you intend to test:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete Firebase service-account JSON for project `fun-crypto`. Create/download it from Firebase Console → Project settings → Service accounts. Paste the JSON as one environment-variable value. Keep its private key secret; never commit it or send it in chat.
- `ADMIN_SECOND_FACTOR_PASSWORD`: a unique, randomly generated password of at least 16 characters. Store it only as a Vercel encrypted environment variable. Do not reuse your Google or Firebase account password.

Redeploy the relevant Vercel environment after adding or changing either variable. The verification endpoint rejects non-POST requests, non-owner/non-Google ID tokens, expired or revoked tokens, and missing configuration. It applies a per-owner failed-attempt window and temporary lockout. Failed-attempt state is stored server-side in Firestore and is not client-readable.

After deployment, sign in using the owner Google account, open **Account**, enter the separate admin password and choose **Verify admin access**. The second-factor session lasts 15 minutes. When it expires, sign in with Google again and repeat verification. Do not share the second-factor password with anyone.

**Important:** Firebase Admin SDK service-account credentials grant broad project privileges. Use a dedicated service account with only the permissions needed for Firebase Authentication custom-token creation and Firestore access, restrict who can view Vercel environment variables, and rotate the key if it is exposed. If you do not want to manage service-account credentials, leave the admin console locked until a managed identity/MFA solution is configured.


## Admin operations overview and membership requests

The owner-only Admin console reads aggregate Firestore counts for total registered profiles, profiles created in the last 30 days, active membership records, pending membership requests, open withdrawal requests (pending or approved), and tracked referral sign-ups. The owner can refresh these counts and both review queues. These are account/Firestore counts, not visitor analytics; Vercel Web Analytics is a separate traffic metric.

Signed-in members can submit a Starter or Pro membership review request. Requests are manual-review intake only: they do not collect payment, activate a paid plan, or promise higher rewards. The owner queue can approve or reject requests, and an approved entitlement lasts 30 days.

Withdrawal requests remain manual-review intake only. An approved request is not paid until the owner has independently sent funds and records an external transaction reference. No balance calculation, automated payout, or withdrawable reward ledger is enabled.
