"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkStaleCharacters = exports.onCharacterStatsChange = exports.notifyHelperTrophy = exports.notifyHelperOnImpact = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const webpush = __importStar(require("web-push"));
admin.initializeApp();
const db = admin.firestore();
const VAPID_SUBJECT = "mailto:marcportellg@gmail.com";
let webpushReady = false;
function initWebPush() {
    var _a, _b;
    if (webpushReady)
        return true;
    const pub = (_a = process.env.VAPID_PUBLIC_KEY) !== null && _a !== void 0 ? _a : "";
    const priv = (_b = process.env.VAPID_PRIVATE_KEY) !== null && _b !== void 0 ? _b : "";
    if (!pub || !priv)
        return false;
    webpush.setVapidDetails(VAPID_SUBJECT, pub, priv);
    webpushReady = true;
    return true;
}
// ── Helpers ───────────────────────────────────────────────────────────────────
async function getUserSubscription(uid) {
    var _a;
    const snap = await db.doc(`users/${uid}`).get();
    if (!snap.exists)
        return null;
    const sub = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.pushSubscription;
    if (!(sub === null || sub === void 0 ? void 0 : sub.endpoint))
        return null;
    return sub;
}
async function sendPush(uid, payload) {
    if (!initWebPush())
        return;
    const sub = await getUserSubscription(uid);
    if (!sub)
        return;
    try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
    }
    catch (err) {
        // 410 Gone = subscription expired; remove it
        if ((err === null || err === void 0 ? void 0 : err.statusCode) === 410) {
            await db.doc(`users/${uid}`).update({ pushSubscription: admin.firestore.FieldValue.delete() });
        }
    }
}
// ── PARTE B-1: Creator marks conversation significant → notify helper ─────────
exports.notifyHelperOnImpact = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    const { conversationId, trophyId } = request.data;
    const convSnap = await db.doc(`conversations/${conversationId}`).get();
    if (!convSnap.exists)
        throw new https_1.HttpsError("not-found", "Conversation not found");
    const conv = convSnap.data();
    const helperId = conv.helperId;
    const charSnap = await db.doc(`characters/${conv.characterId}`).get();
    const charName = (_b = (_a = charSnap.data()) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "alguien";
    const body = trophyId === "algo_cambio"
        ? `La persona detrás de ${charName} ha leído lo que dijiste. Algo cambió.`
        : `La persona detrás de ${charName} ha leído lo que dijiste. Fue un punto de giro.`;
    await sendPush(helperId, {
        title: "Tu conversación importó",
        body,
        url: "/profile",
        icon: "/icons/icon-192.png",
    });
});
// ── PARTE B-4: Trophy unlocked → notify helper ────────────────────────────────
exports.notifyHelperTrophy = (0, https_1.onCall)(async (request) => {
    const { helperId, trophyName } = request.data;
    if (!helperId || !trophyName)
        throw new https_1.HttpsError("invalid-argument", "Missing params");
    await sendPush(helperId, {
        title: `Logro desbloqueado: ${trophyName}`,
        body: "Has ganado un nuevo reconocimiento en People4People.",
        url: "/profile",
        icon: "/icons/icon-192.png",
    });
});
// ── PARTE B-2: Character emotional state changes → notify creator ─────────────
exports.onCharacterStatsChange = (0, firestore_1.onDocumentUpdated)("characterStats/{charId}", async (event) => {
    var _a, _b, _c, _d;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after)
        return;
    // Fire only when topEmotionTags actually changed
    const beforeTags = JSON.stringify((_c = before.topEmotionTags) !== null && _c !== void 0 ? _c : []);
    const afterTags = JSON.stringify((_d = after.topEmotionTags) !== null && _d !== void 0 ? _d : []);
    if (beforeTags === afterTags)
        return;
    const charId = event.params.charId;
    const charSnap = await db.doc(`characters/${charId}`).get();
    if (!charSnap.exists)
        return;
    const char = charSnap.data();
    const creatorId = char.creatorId;
    if (!creatorId)
        return;
    await sendPush(creatorId, {
        title: `Algo cambia en ${char.name}`,
        body: "Las conversaciones están llegando. Hay algo nuevo para ver.",
        url: `/profile`,
        icon: "/icons/icon-192.png",
    });
});
// ── PARTE B-3: Character inactive 7+ days → notify previous helpers ───────────
exports.checkStaleCharacters = (0, scheduler_1.onSchedule)("every 24 hours", async () => {
    var _a, _b, _c;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    // Get all conversations ended more than 7 days ago
    const convSnap = await db
        .collection("conversations")
        .where("endedAt", "!=", null)
        .get();
    // Group by characterId → find chars with NO recent conversation
    const lastConvByChar = {};
    const helpersByChar = {};
    convSnap.docs.forEach((d) => {
        var _a, _b, _c, _d;
        const c = d.data();
        const cid = c.characterId;
        const ts = (_c = (_b = (_a = c.endedAt) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : 0;
        if (ts > ((_d = lastConvByChar[cid]) !== null && _d !== void 0 ? _d : 0))
            lastConvByChar[cid] = ts;
        if (!helpersByChar[cid])
            helpersByChar[cid] = new Set();
        helpersByChar[cid].add(c.helperId);
    });
    const staleCharIds = Object.keys(lastConvByChar).filter((cid) => lastConvByChar[cid] < sevenDaysAgo);
    for (const charId of staleCharIds) {
        const charSnap = await db.doc(`characters/${charId}`).get();
        if (!charSnap.exists)
            continue;
        const charName = (_b = (_a = charSnap.data()) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "alguien";
        const helpers = Array.from((_c = helpersByChar[charId]) !== null && _c !== void 0 ? _c : []);
        await Promise.all(helpers.map((uid) => sendPush(uid, {
            title: `Han pasado 7 días`,
            body: `Han pasado 7 días desde que alguien habló con ${charName}.`,
            url: `/conversation/${charId}`,
            icon: "/icons/icon-192.png",
        })));
    }
});
//# sourceMappingURL=index.js.map