const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");

test("Firestore admin access requires the verified owner and an unexpired second factor", () => {
  assert.ok(rules.includes('request.auth.token.email == "dangerahmaddon1@gmail.com"'));
  assert.ok(rules.includes("request.auth.token.email_verified == true"));
  assert.ok(rules.includes('request.auth.token.firebase.sign_in_provider == "custom"'));
  assert.ok(rules.includes("request.auth.token.adminVerifiedUntil > request.time.seconds"));
});

test("members cannot use owner privileges to alter another user's profile", () => {
  const userRules = rules.slice(rules.indexOf("match /users/{uid}"), rules.indexOf("match /referralCodes/{code}"));
  assert.doesNotMatch(userRules, /allow update: if ownerAdmin\(\)/);
  assert.match(userRules, /request.resource.data.diff\(resource.data\).affectedKeys\(\).hasOnly\(\["displayName","updatedAt"\]\)/);
});

test("second-factor attempt counters are inaccessible to browser clients", () => {
  assert.match(rules, /match \/adminSecondFactorAttempts\/{uid}/);
  assert.match(rules, /allow read, write: if false;/);
});

test("member profile and referral records cannot be deleted or rewritten by members", () => {
  assert.ok(rules.includes("match /users/{uid}"));
  assert.ok(rules.includes("match /referralEvents/{referredUid}"));
  assert.ok(rules.includes("allow update, delete: if false;"));
});

test("referral code lookup does not permit collection enumeration", () => {
  assert.ok(rules.includes("match /referralCodes/{code}"));
  assert.ok(rules.includes("allow get: if signedIn();"));
  assert.ok(rules.includes("allow list: if ownerAdmin();"));
});

test("membership entitlement writes are owner-only", () => {
  assert.ok(rules.includes("match /memberships/{uid}"));
  assert.ok(rules.includes("allow create, update: if ownerAdmin()"));
});

test("rules do not grant public read or write access", () => {
  assert.equal(/allow\s+(?:read|write|read,\s*write)\s*:\s*if\s+true\s*;/.test(rules), false);
});

test("withdrawal requests are private and all writes are restricted to the trusted wallet API", () => {
  assert.ok(rules.includes("match /withdrawalRequests/{requestId}"));
  assert.match(rules, /allow read: if ownerAdmin\(\) \|\| \(signedIn\(\) && resource\.data\.uid == request\.auth\.uid\);/);
  assert.match(rules, /allow create, update, delete: if false;/);
});
