const crypto = require("node:crypto");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const OWNER_EMAIL = "dangerahmaddon1@gmail.com";
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

function reply(res, status, payload) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.status(status).json(payload);
}

function getAdminServices() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("Missing Firebase service-account configuration.");
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const app = getApps().length ? getApps()[0] : initializeApp({
    credential: cert(serviceAccount),
    projectId: "fun-crypto"
  });
  return { auth: getAuth(app), db: getFirestore(app) };
}

function passwordMatches(candidate, expected) {
  const expectedBytes = Buffer.from(expected, "utf8");
  const candidateBytes = Buffer.from(candidate, "utf8");
  const padded = Buffer.alloc(expectedBytes.length);
  candidateBytes.copy(padded, 0, 0, expectedBytes.length);
  const same = crypto.timingSafeEqual(expectedBytes, padded);
  return same && candidateBytes.length === expectedBytes.length;
}

async function isLocked(db, uid, now) {
  const snap = await db.collection("adminSecondFactorAttempts").doc(uid).get();
  return Number(snap.data()?.lockedUntilMs || 0) > now;
}

async function recordFailure(db, uid, now) {
  const ref = db.collection("adminSecondFactorAttempts").doc(uid);
  return db.runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    const old = snap.exists ? snap.data() : {};
    if (Number(old.lockedUntilMs || 0) > now) return true;
    const inWindow = Number(old.windowStartedAtMs || 0) + WINDOW_MS > now;
    const failures = (inWindow ? Number(old.failures || 0) : 0) + 1;
    const lockedUntilMs = failures >= MAX_FAILURES ? now + LOCK_MS : 0;
    transaction.set(ref, {
      windowStartedAtMs: inWindow ? old.windowStartedAtMs : now,
      failures,
      lockedUntilMs,
      updatedAt: FieldValue.serverTimestamp()
    });
    return lockedUntilMs > now;
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") return reply(res, 405, { error: "Method not allowed." });
  const expectedPassword = process.env.ADMIN_SECOND_FACTOR_PASSWORD || "";
  if (expectedPassword.length < 16 || !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return reply(res, 503, { error: "Admin verification is not configured yet." });
  }
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return reply(res, 401, { error: "Sign in again with the owner Google account." });
  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body || {});
  const password = typeof body.password === "string" ? body.password : "";
  if (!password || password.length > 256) return reply(res, 400, { error: "Enter the admin second-factor password." });

  try {
    const { auth, db } = getAdminServices();
    const decoded = await auth.verifyIdToken(match[1], true);
    const provider = decoded.firebase?.sign_in_provider;
    if (String(decoded.email || "").toLowerCase() !== OWNER_EMAIL || decoded.email_verified !== true || provider !== "google.com") {
      return reply(res, 403, { error: "Only the verified owner Google account can request admin access." });
    }
    const now = Date.now();
    if (await isLocked(db, decoded.uid, now)) return reply(res, 429, { error: "Too many failed attempts. Try again in 15 minutes." });
    if (!passwordMatches(password, expectedPassword)) {
      const locked = await recordFailure(db, decoded.uid, now);
      return reply(res, locked ? 429 : 401, { error: locked ? "Too many failed attempts. Try again in 15 minutes." : "The admin second-factor password is incorrect." });
    }
    await db.collection("adminSecondFactorAttempts").doc(decoded.uid).delete();
    const adminVerifiedUntil = Math.floor(now / 1000) + 15 * 60;
    const customToken = await auth.createCustomToken(decoded.uid, { adminVerifiedUntil });
    return reply(res, 200, { customToken, expiresAt: adminVerifiedUntil });
  } catch (error) {
    console.error("Admin verification failed:", error.message);
    return reply(res, 401, { error: "Could not verify admin access. Sign in again and retry." });
  }
};
