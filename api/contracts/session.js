const crypto = require("node:crypto");

const SESSION_MS = 60 * 60 * 1000;
const POINTS_PER_SESSION = 10;
const MAX_SESSIONS_PER_DAY = 3;
const REQUIRED_ACTIVE_DAYS = 30;
const HISTORY_LIMIT = 50;

function reply(res, status, payload) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  return res.status(status).json(payload);
}

function services() {
  const { initializeApp, cert, getApps } = require("firebase-admin/app");
  const { getAuth } = require("firebase-admin/auth");
  const { getFirestore, FieldValue } = require("firebase-admin/firestore");
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error("Missing Firebase service-account configuration.");
  }
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const app = getApps().length ? getApps()[0] : initializeApp({
    credential: cert(serviceAccount),
    projectId: "fun-crypto"
  });
  return { auth: getAuth(app), db: getFirestore(app) };
}

function utcDay(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function freshAccount() {
  return { points: 0, activeDays: [], sessionsByDay: {}, session: null, history: [] };
}

function safeAccount(data) {
  if (!data || typeof data !== "object") return freshAccount();
  const points = Number.isSafeInteger(data.points) && data.points >= 0 ? data.points : 0;
  const activeDays = Array.isArray(data.activeDays)
    ? [...new Set(data.activeDays.filter(day => typeof day === "string" && /^\\d{4}-\\d{2}-\\d{2}$/.test(day)))].slice(0, REQUIRED_ACTIVE_DAYS)
    : [];
  const sessionsByDay = {};
  if (data.sessionsByDay && typeof data.sessionsByDay === "object") {
    for (const [day, count] of Object.entries(data.sessionsByDay)) {
      if (/^\\d{4}-\\d{2}-\\d{2}$/.test(day) && Number.isInteger(count) && count >= 0 && count <= MAX_SESSIONS_PER_DAY) {
        sessionsByDay[day] = count;
      }
    }
  }
  const raw = data.session;
  const session = raw && Number.isSafeInteger(raw.startedAt) && Number.isSafeInteger(raw.endsAt)
    && raw.endsAt - raw.startedAt === SESSION_MS && typeof raw.id === "string"
    ? { id: raw.id, day: raw.day, startedAt: raw.startedAt, endsAt: raw.endsAt }
    : null;
  const history = Array.isArray(data.history) ? data.history.slice(0, HISTORY_LIMIT) : [];
  return { points, activeDays, sessionsByDay, session, history };
}

function snapshot(account, now) {
  const day = utcDay(now);
  const activeDays = Math.min(REQUIRED_ACTIVE_DAYS, account.activeDays.length);
  return {
    points: account.points,
    activeDays,
    requiredActiveDays: REQUIRED_ACTIVE_DAYS,
    progressPercent: Math.round(activeDays / REQUIRED_ACTIVE_DAYS * 100),
    sessionsStartedToday: account.sessionsByDay[day] || 0,
    maxSessionsPerDay: MAX_SESSIONS_PER_DAY,
    pointsPerSession: POINTS_PER_SESSION,
    sessionDurationMs: SESSION_MS,
    session: account.session,
    cycleCompleted: activeDays >= REQUIRED_ACTIVE_DAYS,
    history: account.history
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return reply(res, 405, { error: "Method not allowed." });
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\\s+(.+)$/i);
  if (!match) return reply(res, 401, { error: "Sign in to access your contract." });

  try {
    const { auth, db } = services();
    const decoded = await auth.verifyIdToken(match[1], true);
    const uid = decoded.uid;
    const action = req.body && req.body.action;
    if (!["snapshot", "start"].includes(action)) {
      return reply(res, 400, { error: "Unsupported contract action." });
    }

    const now = Date.now();
    const accountRef = db.collection("contractAccounts").doc(uid);
    const ledgerRefFor = sessionId => db.collection("contractLedger").doc(uid + "_" + sessionId);
    const result = await db.runTransaction(async transaction => {
      const accountSnap = await transaction.get(accountRef);
      const account = safeAccount(accountSnap.exists ? accountSnap.data() : null);
      let completed = false;
      let completedSessionId = null;

      if (account.session && now >= account.session.endsAt) {
        const finished = account.session;
        const ledgerRef = ledgerRefFor(finished.id);
        const ledgerSnap = await transaction.get(ledgerRef);
        if (!ledgerSnap.exists) {
          account.points += POINTS_PER_SESSION;
          if (!account.activeDays.includes(finished.day)) account.activeDays.push(finished.day);
          account.activeDays = account.activeDays.slice(0, REQUIRED_ACTIVE_DAYS);
          account.history.unshift({
            type: "Session completed",
            day: finished.day,
            at: finished.endsAt,
            points: POINTS_PER_SESSION
          });
          transaction.create(ledgerRef, {
            uid, type: "contract_session_reward", points: POINTS_PER_SESSION,
            sessionId: finished.id, createdAt: FieldValue.serverTimestamp()
          });
        }
        account.session = null;
        completed = true;
        completedSessionId = finished.id;
      }

      let started = false;
      let reason = null;
      if (action === "start") {
        const day = utcDay(now);
        if (account.session) reason = "session_active";
        else if (account.activeDays.length >= REQUIRED_ACTIVE_DAYS) reason = "cycle_complete";
        else if ((account.sessionsByDay[day] || 0) >= MAX_SESSIONS_PER_DAY) reason = "daily_limit";
        else {
          const id = crypto.randomUUID();
          account.sessionsByDay[day] = (account.sessionsByDay[day] || 0) + 1;
          account.session = { id, day, startedAt: now, endsAt: now + SESSION_MS };
          account.history.unshift({ type: "Session activated", day, at: now, points: 0 });
          started = true;
        }
      }

      account.history = account.history.slice(0, HISTORY_LIMIT);
      transaction.set(accountRef, { ...account, uid, updatedAt: FieldValue.serverTimestamp() });
      return { state: snapshot(account, now), completed, completedSessionId, started, reason };
    });

    return reply(res, 200, result);
  } catch (error) {
    console.error("Contract request failed:", error.message);
    const status = error.code === "auth/id-token-expired" || error.code === "auth/argument-error" ? 401 : 500;
    return reply(res, status, {
      error: status === 401 ? "Your sign-in expired. Sign in again and retry." : "Contract service is temporarily unavailable."
    });
  }
};

module.exports._test = { utcDay, freshAccount, safeAccount, snapshot, SESSION_MS, POINTS_PER_SESSION, MAX_SESSIONS_PER_DAY, REQUIRED_ACTIVE_DAYS };
