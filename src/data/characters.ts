import joan from "@/assets/joan.jpg";
import marta from "@/assets/marta.jpg";
import david from "@/assets/david.jpg";
import amina from "@/assets/amina.jpg";
import luis from "@/assets/luis.jpg";
import sana from "@/assets/sana.jpg";
import marcus from "@/assets/marcus.jpg";
import elena from "@/assets/elena.jpg";

export type Character = {
  id: string;
  name: string;
  age: number;
  portrait: string;
  intro: string;
  summary: string;
  longStory: string;
  emotionalStatus: "Heavy" | "Searching" | "Tender" | "Anxious" | "Withdrawn" | "Hopeful";
  tags: string[];
  location: string;
};

export const characters: Character[] = [
  {
    id: "joan",
    name: "Joan",
    age: 46,
    portrait: joan,
    intro: "Hi, I'm Joan. I recently separated, and I don't know how to rebuild my life.",
    summary: "Recently separated. Trying to remember who she is on her own.",
    longStory:
      "After 19 years of marriage, the silence at home is the loudest thing she's ever heard. She's not sure if she's allowed to want a new life — or if she even knows how.",
    emotionalStatus: "Searching",
    tags: ["separation", "identity", "midlife"],
    location: "Madrid, ES",
  },
  {
    id: "marta",
    name: "Marta",
    age: 58,
    portrait: marta,
    intro: "I'm Marta. My mother passed last spring, and I keep finding her handwriting everywhere.",
    summary: "Grieving her mother. Time stopped, and the world kept moving.",
    longStory:
      "She still keeps her mother's voicemail. She doesn't want closure — she wants to know how to carry it without it crushing her.",
    emotionalStatus: "Tender",
    tags: ["grief", "family", "loss"],
    location: "Lisbon, PT",
  },
  {
    id: "david",
    name: "David",
    age: 22,
    portrait: david,
    intro: "Hey, I'm David. I'm supposed to move out next month and I can't breathe when I think about it.",
    summary: "Anxious about leaving home for the first time.",
    longStory:
      "Everyone says it's exciting. He smiles and nods. At night, he lies awake counting the things that could go wrong.",
    emotionalStatus: "Anxious",
    tags: ["anxiety", "transitions", "self-esteem"],
    location: "Manchester, UK",
  },
  {
    id: "amina",
    name: "Amina",
    age: 34,
    portrait: amina,
    intro: "I'm Amina. The debt is bigger than me now, and I don't know how to tell anyone.",
    summary: "Overwhelmed by debt. Carrying it alone, in silence.",
    longStory:
      "She opens the bank app, then closes it. She hasn't told her partner. She wonders if asking for help means she's already failed.",
    emotionalStatus: "Heavy",
    tags: ["money", "shame", "isolation"],
    location: "Toronto, CA",
  },
  {
    id: "luis",
    name: "Luis",
    age: 41,
    portrait: luis,
    intro: "I'm Luis. I lost my job in February. The loneliest part isn't the money.",
    summary: "Lonely after losing his job. Days feel shapeless.",
    longStory:
      "He used to be the one people called. Now his phone is quiet, and he's not sure who he is without the title on a business card.",
    emotionalStatus: "Withdrawn",
    tags: ["loneliness", "identity", "purpose"],
    location: "Buenos Aires, AR",
  },
  {
    id: "sana",
    name: "Sana",
    age: 37,
    portrait: sana,
    intro: "I'm Sana. I'm successful by every measure — and I've never felt so empty.",
    summary: "Quiet burnout under a polished life.",
    longStory:
      "She built the life she was told to want. The view from the top is grey. She's afraid to admit it out loud.",
    emotionalStatus: "Searching",
    tags: ["burnout", "purpose", "self-esteem"],
    location: "Singapore",
  },
  {
    id: "marcus",
    name: "Marcus",
    age: 62,
    portrait: marcus,
    intro: "Marcus. My grandson stopped calling. I think I said something wrong, and I don't know what.",
    summary: "Estranged from family. Wants to reach back, gently.",
    longStory:
      "He's old enough to know pride costs more than apologies. He doesn't want to be right. He wants Sunday dinners back.",
    emotionalStatus: "Hopeful",
    tags: ["family", "estrangement", "regret"],
    location: "Atlanta, US",
  },
  {
    id: "elena",
    name: "Elena",
    age: 28,
    portrait: elena,
    intro: "I'm Elena. I've been hiding a part of myself from everyone I love.",
    summary: "Carrying a truth she hasn't shared yet.",
    longStory:
      "She's rehearsed the conversation a hundred times in the shower. She doesn't need advice — she needs to feel less alone before she says it out loud.",
    emotionalStatus: "Tender",
    tags: ["identity", "family", "courage"],
    location: "Mexico City, MX",
  },
];

export const getCharacter = (id: string) => characters.find((c) => c.id === id);
