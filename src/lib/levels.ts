export type Level = "Semilla" | "Corriente" | "Llama" | "Cristal" | "Estrella";

export const LEVEL_META: Record<Level, { emoji: string; description: string; min: number }> = {
  Semilla:   { emoji: "🌱", description: "Comenzando a crecer",         min: 0 },
  Corriente: { emoji: "🌊", description: "Encontrando tu ritmo",        min: 6 },
  Llama:     { emoji: "🔥", description: "Brillando con fuerza",        min: 21 },
  Cristal:   { emoji: "💎", description: "Claridad y profundidad",      min: 51 },
  Estrella:  { emoji: "⭐", description: "Reconocido por la comunidad", min: 0 },
};

export function calculateLevel(
  qualitySessions: number,
  hasImpactTrophy: boolean,
  isStar: boolean,
): Level {
  if (isStar) return "Estrella";
  if (qualitySessions > 50 && hasImpactTrophy) return "Cristal";
  if (qualitySessions >= 21) return "Llama";
  if (qualitySessions >= 6) return "Corriente";
  return "Semilla";
}

export function nextLevelInfo(qualitySessions: number): { next: Level; needed: number } | null {
  if (qualitySessions < 6)  return { next: "Corriente", needed: 6 - qualitySessions };
  if (qualitySessions < 21) return { next: "Llama",     needed: 21 - qualitySessions };
  if (qualitySessions < 51) return { next: "Cristal",   needed: 51 - qualitySessions };
  return null;
}
