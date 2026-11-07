const test = require("node:test");
const assert = require("node:assert/strict");
const Wallet = require("../api/wallet.js")._test;

test("USDT redemption uses 1,000 points per USDT and a five-USDT minimum", () => {
  assert.equal(Wallet.POINTS_PER_USDT, 1000);
  assert.equal(Wallet.MIN_WITHDRAWAL_USDT, 5);
  assert.equal(5000 / Wallet.POINTS_PER_USDT, 5);
});

test("one-time referral rewards use 20 points for the inviter and 10 for the new member", () => {
  assert.equal(Wallet.REFERRER_REWARD_POINTS, 20);
  assert.equal(Wallet.INVITEE_REWARD_POINTS, 10);
});

test("wallet point sanitization accepts only non-negative safe integers", () => {
  assert.equal(Wallet.safePoints(5000), 5000);
  assert.equal(Wallet.safePoints(-1), 0);
  assert.equal(Wallet.safePoints(1.5), 0);
  assert.equal(Wallet.safePoints(Number.MAX_SAFE_INTEGER + 1), 0);
});

test("manual admin actions require the verified owner and short-lived custom claim", () => {
  const valid = {
    email: "dangerahmaddon1@gmail.com",
    email_verified: true,
    firebase: { sign_in_provider: "custom" },
    adminVerifiedUntil: Math.floor(Date.now() / 1000) + 60
  };
  assert.equal(Wallet.isOwnerAdmin(valid), true);
  assert.equal(Wallet.isOwnerAdmin({ ...valid, email: "someone@example.com" }), false);
  assert.equal(Wallet.isOwnerAdmin({ ...valid, email_verified: false }), false);
  assert.equal(Wallet.isOwnerAdmin({ ...valid, firebase: { sign_in_provider: "google.com" } }), false);
  assert.equal(Wallet.isOwnerAdmin({ ...valid, adminVerifiedUntil: 1 }), false);
});
