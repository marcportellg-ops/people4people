import {
  collection, addDoc, getDocs, getDoc, doc, setDoc,
  updateDoc, arrayUnion, serverTimestamp,
  query, where, type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Character } from "@/data/characters";
import type { Plan } from "@/lib/plans";
import type { Level } from "@/lib/levels";
import type { Trophy } from "@/lib/trophies";

// ── Types ────────────────────────────────────────────────────────────────────

export type Message = { role: "user" | "char"; text: string; t: string };

export type ConversationSummary = {
  summary: string;
  recommendations: string[];
  highlight: string;
};

export type ModerationResult = {
  score: number;
  decision: "rejected" | "review" | "deliver";
  reason: string;
};

export type CharacterInsights = {
  overview: string;
  themes: { label: string; count: number }[];
  topMoments: string[];
  conversationCount: number;
  generatedAt: Timestamp;
};

export type ConversationDoc = {
  id: string;
  characterId: string;
  helperId: string;
  messages: Message[];
  startedAt: Timestamp | null;
  endedAt: Timestamp | null;
  summary?: ConversationSummary;
  moderation?: ModerationResult;
  seenByCreator?: boolean;
  paused?: boolean;
  timeLeft?: number;
  emotionTags?: string[];
};

// ── Characters ───────────────────────────────────────────────────────────────

export async function saveCharacter(
  character: Omit<Character, "id">,
  creatorId: string,
  creatorEmail?: string,
): Promise<string> {
  const ref = await addDoc(collection(db, "characters"), {
    ...character,
    creatorId,
    creatorEmail: creatorEmail ?? null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function saveNarratorStory(id: string, narratorStory: string): Promise<void> {
  await updateDoc(doc(db, "characters", id), { narratorStory });
}

export async function saveCharacterTranslations(
  id: string,
  translations: Character["translations"],
): Promise<void> {
  await updateDoc(doc(db, "characters", id), { translations });
}

export async function updateCharacter(
  id: string,
  updates: Pick<Character, "summary" | "longStory" | "intro"> & { refinements?: Character["refinements"]; narratorStory?: string },
): Promise<void> {
  const data: Record<string, unknown> = {
    summary: updates.summary,
    longStory: updates.longStory,
    intro: updates.intro,
  };
  if (updates.refinements !== undefined) data.refinements = updates.refinements;
  if (updates.narratorStory !== undefined) data.narratorStory = updates.narratorStory;
  await updateDoc(doc(db, "characters", id), data);
}

export async function getAllUserCharacters(): Promise<Character[]> {
  const snap = await getDocs(collection(db, "characters"));
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Character, "id">), id: d.id }));
}

export async function getMyCharacters(creatorId: string): Promise<Character[]> {
  const q = query(collection(db, "characters"), where("creatorId", "==", creatorId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Character, "id">), id: d.id }));
}

export async function getCharacterById(id: string): Promise<Character | null> {
  const snap = await getDoc(doc(db, "characters", id));
  if (!snap.exists()) return null;
  return { ...(snap.data() as Omit<Character, "id">), id: snap.id };
}

// ── Conversations ─────────────────────────────────────────────────────────────

export async function createConversation(
  characterId: string,
  helperId: string,
): Promise<string> {
  const ref = await addDoc(collection(db, "conversations"), {
    characterId,
    helperId,
    messages: [],
    startedAt: serverTimestamp(),
    endedAt: null,
    seenByCreator: false,
  });
  return ref.id;
}

export async function saveMessages(
  conversationId: string,
  messages: Message[],
): Promise<void> {
  if (messages.length === 0) return;
  await updateDoc(doc(db, "conversations", conversationId), {
    messages: arrayUnion(...messages),
  });
}

export async function endConversation(conversationId: string): Promise<void> {
  await updateDoc(doc(db, "conversations", conversationId), {
    endedAt: serverTimestamp(),
    paused: false,
    timeLeft: null,
  });
}

