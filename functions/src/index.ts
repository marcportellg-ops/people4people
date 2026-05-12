import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as webpush from "web-push";

admin.initializeApp();
const db = admin.firestore();

const VAPID_SUBJECT = "mailto:marcportellg@gmail.com";

let webpushReady = false;
function initWebPush(): boolean {
  if (webpushReady) return true;
  const pub = process.env.VAPID_PUBLIC_KEY ?? "";
  const priv = process.env.VAPID_PRIVATE_KEY ?? "";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, pub, priv);
  webpushReady = true;
  return true;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type PushPayload = {
  title: string;
  body: string;
  url: string;
  icon?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getUserSubscription(uid: string): Promise<webpush.PushSubscription | null> {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  const sub = snap.data()?.pushSubscription;
  if (!sub?.endpoint) return null;
  return sub as webpush.PushSubscription;
}

async function sendPush(uid: string, payload: PushPayload): Promise<void> {
  if (!initWebPush()) return;
  const sub = await getUserSubscription(uid);
  if (!sub) return;
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
  } catch (err: any) {
    // 410 Gone = subscription expired; remove it
    if (err?.statusCode === 410) {
      await db.doc(`users/${uid}`).update({ pushSubscription: admin.firestore.FieldValue.delete() });
    }
  }
}

// ── PARTE B-1: Creator marks conversation significant → notify helper ─────────
export const notifyHelperOnImpact = onCall(async (request) => {
  const { conversationId, trophyId } = request.data as {
    conversationId: string;
    trophyId: "algo_cambio" | "punto_de_giro";
  };

  const convSnap = await db.doc(`conversations/${conversationId}`).get();
  if (!convSnap.exists) throw new HttpsError("not-found", "Conversation not found");

  const conv = convSnap.data()!;
  const helperId: string = conv.helperId;
  const charSnap = await db.doc(`characters/${conv.characterId}`).get();
  const charName: string = charSnap.data()?.name ?? "alguien";

  const body =
    trophyId === "algo_cambio"
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
export const notifyHelperTrophy = onCall(async (request) => {
  const { helperId, trophyName } = request.data as {
    helperId: string;
    trophyName: string;
  };
  if (!helperId || !trophyName) throw new HttpsError("invalid-argument", "Missing params");

  await sendPush(helperId, {
    title: `Logro desbloqueado: ${trophyName}`,
    body: "Has ganado un nuevo reconocimiento en People4People.",
    url: "/profile",
    icon: "/icons/icon-192.png",
  });
});

// ── PARTE B-2: Character emotional state changes → notify creator ─────────────
export const onCharacterStatsChange = onDocumentUpdated("characterStats/{charId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  // Fire only when topEmotionTags actually changed
  const beforeTags = JSON.stringify(before.topEmotionTags ?? []);
  const afterTags = JSON.stringify(after.topEmotionTags ?? []);
  if (beforeTags === afterTags) return;

  const charId = event.params.charId;
  const charSnap = await db.doc(`characters/${charId}`).get();
  if (!charSnap.exists) return;

  const char = charSnap.data()!;
  const creatorId: string | undefined = char.creatorId;
  if (!creatorId) return;

  await sendPush(creatorId, {
    title: `Algo cambia en ${char.name}`,
    body: "Las conversaciones están llegando. Hay algo nuevo para ver.",
    url: `/profile`,
    icon: "/icons/icon-192.png",
  });
});

// ── PARTE B-3: Character inactive 7+ days → notify previous helpers ───────────
export const checkStaleCharacters = onSchedule("every 24 hours", async () => {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // Get all conversations ended more than 7 days ago
  const convSnap = await db
    .collection("conversations")
    .where("endedAt", "!=", null)
    .get();

  // Group by characterId → find chars with NO recent conversation
  const lastConvByChar: Record<string, number> = {};
  const helpersByChar: Record<string, Set<string>> = {};

  convSnap.docs.forEach((d) => {
    const c = d.data();
    const cid: string = c.characterId;
    const ts: number = c.endedAt?.toMillis?.() ?? 0;
    if (ts > (lastConvByChar[cid] ?? 0)) lastConvByChar[cid] = ts;
    if (!helpersByChar[cid]) helpersByChar[cid] = new Set();
    helpersByChar[cid].add(c.helperId);
  });

  const staleCharIds = Object.keys(lastConvByChar).filter(
    (cid) => lastConvByChar[cid] < sevenDaysAgo,
  );

  for (const charId of staleCharIds) {
    const charSnap = await db.doc(`characters/${charId}`).get();
    if (!charSnap.exists) continue;
    const charName: string = charSnap.data()?.name ?? "alguien";

    const helpers = Array.from(helpersByChar[charId] ?? []);
    await Promise.all(
      helpers.map((uid) =>
        sendPush(uid, {
          title: `Han pasado 7 días`,
          body: `Han pasado 7 días desde que alguien habló con ${charName}.`,
          url: `/conversation/${charId}`,
          icon: "/icons/icon-192.png",
        }),
      ),
    );
  }
});
