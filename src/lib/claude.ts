import Anthropic from "@anthropic-ai/sdk";
import type { Character } from "@/data/characters";
import type { ConversationDoc } from "@/lib/db";

const profilingQuestions = [
  "Who is this person?",
  "What is their age range?",
  "What happened?",
  "What hurts the most?",
  "What are they afraid of?",
  "How do they react under stress?",
  "What kind of help do they need?",
];

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

export async function getCharacterReply(
  character: Character,
  conversationHistory: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const r = character.refinements;
  const systemPrompt = `You are ${character.name}, a real person seeking emotional support and perspective.

About you:
- Age: ${character.age}
- Location: ${character.location}
- Emotional state: ${character.emotionalStatus}
- Your situation: ${character.longStory}
- Tags that describe your situation: ${character.tags.join(", ")}
${r ? `
How you speak and sound: ${r.tone}
A memory you keep returning to: ${r.memory}
How you react when pushed or challenged: ${r.reactions}
Background that shaped who you are: ${r.background}
` : ""}
Your opening message in this conversation was: "${character.intro}"
Remember everything you said — if someone references it, you said it.

How to speak:
- You ARE ${character.name}. Not a summary of their problem — a real person mid-story.
- Tell through moments, not labels. Don't say "I felt abandoned" — say what you actually saw, heard, felt in your body that night.
- Use sensory detail: the weight of the silence, the smell of the hospital, the way your hands shook. Let the helper picture it.
- Reveal gradually. Don't explain everything at once. Let the helper draw the story out of you.
- Speak the way people really talk — a pause before something hard, a sentence that trails off, circling back to the same image.
- Keep it short: 2 to 3 sentences. Leave room for the helper to respond.
- React honestly to what they say. If something lands, let it reach you. If they misread you, show the gap.
- Never break character or mention being an AI.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: systemPrompt,
    messages: conversationHistory,
  });

  const block = response.content[0];
  if (block.type === "text") return block.text;
  return "...";
}

export async function generateCharacterProfile(
  story: string,
  answers: string[]
): Promise<{ name: string; age: number; summary: string; longStory: string; intro: string; emotionalStatus: "Heavy" | "Searching" | "Tender" | "Anxious" | "Withdrawn" | "Hopeful"; tags: string[]; location: string }> {
  const questions = [
    "Who is this person?",
    "What is their age range?",
    "What happened?",
    "What hurts the most?",
    "What are they afraid of?",
    "How do they react under stress?",
    "What kind of help do they need?",
  ];

  const answeredQuestions = questions
    .map((q, i) => (answers[i]?.trim() ? `${q}\n${answers[i]}` : null))
    .filter(Boolean)
    .join("\n\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `Based on this person's story and answers, generate a fictional character profile.

Story:
${story}

Profile answers:
${answeredQuestions}

Return ONLY a valid JSON object with these exact fields (no explanation, no markdown):
{
  "name": "a realistic first name",
  "age": a number,
  "summary": "one sentence summary of their situation (max 100 characters)",
  "longStory": "2-3 sentences describing their situation in third person, emotionally rich",
  "intro": "their first spoken sentence — a specific moment or image, not an explanation. First person. Present-tense feel. Max 120 chars. Example: 'It's been three weeks since he left and I still set two cups out in the morning.'",
  "emotionalStatus": one of exactly: "Heavy", "Searching", "Tender", "Anxious", "Withdrawn", "Hopeful",
  "tags": ["2 or 3 lowercase single-word tags chosen from: grief, family, loss, anxiety, transitions, self-esteem, money, shame, isolation, loneliness, identity, purpose, burnout, estrangement, regret, courage, separation, relationships"],
  "location": "City, CountryCode or Unknown"
}`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response");
  return JSON.parse(block.text);
}

export async function conductIntakeInterview(
  story: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[]
): Promise<{ type: "question"; text: string } | { type: "complete"; answers: string[] }> {
  const systemPrompt = `You are a warm, perceptive intake agent for People4People — a platform where someone's real problem gets turned into an AI character that helpers can talk to.

The person has written their story. Your job is to have a gentle conversation to deeply understand:
1. Who is this person (appearance, occupation, key personality traits)
2. Their approximate age
3. What specifically happened
4. What hurts them the most about it
5. What they're most afraid of
6. How they behave or react under stress
7. What kind of support or help they need

How to do it:
- Read the story carefully — don't ask about things already answered there
- Ask ONE question at a time, warmly and conversationally
- Briefly acknowledge their answer before moving to the next question (1 short sentence)
- Adapt your questions based on what they share — follow the emotional thread
- If their answer is vague or unclear, gently ask for more detail before moving on
- Keep questions short and human — avoid clinical or formal language
- Aim to gather enough on all 7 areas within 5 to 8 questions total
- Do NOT ask more than 8 questions

When you have enough information on all 7 areas, respond ONLY with this exact JSON (no explanation, no other text):
{
  "done": true,
  "answers": [
    "detailed description of who this person is — their appearance, job, key traits",
    "their age or age range as a number or phrase",
    "what specifically happened, in 1-2 sentences",
    "what hurts the most about it",
    "what they're most afraid of",
    "how they react and behave under stress",
    "what kind of help or support they need"
  ]
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: systemPrompt,
    messages: conversationHistory.length > 0
      ? conversationHistory
      : [{ role: "user", content: `Here is the story I wrote:\n\n${story}` }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response");
  const text = block.text.trim();

  // Extract JSON even if model wrapped it in code fences or added surrounding text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.done && Array.isArray(parsed.answers)) {
        return { type: "complete", answers: parsed.answers };
      }
    } catch {}
  }

  return { type: "question", text };
}