export async function pauseConversation(conversationId: string, timeLeft: number): Promise<void> {
  await updateDoc(doc(db, "conversations", conversationId), { paused: true, timeLeft });
}

export async function discardPausedConversation(conversationId: string): Promise<void> {
  await updateDoc(doc(db, "conversations", conversationId), { paused: false });
}

export async function getPausedConversation(
  helperId: string,
  characterId: string,
): Promise<ConversationDoc | null> {
  const q = query(
    collection(db, "conversations"),
    where("helperId", "==", helperId),
    where("characterId", "==", characterId),
  );
  const snap = await getDocs(q);
  const paused = snap.docs
    .map((d) => ({ ...(d.data() as Omit<ConversationDoc, "id">), id: d.id }))
    .find((c) => c.paused === true && c.endedAt === null);
  return paused ?? null;
}

export async function saveConversationSummary(
  conversationId: string,
  summary: ConversationSummary,
): Promise<void> {
  await updateDoc(doc(db, "conversations", conversationId), { summary });
}

export async function saveConversationModeration(
  conversationId: string,
  moderation: ModerationResult,
): Promise<void> {
  await updateDoc(doc(db, "conversations", conversationId), { moderation });
}

// ── Character insights (cross-conversation digest) ────────────────────────────

export async function saveCharacterInsights(
  characterId: string,
  insights: Omit<CharacterInsights, "generatedAt">,
): Promise<void> {
  await setDoc(doc(db, "characterInsights", characterId), {
    ...insights,
    generatedAt: serverTimestamp(),
  });
}

export async function getCharacterInsights(
  characterId: string,
): Promise<CharacterInsights | null> {
  const snap = await getDoc(doc(db, "characterInsights", characterId));
  if (!snap.exists()) return null;
  return snap.data() as CharacterInsights;
}

export async function getAllConversations(): Promise<ConversationDoc[]> {
  const snap = await getDocs(collection(db, "conversations"));
  return snap.docs.map((d) => ({
    ...(d.data() as Omit<ConversationDoc, "id">),
    id: d.id,
  }));
}

export async function getConversationsForCharacters(
  characterIds: string[],
): Promise<ConversationDoc[]> {
  if (characterIds.length === 0) return [];
  const q = query(
    collection(db, "conversations"),
    where("characterId", "in", characterIds.slice(0, 30)),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    ...(d.data() as Omit<ConversationDoc, "id">),
    id: d.id,
  }));
}

export async function getUnseenDeliveryCount(characterIds: string[]): Promise<number> {
  if (characterIds.length === 0) return 0;
  const q = query(
    collection(db, "conversations"),
    where("characterId", "in", characterIds.slice(0, 30)),
    where("moderation.decision", "==", "deliver"),
    where("seenByCreator", "==", false),
  );
  const snap = await getDocs(q);
  return snap.size;
}

export async function getDeliveredConversations(characterIds: string[]): Promise<ConversationDoc[]> {
  if (characterIds.length === 0) return [];
  const q = query(
    collection(db, "conversations"),
    where("characterId", "in", characterIds.slice(0, 30)),
    where("moderation.decision", "==", "deliver"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    ...(d.data() as Omit<ConversationDoc, "id">),
    id: d.id,
  }));
}

// ── User plans ───────────────────────────────────────────────────────────────

export type UserDoc = {
  plan: Plan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  alias?: string;
  aliasSetAt?: Timestamp;
  level?: Level;
  isStar?: boolean;
  lastConversationDate?: string;
  currentStreak?: number;
  onboarded?: boolean;
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: Timestamp;
  language?: string;
};

export async function ensureUserDoc(uid: string): Promise<void> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { plan: "free", onboarded: false });
  }
}

export async function checkIsOnboarded(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return false;
  const d = snap.data() as UserDoc;
  return (d.onboardingCompleted === true) || (d.onboarded === true);
}

