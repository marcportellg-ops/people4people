import type { ConversationDoc } from "@/lib/db";
import type { Timestamp } from "firebase/firestore";

export type Trophy = {
  id: string;
  name: string;
  description: string;
  unlockedAt: Timestamp | null;
  isSecret: boolean;
  emoji: string;
};

export const TROPHY_DEFS: Record<string, Omit<Trophy, "unlockedAt">> = {
  // Volume
  primera_palabra:    { id: "primera_palabra",    emoji: "🗣️", isSecret: false, name: "Primera Palabra",      description: "Tu primera conversación completada. Todo empieza aquí." },
  diez_presencias:    { id: "diez_presencias",    emoji: "🤝", isSecret: false, name: "Diez Presencias",      description: "Diez veces has aparecido cuando alguien lo necesitaba." },
  cincuenta_voces:    { id: "cincuenta_voces",    emoji: "🎯", isSecret: false, name: "Cincuenta Voces",      description: "Cincuenta conversaciones. Una presencia constante." },
  centenario:         { id: "centenario",         emoji: "💯", isSecret: false, name: "Centenario",           description: "Cien conversaciones. Extraordinario." },
  // Quality
  conexion_real:      { id: "conexion_real",      emoji: "✨", isSecret: false, name: "Conexión Real",        description: "Una sesión que llegó de verdad. Score 8 o más." },
  escucha_profunda:   { id: "escucha_profunda",   emoji: "👂", isSecret: false, name: "Escucha Profunda",     description: "Cinco sesiones de alta calidad. Sabes escuchar." },
  resonancia:         { id: "resonancia",         emoji: "🎵", isSecret: false, name: "Resonancia",           description: "Una sesión perfecta. 10 sobre 10." },
  constancia:         { id: "constancia",         emoji: "🔄", isSecret: false, name: "Constancia",           description: "Tres sesiones de alta calidad en la misma semana." },
  // Impact
  algo_cambio:        { id: "algo_cambio",        emoji: "🌟", isSecret: false, name: "Algo Cambió",          description: "El creador marcó tu sesión como significativa." },
  punto_de_giro:      { id: "punto_de_giro",      emoji: "🔑", isSecret: false, name: "Punto de Giro",        description: "Tu conversación fue un momento de cambio real." },
  guardado:           { id: "guardado",           emoji: "📖", isSecret: false, name: "Guardado",             description: "Tu transcripción fue revisada tres o más veces." },
  // Secret
  guardian_nocturno:  { id: "guardian_nocturno",  emoji: "🌙", isSecret: true,  name: "Guardián Nocturno",    description: "Estuviste presente entre las 2 y las 5 de la madrugada." },
  el_silencio_habla:  { id: "el_silencio_habla",  emoji: "❓", isSecret: true,  name: "El Silencio Habla",    description: "Más preguntas que respuestas. La curiosidad como cuidado." },
  poliglota_del_dolor:{ id: "poliglota_del_dolor",emoji: "🌍", isSecret: true,  name: "Políglota del Dolor",  description: "Has conectado con historias de cinco países distintos." },
  madrugada_larga:    { id: "madrugada_larga",    emoji: "⏰", isSecret: true,  name: "Madrugada Larga",      description: "Una sesión completa, hasta el último segundo." },
};

export const IMPACT_TROPHY_IDS = ["algo_cambio", "punto_de_giro", "guardado"];

export type TrophyCheckInput = {
  allConvs: ConversationDoc[];           // all completed convs for this helper (including the new one)
  newConv: ConversationDoc;              // the conversation that just ended
  newScore: number;                      // moderation score of the new conv
  characterLocation?: string;           // location of the character (e.g. "Madrid, ES")
  fullSession: boolean;                  // session lasted the full 15 minutes
  existingTrophyIds: Set<string>;        // trophies already awarded
};

export function evaluateTrophies(input: TrophyCheckInput): string[] {
  const { allConvs, newConv, newScore, characterLocation, fullSession, existingTrophyIds } = input;
  const earned: string[] = [];

  const award = (id: string) => {
    if (!existingTrophyIds.has(id)) earned.push(id);
  };

  const completed = allConvs.filter((c) => c.endedAt !== null);
  const highQuality = allConvs.filter((c) => (c.moderation?.score ?? 0) >= 8);
  const count = completed.length;

  // Volume
  if (count >= 1)   award("primera_palabra");
  if (count >= 10)  award("diez_presencias");
  if (count >= 50)  award("cincuenta_voces");
  if (count >= 100) award("centenario");

  // Quality
  if (newScore >= 8) award("conexion_real");
  if (highQuality.length >= 5) award("escucha_profunda");
  if (newScore === 10) award("resonancia");

  // constancia: 3 quality sessions (score >= 8) in the last 7 days
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekHighQ = allConvs.filter((c) =>
    (c.moderation?.score ?? 0) >= 8 &&
    c.startedAt &&
    (c.startedAt as any).toMillis?.() > weekAgo,
  );
  if (weekHighQ.length >= 3) award("constancia");

  // Secret: guardian_nocturno (2am–5am local time)
  const hour = new Date().getHours();
  if (hour >= 2 && hour < 5) award("guardian_nocturno");

  // Secret: el_silencio_habla (more ? than statements in helper messages)
  const helperMsgs = newConv.messages.filter((m) => m.role === "user");
  const questions   = helperMsgs.filter((m) => m.text.includes("?")).length;
  const statements  = helperMsgs.length - questions;
  if (helperMsgs.length >= 3 && questions > statements) award("el_silencio_habla");

  // Secret: madrugada_larga (full 15-minute session)
  if (fullSession) award("madrugada_larga");

  // Secret: poliglota_del_dolor (characters from 5+ different countries)
  if (characterLocation) {
    // We can only evaluate this if we aggregate locations across all convs
    // Pass character locations via existingTrophyIds — handled externally
  }

  return earned;
}