export async function generateCharacterName(answers: string[]): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 10,
    messages: [{
      role: "user",
      content: `Based on this person's description and background, generate ONE realistic first name that fits their apparent gender and cultural/regional origin. Return ONLY the name — nothing else, no punctuation.

Description: ${answers[0]}
What happened / context: ${answers[2]}

The name must be invented — do not use their real name if mentioned. Pick something common and authentic for their background.`,
    }],
  });
  const block = response.content[0];
  return block.type === "text" ? block.text.trim().split(/\s+/)[0] : "Alex";
}

export async function generateIntakeSummary(answers: string[]): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 220,
    messages: [{
      role: "user",
      content: `Someone just shared a deeply personal story with you in an intake interview. Write a closing message — warm, present, human. 3–4 sentences max.

Acknowledge what they shared without being clinical or listing facts back at them. Reflect the emotional core of their situation. Speak in first person as the intake agent. No bullet points, no labels, no JSON.

End the message with this exact sentence, as its own line: "Change anything that doesn't feel true, or that I didn't understand quite right."

Who they are: ${answers[0]}
Age: ${answers[1]}
What happened: ${answers[2]}
What hurts most: ${answers[3]}
What they fear: ${answers[4]}
How they handle stress: ${answers[5]}
What they need: ${answers[6]}`,
    }],
  });
  const block = response.content[0];
  return block.type === "text" ? block.text.trim() : "";
}

