const crypto = require("node:crypto");
const OWNER_EMAIL = "dangerahmaddon1@gmail.com";
const POINTS_PER_USDT = 1000;
const MIN_WITHDRAWAL_USDT = 5;
const REFERRER_REWARD_POINTS = 20;
const INVITEE_REWARD_POINTS = 10;
const NETWORKS = new Set(["TRC20", "BEP20", "ERC20"]);

function reply(res, status, payload) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  return res.status(status).json(payload);
}

function services() {
  const { initializeApp, cert, getApps } = require("firebase-admin/app");
  const { getAuth } = require("firebase-admin/auth");
  const { getFirestore, FieldValue } = require("firebase-admin/firestore");
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("Missing Firebase service-account configuration.");
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const app = getApps().length ? getApps()[0] : initializeApp({
    credential: cert(serviceAccount), projectId: "fun-crypto"
  });
  return { auth: getAuth(app), db: getFirestore(app), FieldValue };
}

function parseBody(body) {
  if (typeof body === "string") {
    try { return JSON.parse(body); } catch { return {}; }
  }
  return body && typeof body === "object" ? body : {};
}

function safePoints(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function isOwnerAdmin(decoded) {
  return String(decoded.email || "").toLowerCase() === OWNER_EMAIL
    && decoded.email_verified === true
    && decoded.firebase?.sign_in_provider === "custom"
    && Number(decoded.adminVerifiedUntil || 0) > Math.floor(Date.now() / 1000);
}

async function reservedPoints(db, uid) {
  const snap = await db.collection("withdrawalRequests").where("uid", "==", uid).get();
  return snap.docs.reduce((sum, item) => {
    const data = item.data();
    return sum + (["pending", "approved"].includes(data.status) ? safePoints(data.pointsRequested || Math.round(Number(data.amount) * POINTS_PER_USDT)) : 0);
  }, 0);
}

async function getBalance(db, uid) {
  const account = await db.collection("contractAccounts").doc(uid).get();
  const points = safePoints(account.data()?.points);
  const reserved = await reservedPoints(db, uid);
  const available = Math.max(0, points - reserved);
  return {
    points, reservedPoints: reserved, availablePoints: available,
    availableUsdt: Math.floor(available / POINTS_PER_USDT * 100) / 100,
    pointsPerUsdt: POINTS_PER_USDT,
    minimumWithdrawalUsdt: MIN_WITHDRAWAL_USDT
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return reply(res, 405, { error: "Method not allowed." });
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\\s+(.+)$/i);
  if (!match) return reply(res, 401, { error: "Sign in to access your wallet." });

  try {
    const { auth, db, FieldValue } = services();
    const decoded = await auth.verifyIdToken(match[1], true);
    const uid = decoded.uid;
    const body = parseBody(req.body);
    const action = body.action;

    if (action === "balance") {
      return reply(res, 200, { balance: await getBalance(db, uid) });
    }

    if (action === "request") {
      const amount = Number(body.amount);
      const network = String(body.network || "");
      const walletAddress = String(body.walletAddress || "").trim();
      if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_USDT || amount > 100000
        || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8 || !NETWORKS.has(network)
        || walletAddress.length < 12 || walletAddress.length > 180) {
        return reply(res, 400, { error: "Check the withdrawal amount, network and receiving address. Minimum withdrawal is 5 USDT." });
      }
      const pointsRequested = Math.round(amount * POINTS_PER_USDT);
      const requestRef = db.collection("withdrawalRequests").doc(crypto.randomUUID());
      const accountRef = db.collection("contractAccounts").doc(uid);
      const result = await db.runTransaction(async transaction => {
        const accountSnap = await transaction.get(accountRef);
        const existingQuery = db.collection("withdrawalRequests").where("uid", "==", uid);
        const existing = await transaction.get(existingQuery);
        if (existing.docs.some(item => ["pending", "approved"].includes(item.data().status))) {
          throw new Error("OPEN_WITHDRAWAL_EXISTS");
        }
        const points = safePoints(accountSnap.data()?.points);
        if (points < pointsRequested) throw new Error("INSUFFICIENT_POINTS");
        transaction.create(requestRef, {
          uid, email: decoded.email || "", amount, pointsRequested,
          asset: "USDT", network, walletAddress,
          status: "pending", createdAt: FieldValue.serverTimestamp()
        });
        return { id: requestRef.id, amount, pointsRequested };
      });
      return reply(res, 201, { request: result, balance: await getBalance(db, uid) });
    }

    if (action === "claimReferral") {
      const profileRef = db.collection("users").doc(uid);
      const eventRef = db.collection("referralEvents").doc(uid);
      const claimRef = db.collection("referralRewardClaims").doc(uid);
      const result = await db.runTransaction(async transaction => {
        const profileSnap = await transaction.get(profileRef);
        const eventSnap = await transaction.get(eventRef);
        const claimSnap = await transaction.get(claimRef);
        if (claimSnap.exists) return { credited: false, reason: "already_credited" };
        if (!profileSnap.exists || !eventSnap.exists) return { credited: false, reason: "no_referral" };
        const profile = profileSnap.data();
        const event = eventSnap.data();
        const referrerUid = String(event.referrerUid || "");
        if (!referrerUid || referrerUid === uid || profile.referredBy !== referrerUid
          || event.referredUid !== uid) return { credited: false, reason: "invalid_referral" };

        const referrerProfileRef = db.collection("users").doc(referrerUid);
        const referrerProfileSnap = await transaction.get(referrerProfileRef);
        if (!referrerProfileSnap.exists) return { credited: false, reason: "referrer_missing" };

        const inviteeAccountRef = db.collection("contractAccounts").doc(uid);
        const referrerAccountRef = db.collection("contractAccounts").doc(referrerUid);
        const inviteeLedgerRef = db.collection("contractLedger").doc("referral_invitee_" + uid);
        const referrerLedgerRef = db.collection("contractLedger").doc("referral_inviter_" + uid);
        const [inviteeAccountSnap, referrerAccountSnap, inviteeLedgerSnap, referrerLedgerSnap] = await Promise.all([
          transaction.get(inviteeAccountRef), transaction.get(referrerAccountRef),
          transaction.get(inviteeLedgerRef), transaction.get(referrerLedgerRef)
        ]);
        if (inviteeLedgerSnap.exists || referrerLedgerSnap.exists) throw new Error("REFERRAL_LEDGER_CONFLICT");

        const nowDay = new Date().toISOString().slice(0, 10);
        const updateAccount = (snapshot, targetUid, reward, rewardType) => {
          const account = snapshot.exists ? snapshot.data() : {};
          const points = safePoints(account.points);
          const history = Array.isArray(account.history) ? account.history.slice(0, 49) : [];
          history.unshift({ type: rewardType, day: nowDay, at: Date.now(), points: reward });
          transaction.set(snapshot.ref, {
            ...account, uid: targetUid, points: points + reward, history,
            activeDays: Array.isArray(account.activeDays) ? account.activeDays : [],
            sessionsByDay: account.sessionsByDay && typeof account.sessionsByDay === "object" ? account.sessionsByDay : {},
            session: account.session || null,
            updatedAt: FieldValue.serverTimestamp()
          });
        };
        updateAccount(inviteeAccountSnap, uid, INVITEE_REWARD_POINTS, "Referral welcome reward");
        updateAccount(referrerAccountSnap, referrerUid, REFERRER_REWARD_POINTS, "Referral invite reward");

        transaction.create(inviteeLedgerRef, {
          uid, type: "referral_invitee_reward", points: INVITEE_REWARD_POINTS,
          referredUid: uid, referrerUid, createdAt: FieldValue.serverTimestamp()
        });
        transaction.create(referrerLedgerRef, {
          uid: referrerUid, type: "referral_inviter_reward", points: REFERRER_REWARD_POINTS,
          referredUid: uid, referrerUid, createdAt: FieldValue.serverTimestamp()
        });
        transaction.create(claimRef, {
          referredUid: uid, referrerUid,
          inviteePoints: INVITEE_REWARD_POINTS, referrerPoints: REFERRER_REWARD_POINTS,
          createdAt: FieldValue.serverTimestamp()
        });
        transaction.update(eventRef, {
          rewardStatus: "credited", rewardCreditedAt: FieldValue.serverTimestamp()
        });
        return { credited: true, inviteePoints: INVITEE_REWARD_POINTS, referrerPoints: REFERRER_REWARD_POINTS };
      });
      return reply(res, 200, { referral: result });
    }

    if (action === "resolve") {
      if (!isOwnerAdmin(decoded)) return reply(res, 403, { error: "Admin verification is required." });
      const requestId = String(body.requestId || "");
      const nextStatus = String(body.status || "");
      const paymentReference = String(body.paymentReference || "").trim();
      if (!/^[A-Za-z0-9_-]{20,80}$/.test(requestId)
        || !["approved", "rejected", "paid"].includes(nextStatus)) {
        return reply(res, 400, { error: "Invalid withdrawal action." });
      }
      if (nextStatus === "paid" && (paymentReference.length < 6 || paymentReference.length > 200)) {
        return reply(res, 400, { error: "Enter the transaction reference after sending the USDT." });
      }
      const requestRef = db.collection("withdrawalRequests").doc(requestId);
      const auditRef = db.collection("adminAuditLogs").doc();
      const result = await db.runTransaction(async transaction => {
        const requestSnap = await transaction.get(requestRef);
        if (!requestSnap.exists) throw new Error("REQUEST_NOT_FOUND");
        const request = requestSnap.data();
        const valid = (request.status === "pending" && ["approved", "rejected"].includes(nextStatus))
          || (request.status === "approved" && nextStatus === "paid");
        if (!valid) throw new Error("INVALID_STATUS_TRANSITION");

        const update = {
          status: nextStatus, reviewedAt: FieldValue.serverTimestamp(),
          reviewedBy: uid
        };
        if (nextStatus === "paid") {
          const accountRef = db.collection("contractAccounts").doc(request.uid);
          const accountSnap = await transaction.get(accountRef);
          const account = accountSnap.exists ? accountSnap.data() : {};
          const points = safePoints(account.points);
          const debit = safePoints(request.pointsRequested || Math.round(Number(request.amount) * POINTS_PER_USDT));
          if (!debit || points < debit) throw new Error("BALANCE_CHANGED");
          const ledgerRef = db.collection("contractLedger").doc("withdrawal_" + requestId);
          const ledgerSnap = await transaction.get(ledgerRef);
          if (ledgerSnap.exists) throw new Error("ALREADY_LEDGERED");
          const history = Array.isArray(account.history) ? account.history.slice(0, 49) : [];
          history.unshift({
            type: "USDT withdrawal paid", day: new Date().toISOString().slice(0, 10),
            at: Date.now(), points: -debit
          });
          transaction.update(accountRef, {
            points: points - debit, history,
            updatedAt: FieldValue.serverTimestamp()
          });
          transaction.create(ledgerRef, {
            uid: request.uid, type: "usdt_withdrawal",
            points: -debit, amountUsdt: Number(request.amount),
            requestId, paymentReference, createdAt: FieldValue.serverTimestamp()
          });
          update.paymentReference = paymentReference;
          update.paidAt = FieldValue.serverTimestamp();
        }
        transaction.update(requestRef, update);
        transaction.create(auditRef, {
          actorUid: uid, action: "withdrawal_" + nextStatus,
          targetId: requestId, targetUid: request.uid,
          createdAt: FieldValue.serverTimestamp()
        });
        return { id: requestId, status: nextStatus };
      });
      return reply(res, 200, { request: result });
    }

    return reply(res, 400, { error: "Unsupported wallet action." });
  } catch (error) {
    const messages = {
      OPEN_WITHDRAWAL_EXISTS: [409, "You already have an open withdrawal request."],
      INSUFFICIENT_POINTS: [400, "Your available points are not enough for this withdrawal."],
      REQUEST_NOT_FOUND: [404, "Withdrawal request not found."],
      INVALID_STATUS_TRANSITION: [409, "This request has already been processed or cannot move to that status."],
      BALANCE_CHANGED: [409, "The points balance changed. Refresh the wallet and review the request."],
      ALREADY_LEDGERED: [409, "This withdrawal already has a ledger entry."]
    };
    const known = messages[error.message];
    if (known) return reply(res, known[0], { error: known[1] });
    const authErrors = ["auth/id-token-expired", "auth/id-token-revoked", "auth/invalid-id-token", "auth/argument-error", "auth/user-disabled"];
    const status = authErrors.includes(error.code) ? 401 : 500;
    console.error("Wallet request failed:", error.message);
    return reply(res, status, { error: status === 401 ? "Your sign-in expired. Sign in again and retry." : "Wallet service is temporarily unavailable." });
  }
};

module.exports._test = { POINTS_PER_USDT, MIN_WITHDRAWAL_USDT, REFERRER_REWARD_POINTS, INVITEE_REWARD_POINTS, safePoints, isOwnerAdmin };