export async function markOnboarded(uid: string): Promise<void> {
  await setDoc(doc(db, "users", uid), {
    onboarded: true,
    onboardingCompleted: true,
    onboardingCompletedAt: serverTimestamp(),
  }, { merge: true });
}

export async function setUserLanguage(uid: string, language: string): Promise<void> {
  await setDoc(doc(db, "users", uid), { language }, { merge: true });
}

export async function getUserPlan(uid: string): Promise<Plan> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return "free";
  return (snap.data() as UserDoc).plan ?? "free";
}

export async function setUserPlan(uid: string, plan: Plan, stripeData?: { customerId?: string; subscriptionId?: string }): Promise<void> {
  await setDoc(doc(db, "users", uid), {
    plan,
    ...(stripeData?.customerId ? { stripeCustomerId: stripeData.customerId } : {}),
    ...(stripeData?.subscriptionId ? { stripeSubscriptionId: stripeData.subscriptionId } : {}),
    planUpdatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getConversationCountByHelper(helperId: string): Promise<number> {
  const q = query(collection(db, "conversations"), where("helperId", "==", helperId));
  const snap = await getDocs(q);
  return snap.size;
}

// ── Alias ────────────────────────────────────────────────────────────────────

export async function getUserAlias(uid: string): Promise<string | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return (snap.data() as UserDoc).alias ?? null;
}

export async function setUserAlias(uid: string, alias: string): Promise<void> {
  await setDoc(doc(db, "users", uid), { alias, aliasSetAt: serverTimestamp() }, { merge: true });
}

// ── Level ────────────────────────────────────────────────────────────────────

export async function getUserLevel(uid: string): Promise<{ level: Level; isStar: boolean }> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return { level: "Semilla", isStar: false };
  const d = snap.data() as UserDoc;
  return { level: d.level ?? "Semilla", isStar: d.isStar ?? false };
}

export async function setUserLevel(uid: string, level: Level, isStar?: boolean): Promise<void> {
  const data: Record<string, unknown> = { level, levelUpdatedAt: serverTimestamp() };
  if (isStar !== undefined) data.isStar = isStar;
  await setDoc(doc(db, "users", uid), data, { merge: true });
}

export async function updateStreak(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, "users", uid));
  const d = snap.exists() ? (snap.data() as UserDoc) : {};
  const today = new Date().toISOString().slice(0, 10);
  const last = d.lastConversationDate ?? "";
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = last === yesterday ? (d.currentStreak ?? 0) + 1 : last === today ? (d.currentStreak ?? 1) : 1;
  await setDoc(doc(db, "users", uid), { lastConversationDate: today, currentStreak: streak }, { merge: true });
  return streak;
}

export async function getAllHelpers(): Promise<(UserDoc & { uid: string })[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ ...(d.data() as UserDoc), uid: d.id }));
}

// ── Trophies ─────────────────────────────────────────────────────────────────

export async function getUserTrophies(uid: string): Promise<Trophy[]> {
  const snap = await getDoc(doc(db, "trophies", uid));
  if (!snap.exists()) return [];
  return (snap.data() as { trophies: Trophy[] }).trophies ?? [];
}

export async function awardTrophies(uid: string, newIds: string[]): Promise<void> {
  if (newIds.length === 0) return;
  const existing = await getUserTrophies(uid);
  const existingIds = new Set(existing.map((t) => t.id));
  const toAdd = newIds.filter((id) => !existingIds.has(id));
  if (toAdd.length === 0) return;

  // Lazy import to avoid circular at module level
  const { TROPHY_DEFS } = await import("@/lib/trophies");
  const now = serverTimestamp();
  const newTrophies = toAdd.map((id) => ({ ...TROPHY_DEFS[id], unlockedAt: now }));
  await setDoc(doc(db, "trophies", uid), { trophies: arrayUnion(...newTrophies) }, { merge: true });
}