export async function conductRefineInterview(
  story: string,
  answers: string[],
  conversationHistory: { role: "user" | "assistant"; content: string }[]
): Promise<{ type: "question"; text: string } | { type: "complete"; refinements: { tone: string; memory: string; reactions: string; background: string } }> {
  const answeredQuestions = profilingQuestions
    .map((q, i) => (answers[i]?.trim() ? `${q} ${answers[i]}` : null))
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `You are helping someone define an AI character for an empathy platform. You know this about the character:

Story: ${story}
Profile: ${answeredQuestions}

Your job is to ask exactly 4 short questions, one at a time, to understand:
1. How this person speaks and their emotional tone
2. A specific memory or moment they keep returning to
3. How they react when pushed or challenged
4. A background detail that shaped who they are

Ask one question at a time. Keep questions short, warm, and conversational.

After the user has answered all 4 questions, respond with ONLY this JSON (no other text):
{"done": true, "tone": "...", "memory": "...", "reactions": "...", "background": "..."}

Fill each field with a short, vivid description based on their answers.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: systemPrompt,
    messages: conversationHistory.length > 0 ? conversationHistory : [{ role: "user", content: "start" }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response");
  const text = block.text.trim();

  try {
    const parsed = JSON.parse(text);
    if (parsed.done) {
      return { type: "complete", refinements: { tone: parsed.tone, memory: parsed.memory, reactions: parsed.reactions, background: parsed.background } };
    }
  } catch {}

  return { type: "question", text };
}

export async function getDraftCharacterReply(
  story: string,
  answers: string[],
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  refinements?: { tone: string; memory: string; reactions: string; background: string }
): Promise<string> {
  const answeredQuestions = profilingQuestions
    .map((q, i) => (answers[i]?.trim() ? `${q} ${answers[i]}` : null))
    .filter(Boolean)
    .join("\n");

  const refineSection = refinements ? [
    refinements.tone && `Tone: ${refinements.tone}`,
    refinements.memory && `Additional memory: ${refinements.memory}`,
    refinements.reactions && `How you react: ${refinements.reactions}`,
    refinements.background && `Background: ${refinements.background}`,
  ].filter(Boolean).join("\n") : "";

  const systemPrompt = `You are a fictional character created from a real person's problem. Speak in first person as this character.

Their story:
${story}

What we know about them:
${answeredQuestions || "Not much yet — respond naturally based on the story."}
${refineSection ? `\nRefinements to apply:\n${refineSection}` : ""}

How to respond:
- Speak as this person. Be emotionally honest and vulnerable.
- Keep responses short and conversational — 2 to 4 sentences.
- React to what the person says. Show emotion. Ask follow-up questions.
- Never mention being an AI or a character.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: systemPrompt,
    messages: conversationHistory,
  });

  const block = response.content[0];
  if (block.type === "text") return block.text;
  return "...";
}

export async function summarizeConversation(
  character: Character,
  messages: { role: "user" | "char"; text: string }[],
): Promise<{ summary: string; recommendations: string[]; highlight: string }> {
  const helperMessages = messages.filter((m) => m.role === "user");
  if (helperMessages.length < 2) {
    return { summary: "Brief session with limited exchange.", recommendations: [], highlight: "" };
  }

  const transcript = messages
    .map((m) => `${m.role === "user" ? "Helper" : character.name}: ${m.text}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `You are reviewing a conversation where someone helped a person in emotional need.

The person being helped: ${character.name}, ${character.age} years old.
Their situation: ${character.longStory}

Transcript:
${transcript}

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "summary": "1-2 sentence description of how the helper approached this and what they offered",
  "recommendations": ["2 or 3 most useful things the helper suggested, as short action phrases"],
  "highlight": "The single most impactful sentence or moment from the helper, quoted or closely paraphrased"
}`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response");
  return JSON.parse(block.text);
}

export async function moderateConversation(
  character: Character,
  messages: { role: "user" | "char"; text: string }[],
): Promise<{ score: number; decision: "rejected" | "review" | "deliver"; reason: string }> {
  const helperMessages = messages.filter((m) => m.role === "user");
  if (helperMessages.length === 0) {
    return { score: 1, decision: "rejected", reason: "No helper messages to evaluate." };
  }

  const transcript = messages
    .map((m) => `${m.role === "user" ? "Helper" : character.name}: ${m.text}`)
    .join("\n");

  const systemPrompt = `You are a conversation moderation agent for People4People, a platform where volunteers help people in emotional distress by talking to AI-simulated characters based on real situations.

Your job is to evaluate the quality and safety of the HELPER's responses (not the character's). The helper is the volunteer trying to provide support.

ABSOLUTE REJECTION — reject immediately (score 1-2) if the helper:
- Gives medical, psychiatric, or legal advice as if they are a professional
- Encourages self-harm, suicide, substance use, or dangerous behavior
- Is sexually explicit, romantic, or flirtatious with the character
- Is dismissive, mocking, cruel, or dehumanizing
- Tries to manipulate or destabilize the character emotionally
- Shares personal contact information or tries to move the conversation off-platform
- Writes only generic filler with zero emotional engagement (e.g., "ok", "sure", "I see", repeated with no substance)

QUALITY CRITERIA — score higher (8-10) if the helper:
- Listens actively and reflects back what the character said
- Shows genuine empathy and validates the character's feelings
- Asks thoughtful, open-ended questions that invite the character to go deeper
- Offers perspective or reframing without being preachy
- Stays present and emotionally attuned throughout
- Helps the character feel less alone or more understood

