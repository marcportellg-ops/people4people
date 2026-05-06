import type { Character } from "@/data/characters";

const KEY = "p4p_user_characters";

export function saveCharacter(character: Character): void {
  const existing = getUserCharacters();
  localStorage.setItem(KEY, JSON.stringify([...existing, character]));
}

export function getUserCharacters(): Character[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
