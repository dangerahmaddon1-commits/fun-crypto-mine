const test = require("node:test");
const assert = require("node:assert/strict");
const Contract = require("../api/contracts/session.js")._test;

test("server contract uses a one-hour session and ten simulated points", () => {
  assert.equal(Contract.SESSION_MS, 60 * 60 * 1000);
  assert.equal(Contract.POINTS_PER_SESSION, 10);
  assert.equal(Contract.MAX_SESSIONS_PER_DAY, 3);
  assert.equal(Contract.REQUIRED_ACTIVE_DAYS, 30);
});

test("contract day boundaries are calculated in UTC", () => {
  assert.equal(Contract.utcDay(Date.UTC(2026, 10, 7, 23, 59)), "2026-11-07");
  assert.equal(Contract.utcDay(Date.UTC(2026, 10, 8, 0, 1)), "2026-11-08");
});

test("new server account starts with zero points and no active session", () => {
  assert.deepEqual(Contract.freshAccount(), {
    points: 0, activeDays: [], sessionsByDay: {}, session: null, history: []
  });
});

test("server sanitization rejects negative balances, invalid dates and malformed sessions", () => {
  const account = Contract.safeAccount({
    points: -500,
    activeDays: ["2026-11-07", "not-a-date", "2026-11-07"],
    sessionsByDay: { "2026-11-07": 2, "2026-11-08": 99 },
    session: { id: "bad", day: "2026-11-07", startedAt: 10, endsAt: 11 },
    history: [{ type: "unexpected", points: -1 }]
  });
  assert.equal(account.points, 0);
  assert.deepEqual(account.activeDays, ["2026-11-07"]);
  assert.deepEqual(account.sessionsByDay, { "2026-11-07": 2 });
  assert.equal(account.session, null);
});

test("snapshot calculates cycle progress and daily session count", () => {
  const account = Contract.freshAccount();
  account.points = 120;
  account.activeDays = Array.from({ length: 12 }, (_, index) => "2026-10-" + String(index + 1).padStart(2, "0"));
  account.sessionsByDay["2026-11-07"] = 2;
  const state = Contract.snapshot(account, Date.UTC(2026, 10, 7, 12));
  assert.equal(state.points, 120);
  assert.equal(state.activeDays, 12);
  assert.equal(state.progressPercent, 40);
  assert.equal(state.sessionsStartedToday, 2);
  assert.equal(state.cycleCompleted, false);
});
