import {
  collection, addDoc, getDocs, getDoc, doc, setDoc,
  updateDoc, arrayUnion, serverTimestamp,
  query, where, type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Character } from "@/data/characters";

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
  });
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

export async function markDeliveriesSeen(conversationIds: string[]): Promise<void> {
  await Promise.all(
    conversationIds.map((id) =>
      updateDoc(doc(db, "conversations", id), { seenByCreator: true }),
    ),
  );
}
