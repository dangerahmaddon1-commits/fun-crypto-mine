const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const endpoint = fs.readFileSync(path.join(__dirname, "..", "api", "admin", "verify.js"), "utf8");
const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");
const auth = fs.readFileSync(path.join(__dirname, "..", "auth.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const member = fs.readFileSync(path.join(__dirname, "..", "member-data.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("admin password is checked only in a serverless endpoint", () => {
  assert.match(endpoint, /process\.env\.ADMIN_SECOND_FACTOR_PASSWORD/);
  assert.match(endpoint, /crypto\.timingSafeEqual/);
  assert.doesNotMatch(auth + app + member, /ADMIN_SECOND_FACTOR_PASSWORD/);
});

test("admin endpoint requires a verified owner Google ID token", () => {
  assert.match(endpoint, /auth\.verifyIdToken\(match\[1\], true\)/);
  assert.match(endpoint, /decoded\.email_verified !== true/);
  assert.match(endpoint, /provider !== "google\.com"/);
  assert.match(endpoint, /OWNER_EMAIL/);
});

test("admin endpoint rate limits failed second-factor attempts", () => {
  assert.match(endpoint, /MAX_FAILURES = 5/);
  assert.match(endpoint, /LOCK_MS = 15 \* 60 \* 1000/);
  assert.match(endpoint, /recordFailure\(db, decoded\.uid, now\)/);
});

test("Firestore admin permissions require the short-lived custom claim", () => {
  assert.match(rules, /request\.auth\.token\.firebase\.sign_in_provider == "custom"/);
  assert.match(rules, /request\.auth\.token\.adminVerifiedUntil > request\.time\.seconds/);
  assert.doesNotMatch(rules, /request\.auth\.token\.firebase\.sign_in_provider == "google\.com"/);
});

test("client requests admin verification and uses a custom token", () => {
  assert.match(auth, /reauthenticateWithPopup/);
  assert.match(auth, /fetch\("\/api\/admin\/verify"/);
  assert.match(auth, /signInWithCustomToken/);
  assert.match(app, /adminVerifiedUntil/);
  assert.match(member, /adminVerifiedUntil/);
  assert.match(html, /Admin security is enforced server-side/);
});


test("admin overview uses Firestore aggregate counts for users and operations", () => {
  assert.match(member, /getCountFromServer/);
  assert.match(member, /admin-stat-users/);
  assert.match(member, /admin-stat-new-users/);
  assert.match(member, /admin-stat-memberships/);
  assert.match(member, /admin-stat-membership-pending/);
  assert.match(member, /admin-stat-withdrawals/);
  assert.match(member, /admin-stat-referrals/);
  assert.match(member, /expiresAt/);
});

test("member membership requests are connected to the owner review queue", () => {
  assert.match(html, /data-membership-request="starter"/);
  assert.match(html, /data-membership-request="pro"/);
  assert.match(member, /loadMembershipRequests/);
  assert.match(member, /loadMembershipRequestStatus/);
  assert.match(member, /resolveMembershipRequest/);
});