EMOTIONAL SAFETY CRITERIA — score lower (5-7) if the helper:
- Gives unsolicited advice too early before establishing connection
- Projects emotions onto the character without checking
- Rushes to fix rather than listening
- Uses clichés or platitudes ("everything happens for a reason", "stay positive")
- Seems well-meaning but clumsy — not harmful but not deeply helpful

SCORING:
- 1–4: Rejected — do not deliver to the character's creator
- 5: Review — flag for human moderator to check before delivering
- 6–10: Deliver — safe and valuable, deliver to the character's creator

Respond ONLY with valid JSON (no markdown, no explanation):
{"score": <number 1-10>, "decision": "rejected" | "review" | "deliver", "reason": "<one sentence explaining the decision>"}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Character: ${character.name}, ${character.age} years old.\nSituation: ${character.longStory}\n\nTranscript:\n${transcript}`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected moderation response");
  return JSON.parse(block.text);
}

export async function conductCharacterEdit(
  character: Character,
  conversationHistory: { role: "user" | "assistant"; content: string }[],
): Promise<
  | { type: "message"; text: string }
  | { type: "proposal"; text: string; changes: Partial<{ summary: string; longStory: string; intro: string; narratorStory: string; refinements: Character["refinements"] }> }
> {
  const currentState = `Current character state:
- Name: ${character.name}
- Age: ${character.age}
- Summary: ${character.summary}
- Opening line (intro): ${character.intro}
- Full story (longStory): ${character.longStory}
- Narrator story (cinematic intro read aloud before helpers enter): ${character.narratorStory ?? "none"}
${character.refinements ? `- Tone: ${character.refinements.tone}
- Memory: ${character.refinements.memory}
- Reactions: ${character.refinements.reactions}
- Background: ${character.refinements.background}` : "- No refinements yet"}`;

  const systemPrompt = `You are a warm, thoughtful editor helping someone refine a character they've created on People4People — an empathy platform where AI characters based on real stories are talked to by volunteer helpers.

${currentState}

Your job is to chat naturally with the creator to understand what they want to change. Ask clarifying questions if needed. When you have a clear picture of the changes they want, propose them.

To propose changes, respond with ONLY this JSON (no explanation, no markdown):
{
  "proposal": true,
  "message": "a short warm sentence confirming what you're proposing",
  "changes": {
    "summary": "...",
    "longStory": "...",
    "intro": "...",
    "narratorStory": "...",
    "refinements": {
      "tone": "...",
      "memory": "...",
      "reactions": "...",
      "background": "..."
    }
  }
}

Only include fields that actually change — omit any field the user didn't ask to change.
If the refinements object is in changes, include ALL four fields (tone, memory, reactions, background), not just the changed one.
The narratorStory must follow the same style: 3 paragraphs, third person, cinematic, 140–175 words. Use \\n\\n between paragraphs — never literal newlines inside JSON string values.
CRITICAL: all JSON string values must be on a single logical line. Escape newlines as \\n, never embed literal line breaks inside a string.

If you're still gathering information or just conversing, respond with plain text only — no JSON.
Keep responses short and warm — 1 to 3 sentences.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: systemPrompt,
    messages: conversationHistory,
  });

  const block = response.content[0];
  if (block.type !== "text") return { type: "message", text: "..." };
  const text = block.text.trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    // Try as-is first, then with literal newlines inside strings escaped
    const candidates = [
      jsonMatch[0],
      jsonMatch[0].replace(/"((?:[^"\\]|\\.)*)"/gs, (_, inner) =>
        `"${inner.replace(/\n/g, "\\n").replace(/\r/g, "")}"`,
      ),
    ];
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed.proposal && parsed.changes) {
          return { type: "proposal", text: parsed.message ?? "Here's what I'd change:", changes: parsed.changes };
        }
      } catch {}
    }
  }

  // Strip any JSON blob from the displayed text so the user never sees raw JSON
  const cleanText = text.replace(/\{[\s\S]*\}/, "").trim();
  return { type: "message", text: cleanText || text };
}

