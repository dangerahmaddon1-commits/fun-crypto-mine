const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../contract-engine.js');

const dayStart = (day) => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 0, 0, 0, 0).getTime();
};

test('a session lasts eight hours and awards ten points only after expiry', () => {
  const start = dayStart('2026-11-04') + 12 * 60 * 60 * 1000;
  const activated = Engine.startSession(Engine.freshState(), start);
  assert.equal(activated.ok, true);
  assert.equal(activated.state.session.endsAt - activated.state.session.startedAt, 8 * 60 * 60 * 1000);
  const early = Engine.completeDueSession(activated.state, start + Engine.SESSION_MS - 1);
  assert.equal(early.completed, false);
  assert.equal(early.state.points, 0);
  const completed = Engine.completeDueSession(early.state, start + Engine.SESSION_MS);
  assert.equal(completed.completed, true);
  assert.equal(completed.state.points, 10);
  assert.equal(completed.state.activeDays.length, 1);
});

test('an active session blocks a second activation', () => {
  const start = dayStart('2026-11-04');
  const first = Engine.startSession(Engine.freshState(), start);
  const second = Engine.startSession(first.state, start + 1000);
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'session_active');
});

test('three starts are allowed per local date and the fourth is rejected', () => {
  const start = dayStart('2026-11-04');
  let state = Engine.freshState();
  for (let index = 0; index < 3; index += 1) {
    const activation = Engine.startSession(state, start + index * 1000);
    assert.equal(activation.ok, true);
    state = activation.state;
    state.session = null; // Isolate the daily-start limit from the active-session guard.
  }
  const fourth = Engine.startSession(state, start + 4 * 1000);
  assert.equal(fourth.ok, false);
  assert.equal(fourth.reason, 'daily_limit');
});

test('multiple completed sessions on one date award points but count one active day', () => {
  const start = dayStart('2026-11-04');
  let state = Engine.freshState();
  for (let index = 0; index < 3; index += 1) {
    const activationTime = start + index * 8 * 60 * 60 * 1000;
    const activation = Engine.startSession(state, activationTime);
    assert.equal(activation.ok, true);
    state = Engine.completeDueSession(activation.state, activationTime + Engine.SESSION_MS).state;
  }
  assert.equal(state.points, 30);
  assert.deepEqual(state.activeDays, ['2026-11-04']);
});

test('a missed date does not erase completed active-day progress', () => {
  const firstStart = dayStart('2026-11-04');
  const first = Engine.startSession(Engine.freshState(), firstStart);
  let state = Engine.completeDueSession(first.state, firstStart + Engine.SESSION_MS).state;
  assert.deepEqual(state.activeDays, ['2026-11-04']);
  const nextStart = dayStart('2026-11-07');
  const next = Engine.startSession(state, nextStart);
  state = Engine.completeDueSession(next.state, nextStart + Engine.SESSION_MS).state;
  assert.deepEqual(state.activeDays, ['2026-11-04', '2026-11-07']);
  assert.equal(state.points, 20);
});

test('cycle completes after 30 distinct active dates, not consecutive dates', () => {
  const state = Engine.freshState();
  state.activeDays = Array.from({ length: 29 }, (_, index) => {
    const date = new Date(2026, 0, index + 1);
    return Engine.localDay(date.getTime());
  });
  const start = dayStart('2026-11-04');
  const activation = Engine.startSession(state, start);
  const completed = Engine.completeDueSession(activation.state, start + Engine.SESSION_MS);
  assert.equal(Engine.snapshot(completed.state, start + Engine.SESSION_MS).cycleCompleted, true);
  assert.equal(completed.state.activeDays.length, 30);
});

test('malformed browser state is sanitized before it reaches the UI', () => {
  const sanitized = Engine.sanitizeState({
    points: -500,
    activeDays: ['2026-11-04', '<img src=x onerror=alert(1)>'],
    sessionsByDay: { '2026-11-04': 999 },
    session: { day: '2026-11-04', startedAt: 10, endsAt: 11 },
    history: [{ type: '<script>', day: '2026-11-04', points: -1 }]
  });
  assert.equal(sanitized.points, 0);
  assert.deepEqual(sanitized.activeDays, ['2026-11-04']);
  assert.deepEqual(sanitized.sessionsByDay, {});
  assert.equal(sanitized.session, null);
  assert.equal(sanitized.history[0].type, 'Session activated');
  assert.equal(sanitized.history[0].points, 0);
});
