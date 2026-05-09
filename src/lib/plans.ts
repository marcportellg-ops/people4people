export type Plan = "free" | "helper" | "creator";

export const PLAN_LIMITS: Record<Plan, { conversations: number; characters: number }> = {
  free:    { conversations: 2,        characters: 1 },
  helper:  { conversations: Infinity, characters: 1 },
  creator: { conversations: Infinity, characters: Infinity },
};

export const PLAN_META: Record<Plan, { label: string; price: string; period?: string; color: string }> = {
  free:    { label: "Free",             price: "€0",  color: "text-muted-foreground" },
  helper:  { label: "Helper Premium",   price: "€4",  period: "/mo", color: "text-primary" },
  creator: { label: "Creator Premium",  price: "€8",  period: "/mo", color: "text-amber-400" },
};

export function canStartConversation(plan: Plan, count: number): boolean {
  return count < PLAN_LIMITS[plan].conversations;
}

export function canCreateCharacter(plan: Plan, count: number): boolean {
  return count < PLAN_LIMITS[plan].characters;
}
