const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

test("signed-in users do not see public sign-in calls to action", () => {
  assert.match(html, /data-auth-cta/);
  assert.match(app, /querySelectorAll\('\[data-auth-cta\]'\)\.forEach\(el=>el\.hidden=!!currentUser\)/);
});

test("membership stays non-purchasable while signed-in members can request manual review", () => {
  const start = html.indexOf('<section class="view" id="plans">');
  const end = html.indexOf('<section class="view member-view" id="wallet"', start);
  assert.ok(start >= 0 && end > start);
  const membership = html.slice(start, end);
  assert.match(membership, /Membership is coming soon/);
  assert.match(membership, /Coming Soon/);
  assert.match(membership, /membership-request-card member-only/);
  assert.match(membership, /data-membership-request="starter"/);
  assert.match(membership, /data-membership-request="pro"/);
  assert.match(membership, /does not collect payment/);
});

test("Google branding metadata references the square site logo", () => {
  assert.match(html, /rel="icon"[^>]*href="\/logo\.svg"/);
  assert.match(html, /schema\.org/);
  assert.match(html, /#organization/);
  assert.match(html, /https:\/\/fun-crypto-mine\.vercel\.app\/logo\.svg/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "logo.svg"), "utf8"), /viewBox="0 0 512 512"/);
});

test("account settings update the Firebase display name and support password recovery", () => {
  assert.match(html, /id="profile-form"/);
  assert.match(html, /id="profile-display-name"/);
  assert.match(html, /id="profile-email" type="email" disabled/);
  assert.match(html, /id="profile-password-reset"/);
  const member = fs.readFileSync(path.join(__dirname, "..", "member-data.js"), "utf8");
  assert.match(member, /updateProfile\(activeUser,\{displayName\}\)/);
  assert.match(member, /updateDoc\(doc\(db,"users",activeUser\.uid\),\{displayName,updatedAt:serverTimestamp\(\)\}\)/);
  assert.match(member, /sendPasswordResetEmail\(auth,activeUser\.email\)/);
  assert.match(member, /providerId==="password"/);
  assert.match(app, /Update your display name below/);
});

test("membership copy does not claim review requests are unavailable", () => {
  assert.match(html, /Nothing is available to purchase/);
  assert.match(html, /Signed-in members may submit a no-payment review request/);
});

test("public rewards copy states the points conversion and manual payout model", () => {
  assert.match(html, /1,000 points = 1 USDT/);
  assert.match(html, /minimum withdrawal is 5 USDT/i);
  assert.match(html, /sends approved payments manually/i);
  assert.doesNotMatch(html, /Demo points have no cash or crypto value/);
  assert.doesNotMatch(html, /<div class="avatar">G<\/div>/);
});

test("referral page displays the active one-time reward split", () => {
  assert.match(html, /you receive 20 points and they receive 10 points/i);
  assert.match(html, /self-referrals are not eligible/i);
});
