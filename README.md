# Fun Crypto Mine

A member rewards platform with server-authoritative one-hour reward sessions and manually processed USDT withdrawals.

## Current state

The site is a responsive member rewards platform with Firebase Authentication and a server-authoritative one-hour reward-session service. Session starts and completions are processed through an authenticated Vercel API using Firebase Admin SDK and stored in Firestore. Each completed session credits 10 points and creates a server-side ledger event atomically with the account update. The wallet converts 1,000 points to 1 USDT, with a 5 USDT minimum withdrawal. The owner reviews requests and sends USDT manually; the server reserves points while a request is pending or approved and deducts them only when the owner records the successful transfer and transaction reference. No automated crypto transfer or actual blockchain mining is implemented.

## Public and member access

Visitors who are signed out can access only the public overview, membership information and help/rules. The dashboard, rewards, mining hub, virtual contract, wallet, activity ledger and account settings require Firebase sign-in. Authentication state is checked through Firebase Auth; the browser UI gate is not a substitute for server-side authorization.

The Admin console is available only to the verified Google identity `dangerahmaddon1@gmail.com` after a separate server-side password check. The backend issues a short-lived custom claim, and Firestore rules enforce its 15-minute expiry on every protected operation. The second-factor password and Firebase service-account key are server-only Vercel environment variables; never embed either secret in client JavaScript or commit them to GitHub. Admin access remains locked until those environment variables are configured.

## SEO and analytics

The public page now references the square `logo.svg` brand asset as its favicon, social preview image and Organization structured-data logo. Google may choose whether to display it and can take time to recrawl the site; this markup does not guarantee a branded search result.

The public overview includes a canonical URL, descriptive title and metadata, Open Graph/Twitter metadata and WebSite structured data. `robots.txt` and `sitemap.xml` expose the public homepage to crawlers. Vercel Web Analytics' script snippet was already present in `index.html`; it has been retained without adding a duplicate. Analytics data collection still depends on enabling Web Analytics for the project in the Vercel dashboard.

## Ad-blocker access check

A client-side ad-blocker bait check displays a full-screen access notice and retries detection after page load and when the visitor requests another check. This is a best-effort site-access gate, not a security control, and can be affected by aggressive privacy filters. No advertising provider or ad inventory is connected.

## Virtual Mining Hub

- One new session lasts 1 hour. Existing browser-local 8-hour demo sessions are allowed to finish after the duration change; new sessions use the 1-hour duration.
- Each completed session awards 10 points, recorded in the server-side account.
- There is no daily session cap or 30-day cycle.
- A member may start another session as soon as the previous one completes.
- Only one active session is allowed per account at a time.
- This is a UI demonstration only. Browser storage is not authoritative and must never be used for real balances or payouts.

## Product model

- Potential eligible surveys, sponsored tasks and offerwalls, only where provider terms permit.
- Potential independently verified mining proceeds as a separate future module.
- Premium subscriptions, if launched, provide software features only; no guaranteed earning increase.
- Points redeem at 1,000 points = 1 USDT. Minimum withdrawal is 5 USDT. Requests are owner-reviewed and manually paid; no exchange or wallet integration sends funds automatically.
- Internal margin and revenue-allocation assumptions are not presented as public reward promises. User-facing reward rules must still explain eligibility, calculations, fees, reversals and payment timing accurately.

## Security and launch gates

Do not accept deposits, sell mining contracts, issue tokens, activate paid subscriptions or process withdrawals until legal, licensing, tax, privacy, security, provider and operational requirements have been reviewed and approved. Never present virtual mining visuals as actual mining or promise fixed returns.

Contract session progress is server-authoritative. The endpoint verifies Firebase ID tokens, uses server time, enforces one active session at a time without daily or cycle caps, and writes a unique completion event with the account update in one transaction. These points are the balance used by the wallet redemption flow; they are not evidence of blockchain mining output.


## Firestore member data foundation

The member data module uses the existing Firebase project `fun-crypto` and its default Cloud Firestore database. It creates a minimal user profile, a unique invite code, one-time referral attribution, membership requests and owner-managed membership records. Reward points are maintained by the server-side contract account and the wallet API handles redemption requests and payout settlement.

### Publish Firestore rules

The repository includes `firestore.rules` and `firebase.json`. Publish the rules to the existing `(default)` database before testing member data. You can use Firebase Console → Firestore Database → Rules and paste the contents of `firestore.rules`, then Publish. Do not use test mode. The rules restrict member profile reads/writes to the owner, referrals to the parties involved, and membership administration to the verified owner Google identity `dangerahmaddon1@gmail.com`. Client-side hiding is not the security boundary.

The owner must sign in with Google using that exact verified address for Firestore admin permissions. Email/password sign-in alone is not sufficient.

### Membership and referrals status

- Invite codes and referral attribution are for tracking only. No referral commissions or rewards are active.
- Membership requests are requests for manual review, not purchases. There is no checkout or payment collection.
- Only the owner can activate or reject a membership request. Activation is a manual account entitlement and must follow independently verified payment or an explicitly complimentary decision.
- The wallet API validates requests against the server-side points balance and reserves points for pending or approved requests. The owner verifies available funds, destination and network, sends USDT manually, then records the external transaction reference. Points are deducted only when the request is marked paid.

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

USDT withdrawals are manual. The wallet API calculates available points, enforces the 5 USDT minimum and 1,000:1 conversion, prevents overlapping open requests, and atomically deducts points plus writes a ledger entry only when the owner records a successful external transfer.