export async function awardImpactTrophy(conversationId: string, trophyId: "algo_cambio" | "punto_de_giro"): Promise<void> {
  const snap = await getDoc(doc(db, "conversations", conversationId));
  if (!snap.exists()) return;
  const helperId = (snap.data() as ConversationDoc).helperId;
  await awardTrophies(helperId, [trophyId]);
}

export async function incrementConversationViewCount(conversationId: string): Promise<number> {
  const ref = doc(db, "conversations", conversationId);
  const snap = await getDoc(ref);
  const current = ((snap.data() as any)?.viewCount ?? 0) + 1;
  await updateDoc(ref, { viewCount: current });
  if (current >= 3) {
    const helperId = (snap.data() as ConversationDoc).helperId;
    await awardTrophies(helperId, ["guardado"]);
  }
  return current;
}

// ── Weekly Ranking ────────────────────────────────────────────────────────────

export type RankingEntry = { userId: string; alias: string; count: number };

export async function getWeeklyRanking(): Promise<RankingEntry[]> {
  const snap = await getDoc(doc(db, "weeklyRanking", "current"));
  if (!snap.exists()) return [];
  return (snap.data() as { entries: RankingEntry[] }).entries ?? [];
}

export async function rebuildWeeklyRanking(): Promise<void> {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const q = query(collection(db, "conversations"), where("endedAt", "!=", null));
  const snap = await getDocs(q);
  const counts: Record<string, number> = {};
  snap.docs.forEach((d) => {
    const c = d.data() as ConversationDoc;
    if (!c.startedAt) return;
    const ts = (c.startedAt as any).toMillis?.() ?? 0;
    if (ts < weekAgo) return;
    if ((c.moderation?.score ?? 0) < 7) return;
    counts[c.helperId] = (counts[c.helperId] ?? 0) + 1;
  });
  const topIds = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([uid, count]) => ({ uid, count }));

  const entries: RankingEntry[] = [];
  for (const { uid, count } of topIds) {
    const alias = await getUserAlias(uid);
    entries.push({ userId: uid, alias: alias ?? "Voz Anónima", count });
  }
  await setDoc(doc(db, "weeklyRanking", "current"), { entries, updatedAt: serverTimestamp() });
}

export async function getHelperConversations(helperId: string): Promise<ConversationDoc[]> {
  const q = query(collection(db, "conversations"), where("helperId", "==", helperId), where("endedAt", "!=", null));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<ConversationDoc, "id">), id: d.id }));
}

// ── User-personalized openings ────────────────────────────────────────────────

export async function getUserOpening(userId: string, characterId: string, lang: string): Promise<string | null> {
  const snap = await getDoc(doc(db, "userOpenings", `${userId}_${characterId}_${lang}`));
  if (!snap.exists()) return null;
  return (snap.data() as { opening: string }).opening;
}

export async function saveUserOpening(userId: string, characterId: string, lang: string, opening: string): Promise<void> {
  await setDoc(doc(db, "userOpenings", `${userId}_${characterId}_${lang}`), { opening });
}

export async function markDeliveriesSeen(conversationIds: string[]): Promise<void> {
  await Promise.all(
    conversationIds.map((id) =>
      updateDoc(doc(db, "conversations", id), { seenByCreator: true }),
    ),
  );
}

// ── Helper Messages ───────────────────────────────────────────────────────────

export type HelperMessage = {
  conversationId: string;
  helperId: string;
  characterName: string;
  message: string;
  read: boolean;
  createdAt: Timestamp;
};