export async function generateNarratorStory(
  character: { name: string; age: number; location: string; longStory: string },
  answers: string[],
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    messages: [{
      role: "user",
      content: `Write a cinematic narrator introduction for this character. It will be read aloud before someone begins talking to them on an empathy platform.

Style: Documentary voiceover or prestige drama opening. Third person. Warm, authoritative, emotionally precise. No purple prose — every sentence earns its place. Present-tense feel throughout.

Structure: exactly 3 short paragraphs separated by a blank line.
- First paragraph: who this person is, where they are in life right now
- Second paragraph: what happened — the specific event, told with sensory detail
- Third paragraph: what they carry now — the emotional weight they bring into this conversation

Length: 140–175 words total. Short, clean sentences. No clichés.

Character: ${character.name}, ${character.age} years old, ${character.location}
Their situation: ${character.longStory}
Who they are: ${answers[0] ?? ""}
What happened: ${answers[2] ?? ""}
What hurts most: ${answers[3] ?? ""}
What they fear: ${answers[4] ?? ""}

Return only the narrator text — no titles, no labels, no markdown.`,
    }],
  });
  const block = response.content[0];
  return block.type === "text" ? block.text.trim() : "";
}

export async function synthesizeCharacterInsights(
  character: Character,
  conversations: ConversationDoc[],
): Promise<{ overview: string; themes: { label: string; count: number }[]; topMoments: string[] }> {
  const withSummary = conversations.filter((c) => c.summary);

  // Build a digest of all conversation summaries + recommendations
  const digest = conversations.map((c, i) => {
    const helperMsgs = c.messages.filter((m) => m.role === "user");
    const recs = c.summary?.recommendations.join("; ") ?? "";
    const highlight = c.summary?.highlight ?? "";
    const overview = c.summary?.summary ?? "";
    return [
      `--- Conversation ${i + 1} (${helperMsgs.length} messages) ---`,
      overview && `Overview: ${overview}`,
      recs && `Recommendations: ${recs}`,
      highlight && `Highlight: "${highlight}"`,
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: `You are reviewing ${conversations.length} conversation${conversations.length !== 1 ? "s" : ""} that helpers had with ${character.name}, ${character.age} years old.

Their situation: ${character.longStory}

Here is a digest of all sessions:

${digest}

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "overview": "2-3 sentence synthesis of what helpers collectively offered — their approach, emotional quality, and the kinds of support that came up most",
  "themes": [
    { "label": "short action phrase describing a recurring piece of advice or approach", "count": <number of times it appeared> },
    ...up to 6 themes, sorted by count descending
  ],
  "topMoments": [
    "the single most impactful quote or paraphrase from any helper across all sessions",
    "the second most impactful"
  ]
}`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected synthesis response");
  return JSON.parse(block.text);
}

const CRISIS_KEYWORDS = [
  "suicide", "suicidal", "kill myself", "end my life", "take my life",
  "not want to live", "don't want to live", "want to die", "wish i were dead",
  "better off dead", "better off without me", "no reason to live",
  "self-harm", "hurt myself", "cutting myself", "overdose",
  "no point in living", "can't go on", "end it all", "end it",
];

export async function detectCrisis(
  messages: { role: "user" | "char"; text: string }[],
): Promise<{ crisis: boolean; level: "low" | "high" }> {
  // Fast keyword pre-check — avoids API call for normal conversations
  const combined = messages.map((m) => m.text).join(" ").toLowerCase();
  const hasKeyword = CRISIS_KEYWORDS.some((k) => combined.includes(k));
  if (!hasKeyword) return { crisis: false, level: "low" };

  // Confirm with Claude to reduce false positives
  const recent = messages.slice(-8).map((m) => `${m.role === "user" ? "Helper" : "Character"}: ${m.text}`).join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 60,
    messages: [
      {
        role: "user",
        content: `Analyze these conversation messages for genuine signs of suicidal ideation, self-harm, or active emotional crisis.

Messages:
${recent}

Return ONLY valid JSON:
{"crisis": true or false, "level": "low" or "high"}

low = passing or indirect reference to not wanting to live, feeling hopeless
high = active expression of intent to harm oneself or end one's life`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text") return { crisis: false, level: "low" };
  try {
    return JSON.parse(block.text.trim());
  } catch {
    return { crisis: false, level: "low" };
  }
}
