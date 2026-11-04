const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");

test("Firestore admin access requires the verified owner Google identity", () => {
  assert.match(rules, /request\.auth\.token\.email == "dangerahmaddon1@gmail\.com"/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /request\.auth\.token\.firebase\.sign_in_provider == "google\.com"/);
});

test("member profile and referral records cannot be deleted or rewritten by members", () => {
  assert.match(rules, /match \/users\/\{uid\}[\s\S]*?allow delete: if false;/);
  assert.match(rules, /match \/referralEvents\/\{referredUid\}[\s\S]*?allow update, delete: if false;/);
});

test("membership entitlement writes are owner-only", () => {
  assert.match(rules, /match \/memberships\/\{uid\}[\s\S]*?allow create, update: if ownerAdmin\(\)/);
});

test("rules do not grant public read or write access", () => {
  assert.doesNotMatch(rules, /allow\s+(?:read|write|read,\s*write)\s*:\s*if\s+true\s*;/);
});

test("withdrawal requests are private to the member and owner-controlled", () => {
  assert.match(rules, /match \/withdrawalRequests\/\{requestId\}/);
  assert.match(rules, /request\.resource\.data\.uid == request\.auth\.uid/);
  assert.match(rules, /request\.resource\.data\.amount >= 5/);
  assert.match(rules, /request\.resource\.data\.asset == "USDT"/);
  assert.match(rules, /resource\.data\.status == "approved"[\s\S]*?request\.resource\.data\.status == "paid"/);
  assert.match(rules, /allow delete: if false;/);
});