export async function sendHelperMessage(
  conversationId: string,
  helperId: string,
  characterName: string,
  message: string,
): Promise<void> {
  await setDoc(doc(db, "helperMessages", conversationId), {
    conversationId,
    helperId,
    characterName,
    message,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function getHelperMessages(helperId: string): Promise<HelperMessage[]> {
  const q = query(collection(db, "helperMessages"), where("helperId", "==", helperId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as HelperMessage);
}

export async function markHelperMessageRead(conversationId: string): Promise<void> {
  await updateDoc(doc(db, "helperMessages", conversationId), { read: true });
}

// ── Push subscriptions ────────────────────────────────────────────────────────

export type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function savePushSubscription(
  uid: string,
  subscription: PushSubscriptionJSON,
): Promise<void> {
  await setDoc(doc(db, "users", uid), { pushSubscription: subscription }, { merge: true });
}

export async function getPushSubscription(uid: string): Promise<PushSubscriptionJSON | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return (snap.data() as any).pushSubscription ?? null;
}

// ── Emotion tags ──────────────────────────────────────────────────────────────

export async function recomputeCharacterTopTags(characterId: string): Promise<void> {
  const q = query(collection(db, "conversations"), where("characterId", "==", characterId));
  const snap = await getDocs(q);
  const counts: Record<string, number> = {};
  snap.docs.forEach((d) => {
    const tags = (d.data() as ConversationDoc).emotionTags;
    tags?.forEach((t) => { counts[t] = (counts[t] ?? 0) + 1; });
  });
  const top3 = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  // Write to characterStats (works for both Firestore and hardcoded chars)
  await setDoc(doc(db, "characterStats", characterId), { topEmotionTags: top3 }, { merge: true });

  // Also update the character doc if it exists (real Firestore characters)
  const charSnap = await getDoc(doc(db, "characters", characterId));
  if (charSnap.exists()) {
    await updateDoc(doc(db, "characters", characterId), { topEmotionTags: top3 });
  }
}

export async function saveEmotionTags(
  conversationId: string,
  tags: string[],
  characterId: string,
): Promise<void> {
  await updateDoc(doc(db, "conversations", conversationId), { emotionTags: tags });
  await recomputeCharacterTopTags(characterId);
}

export async function getCharacterTagStats(
  characterIds: string[],
): Promise<Record<string, string[]>> {
  if (characterIds.length === 0) return {};
  const snaps = await Promise.all(characterIds.map((id) => getDoc(doc(db, "characterStats", id))));
  const result: Record<string, string[]> = {};
  snaps.forEach((snap, i) => {
    if (snap.exists()) {
      result[characterIds[i]] = (snap.data() as { topEmotionTags?: string[] }).topEmotionTags ?? [];
    }
  });
  return result;
}

// ── Discovery data ────────────────────────────────────────────────────────────

export type DiscoveryData = {
  recentConvCount: Record<string, number>;
  lastConvDate: Record<string, number>;
};

export async function getDiscoveryData(): Promise<DiscoveryData> {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const snap = await getDocs(collection(db, "conversations"));
  const recentConvCount: Record<string, number> = {};
  const lastConvDate: Record<string, number> = {};
  snap.docs.forEach((d) => {
    const c = d.data() as ConversationDoc;
    if (!c.characterId) return;
    const ts = (c.startedAt as any)?.toMillis?.() ?? 0;
    if (ts > (lastConvDate[c.characterId] ?? 0)) lastConvDate[c.characterId] = ts;
    if (ts >= weekAgo) recentConvCount[c.characterId] = (recentConvCount[c.characterId] ?? 0) + 1;
  });
  return { recentConvCount, lastConvDate };
}

export async function getHelperRecentEmotionTags(helperId: string): Promise<string[]> {
  const q = query(collection(db, "conversations"), where("helperId", "==", helperId));
  const snap = await getDocs(q);
  const convs = snap.docs
    .map((d) => d.data() as ConversationDoc)
    .filter((c) => c.endedAt != null)
    .sort((a, b) => {
      const ta = (a.endedAt as any)?.toMillis?.() ?? 0;
      const tb = (b.endedAt as any)?.toMillis?.() ?? 0;
      return tb - ta;
    })
    .slice(0, 3);
  return convs.flatMap((c) => c.emotionTags ?? []);
}
