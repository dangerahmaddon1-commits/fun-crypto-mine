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
