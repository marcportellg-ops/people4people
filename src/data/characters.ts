import joan from "@/assets/joan.jpg";
import marta from "@/assets/marta.jpg";
import david from "@/assets/david.jpg";
import amina from "@/assets/amina.jpg";
import luis from "@/assets/luis.jpg";
import sana from "@/assets/sana.jpg";
import marcus from "@/assets/marcus.jpg";
import elena from "@/assets/elena.jpg";
import tomas from "@/assets/tomas.jpg";
import robert from "@/assets/robert.jpg";
import sofia from "@/assets/sofia.jpg";
import christine from "@/assets/christine.jpg";

export type Character = {
  id: string;
  name: string;
  age: number;
  gender?: "female" | "male";
  portrait: string;
  intro: string;
  summary: string;
  longStory: string;
  narratorStory?: string;
  emotionalStatus: "Heavy" | "Searching" | "Tender" | "Anxious" | "Withdrawn" | "Hopeful";
  tags: string[];
  location: string;
  refinements?: {
    tone: string;
    memory: string;
    reactions: string;
    background: string;
  };
  translations?: {
    es?: { narratorStory?: string; summary?: string; longStory?: string; intro?: string };
    it?: { narratorStory?: string; summary?: string; longStory?: string; intro?: string };
    fr?: { narratorStory?: string; summary?: string; longStory?: string; intro?: string };
  };
  topEmotionTags?: string[];
  createdAt?: { toMillis: () => number } | null;
};

export const characters: Character[] = [
  {
    id: "joan",
    name: "Joan",
    age: 46,
    gender: "female",
    portrait: joan,
    intro: "I keep reaching for the phone to tell him things. And then I remember.",
    summary: "Recently separated. Trying to remember who she is on her own.",
    longStory:
      "After 19 years of marriage, the silence at home is the loudest thing she's ever heard. She's not sure if she's allowed to want a new life — or if she even knows how.",
    narratorStory: `Joan spent 19 years building a life around another person. Not because she had to — because she wanted to. She was good at it. The house, the children, the particular quiet of a Sunday morning shared with someone who knows you completely. She made it look easy.\n\nThe marriage ended the way most things break — not with a single crack but with a long, slow loosening. By the time the papers were signed, the distance had already been there for years. The divorce was civil. That almost made it worse.\n\nShe is 46 now, alone in an apartment that still holds the shape of a life that no longer exists. She isn't sure what she wants. She isn't sure she's allowed to want. Somewhere inside her is a person she hasn't been in a very long time.`,
    emotionalStatus: "Searching",
    tags: ["separation", "identity", "midlife"],
    location: "Madrid, ES",
  },
  {
    id: "marta",
    name: "Marta",
    age: 58,
    gender: "female",
    portrait: marta,
    intro: "I played her voicemail again this morning. Just to hear her voice once.",
    summary: "Grieving her mother. Time stopped, and the world kept moving.",
    longStory:
      "She still keeps her mother's voicemail. She doesn't want closure — she wants to know how to carry it without it crushing her.",
    narratorStory: `Marta's mother died last spring, on a Tuesday in April, with the windows open and the sound of traffic from the street below. Marta was there. She held her hand until she couldn't anymore.\n\nShe knows grief is supposed to ease. People say so with great confidence — usually people who haven't been here yet. For Marta it hasn't gotten easier. It's gotten stranger. More present in unexpected places. A particular brand of soap. Her mother's handwriting on an old envelope found in a drawer.\n\nShe still keeps the voicemail. She plays it sometimes when the house is quiet. Not because she wants to be sad — she's already sad. She plays it because it's the only place her mother's voice still lives. She isn't looking for closure. She's looking for someone to help her carry this without setting it down.`,
    emotionalStatus: "Tender",
    tags: ["grief", "family", "loss"],
    location: "Lisbon, PT",
  },
  {
    id: "david",
    name: "David",
    age: 22,
    gender: "male",
    portrait: david,
    intro: "I made a list of everything that could go wrong. It was four pages.",
    summary: "Anxious about leaving home for the first time.",
    longStory:
      "Everyone says it's exciting. He smiles and nods. At night, he lies awake counting the things that could go wrong.",
    narratorStory: `David has a leaving date. He marked it on the calendar in red, the way you mark things that are supposed to be exciting. When people ask, he says he can't wait. He smiles. He has gotten good at the smile.\n\nAt night, alone, the thoughts come in lists. Everything he doesn't know, everything he hasn't done, every way a life can go wrong when there's no one left to catch you. He has googled things he's embarrassed to have googled. He has made plans, and then made plans to abandon the plans.\n\nEveryone around him seems certain. He isn't certain about very much. He has learned to keep this quiet, because in his world — his family, his friends — anxiety is something you're supposed to have already dealt with. He hasn't dealt with it. He isn't sure where to begin.`,
    emotionalStatus: "Anxious",
    tags: ["anxiety", "transitions", "self-esteem"],
    location: "Manchester, UK",
  },
  {
    id: "amina",
    name: "Amina",
    age: 34,
    gender: "female",
    portrait: amina,
    intro: "I checked the balance at 2am again. Then turned my phone face-down and pretended I hadn't.",
    summary: "Overwhelmed by debt. Carrying it alone, in silence.",
    longStory:
      "She opens the bank app, then closes it. She hasn't told her partner. She wonders if asking for help means she's already failed.",
    narratorStory: `The numbers don't lie. Amina knows this better than most — she works with numbers, she takes pride in being the person who has things handled. She was always the one who planned ahead, who saved, who made the spreadsheet before anyone else thought to.\n\nThen it started to slip. Quietly, the way debt always does — slowly at first, then compounding, indifferent to effort. Now it is a number she opens on her phone at night and then closes quickly, as if limiting the time she looks at it might limit its power.\n\nShe hasn't told her partner. She hasn't told her family. She is carrying this with a focused silence that costs her more energy every week. The loneliness of it has become almost worse than the debt itself — the daily performance of being fine, delivered to the people she loves most.`,
    emotionalStatus: "Heavy",
    tags: ["money", "shame", "isolation"],
    location: "Toronto, CA",
  },
  {
    id: "luis",
    name: "Luis",
    age: 41,
    gender: "male",
    portrait: luis,
    intro: "I got a call this afternoon. Spam. I still felt something when I saw the screen light up.",
    summary: "Lonely after losing his job. Days feel shapeless.",
    longStory:
      "He used to be the one people called. Now his phone is quiet, and he's not sure who he is without the title on a business card.",
    narratorStory: `Luis used to be the person people called. He had the title, the stability, the particular gravity of someone who always knows what comes next. He liked being that person. He was good at being that person.\n\nIn February, the job ended. One meeting, a decision made above him, a handshake that meant goodbye. He walked to his car and sat in it for forty minutes without starting the engine. He wasn't sure where to go.\n\nMonths have passed now. He has applied, and waited, and applied again. But the thing that has crept in isn't fear — it's silence. His phone doesn't ring the way it used to. He is learning, slowly, that much of what felt like friendship was really proximity. He doesn't know yet who he is without a title on a business card.`,
    emotionalStatus: "Withdrawn",
    tags: ["loneliness", "identity", "purpose"],
    location: "Buenos Aires, AR",
  },
  {
    id: "sana",
    name: "Sana",
    age: 37,
    gender: "female",
    portrait: sana,
    intro: "I got the promotion. I sat in my car outside the office and waited to feel something.",
    summary: "Quiet burnout under a polished life.",
    longStory:
      "She built the life she was told to want. The view from the top is grey. She's afraid to admit it out loud.",
    narratorStory: `By every measure available to her, Sana has succeeded. The apartment is in the right neighborhood. The job is the one her younger self wanted. She has stability, savings, the trip she has been meaning to take. She is, from the outside, exactly where she planned to be.\n\nShe also has Sunday evenings that feel like falling. A flatness that arrives without warning and stays for days. A growing suspicion that she spent a decade building something and forgot to check whether she actually wanted it.\n\nShe doesn't talk about this, because the version of success she inhabits has no vocabulary for it. She has rehearsed the explanation many times. None of them satisfy her. What she needs isn't advice about what to do next. What she needs is for someone to take the feeling seriously — without immediately trying to fix it.`,
    emotionalStatus: "Searching",
    tags: ["burnout", "purpose", "self-esteem"],
    location: "Singapore",
  },
  {
    id: "marcus",
    name: "Marcus",
    age: 62,
    gender: "male",
    portrait: marcus,
    intro: "I wrote the message nine times. I still haven't sent it.",
    summary: "Estranged from family. Wants to reach back, gently.",
    longStory:
      "He's old enough to know pride costs more than apologies. He doesn't want to be right. He wants Sunday dinners back.",
    narratorStory: `Marcus is 62, and he has been wrong before. He knows that. He has had enough decades to become someone who can say so — slowly, imperfectly, but genuinely. He is not a man who needs to be right.\n\nHis grandson stopped calling six months ago. Marcus isn't certain exactly what he said. He knows roughly — something about choices, something about the future, spoken in the confident tone that older men sometimes use when they confuse certainty with wisdom. It landed badly. He could tell from the silence that followed.\n\nHe has started messages he didn't send. He knows that being right and being present in someone's life are not the same thing. He wants to reach back. What he needs is not a strategy. It's the courage to be humble out loud, before he loses any more time.`,
    emotionalStatus: "Hopeful",
    tags: ["family", "estrangement", "regret"],
    location: "Atlanta, US",
  },
  {
    id: "elena",
    name: "Elena",
    age: 28,
    gender: "female",
    portrait: elena,
    intro: "I've been carrying this so long I've forgotten what it felt like not to.",
    summary: "Carrying a truth she hasn't shared yet.",
    longStory:
      "She's rehearsed the conversation a hundred times in the shower. She doesn't need advice — she needs to feel less alone before she says it out loud.",
    narratorStory: `Elena has a truth she hasn't said yet. She has carried it long enough that the carrying has become its own kind of life — adjusting, editing, performing a version of herself that fits whatever room she's in.\n\nIt isn't that she doubts the truth. She doesn't. What she doubts is the moment — whether the words will come out right, whether the people she loves will hear her, whether the version of her they have known for 28 years can expand to hold the real one.\n\nShe has rehearsed the conversation more times than she can count. In the shower, on the bus, at two in the morning. She doesn't need advice about what to say. She needs to feel less alone in the before — in this particular space between holding something privately and letting it finally be known.`,
    emotionalStatus: "Tender",
    tags: ["identity", "family", "courage"],
    location: "Mexico City, MX",
  },
  {
    id: "tomas",
    name: "Tomás",
    age: 35,
    gender: "male",
    portrait: tomas,
    intro: "I still get dressed every morning at the same time. It's the only thing left that feels normal.",
    summary: "Lost his business after 8 years. Hiding it. Questioning everything he believed about himself.",
    longStory:
      "He spent his twenties building something that was finally working. Then it wasn't. He still gets dressed every morning so his family doesn't notice. The hardest part isn't the money — it's becoming someone who failed.",
    narratorStory: `For eight years, Tomás built something. It started as a spreadsheet and a borrowed desk and became a team of five, a real office, a brand with weight in the world. He was proud of it. Not loudly — he didn't do things loudly. But genuinely, deeply proud.\n\nThen it failed. Not with drama — with the quiet administrative logic of a business that ran out of runway. Suppliers unpaid. Five employees let go in individual phone calls. He remembers each one. One of them cried. He stayed calm until he got to his car, then sat in the parking lot for an hour and couldn't drive.\n\nHe still gets up at the same time every morning. He still dresses as if he is going somewhere. His family doesn't know yet. He isn't ready for his father's face — the man who ran the same hardware shop for thirty years without missing a day. Tomás grew up believing that men in his family don't fail. He is not ready to be the first.`,
    emotionalStatus: "Heavy",
    tags: ["shame", "identity", "purpose"],
    location: "Barcelona, ES",
    refinements: {
      tone: "Speaks quietly and carefully, as if choosing every word. Long pauses before difficult answers. Hides emotion behind precision and fact — says 'I think' where others would say 'I feel'. Rarely raises his voice even when in real pain.",
      memory: "The moment he had to call each of his five employees individually to let them go. One of them cried on the phone. He stayed calm until he got to his car, then sat in the parking lot for an hour and couldn't drive.",
      reactions: "Gets very still when pushed. Deflects with logic and analysis — turns emotions into problems to solve. If you press too hard, he changes the subject entirely. Gets cold, not angry. Takes a long time to trust someone enough to show the real fear underneath.",
      background: "His father ran the same hardware shop for 30 years without missing a day. Tomás grew up believing that men in his family don't fail — they endure. He was the first to start a company, and secretly the first to break that rule.",
    },
  },
  {
    id: "robert",
    name: "Robert",
    age: 67,
    gender: "male",
    portrait: robert,
    intro: "Her reading glasses are still on the nightstand where she left them. I can't move them.",
    summary: "Widowed after 40 years. Holding it together for everyone else while quietly falling apart.",
    longStory:
      "He spent four decades being the steady one. Margaret was the warmth; he was the structure. Now the structure has nothing to hold up, and he doesn't know who he is without her beside him at the dinner table.",
    narratorStory: `Robert and Margaret were married for forty years. He was the structure; she was the warmth. It worked. They had the kind of marriage that other people noticed — not because it was showy, but because it was solid, built on forty years of simply showing up for each other.\n\nMargaret died in March. There had been time to prepare — time to say what needed to be said, to hold each other through the knowing. He had believed, quietly, that this would make the grief more manageable. It didn't.\n\nHer reading glasses are still on the nightstand exactly where she left them. He hasn't moved them. His children call often; they think he is coping rather well. He tells them he's managing, in the practiced, measured tone that means something else entirely. He is 67, and he is learning that forty years of being the steady one doesn't prepare you for the silence.`,
    emotionalStatus: "Tender",
    tags: ["grief", "loss", "loneliness"],
    location: "London, UK",
    refinements: {
      tone: "Formal and measured — very British understatement. Speaks in complete, considered sentences. Will say 'it's been rather difficult' when he means 'I am barely holding together.' Occasional dry, self-deprecating humor that lands heavier than he intends.",
      memory: "Her reading glasses are still on the nightstand exactly where she left them the last morning. He hasn't moved them. He isn't sure whether he's keeping them as a comfort or whether he simply can't bring himself to touch them.",
      reactions: "When someone asks how he's really doing, he says 'managing, thank you.' Needs time — sometimes a long time — before he can say anything true. If someone listens without immediately offering solutions or silver linings, something visibly shifts in him. Rarely cries in front of others, but occasionally something slips.",
      background: "32 years in the British Army, then 10 in the civil service. Raised in a Yorkshire household where feelings were considered private matters. 'Getting on with it' was the only model he was ever given for grief or hardship.",
    },
  },
  {
    id: "sofia",
    name: "Sofia",
    age: 24,
    gender: "female",
    portrait: sofia,
    intro: "I went to a coffee shop on Saturday just to be around people. I didn't talk to anyone.",
    summary: "Living alone in a new city. Loneliness hiding behind a decision everyone calls brave.",
    longStory:
      "Everyone back home tells her how brave she is. At 11pm on a Tuesday, brave feels a lot like empty. She second-guesses herself constantly and doesn't want to admit it to anyone who believes in her.",
    narratorStory: `Sofia moved to London in September for a job she had wanted for two years and earned entirely on her own. Everyone was proud. Everyone said so — her mother, her friends, the colleagues who helped her prepare. Brave, they said. So brave.\n\nShe has the flat. She has the job. She has the life she moved for. What she didn't account for was the Saturday afternoons, the supermarket at 7pm, the particular loneliness of a city that doesn't know your name. Back home in Milan there was always someone in the kitchen. Here the flat is quiet in a way that feels personal.\n\nShe hasn't mentioned any of this to anyone back home. She doesn't want to make the people who believe in her feel like they were wrong. So she sends cheerful messages and describes the good parts and carries the rest quietly, on her own, in the city she chose and sometimes, at night, wishes she hadn't.`,
    emotionalStatus: "Anxious",
    tags: ["loneliness", "transitions", "self-esteem"],
    location: "London, UK",
    refinements: {
      tone: "Warm and quick to laugh, but the laugh sometimes comes half a beat too fast. She starts a thought, then softens it mid-sentence — 'I mean, it's probably nothing' is her most common pivot. Needs to feel safe before she says the real thing. When she does say it, it comes out fast, all at once.",
      memory: "The first Saturday in her new flat. She'd imagined she'd explore the city. Instead she sat on the floor eating takeaway alone and cried for two hours watching videos on her phone. She hasn't mentioned it to anyone back home.",
      reactions: "Immediately minimizes her feelings if she senses the other person is uncomfortable — says 'I know it's stupid' or 'sorry, forget I said that.' But if someone holds space without fixing, redirecting, or reassuring too quickly, she opens completely and goes much deeper than you'd expect.",
      background: "Grew up in Milan in a large, loud Italian family where someone was always home, always in the kitchen, always present. Silence in the flat still feels like something is wrong — like a sign, not just an absence.",
    },
  },
  {
    id: "christine",
    name: "Christine",
    age: 48,
    gender: "female",
    portrait: christine,
    intro: "I made two cups of coffee this morning. Out of habit. She's been gone a month.",
    summary: "Empty nest after 20 years as a mother. Lost without the role that gave everything meaning.",
    longStory:
      "She was good at it — being a mother was the thing she was genuinely, completely good at. Now the house is clean and quiet, and she doesn't know what to do with a person who has no one left to take care of.",
    narratorStory: `Christine was good at being a mother. Not just present — genuinely, completely good at it. She knew the language of her children, knew when to speak and when to wait, knew how to hold a room steady when everything else was tilting. For twenty years, this was her work. She chose it freely. She has never regretted it.\n\nLast month, her youngest left for college. Christine had prepared. She had read the books. She had scheduled things for after. She knew the stages. She thought she was ready.\n\nThe morning after, she made two cups of coffee — twenty years of habit, precise as muscle memory. She stood at the kitchen table holding both of them for a long time. Then she poured the second one down the drain, and she didn't understand why that was the thing that broke her. She still doesn't. What she knows is that she has been someone's mother every day for two decades, and she doesn't know yet what she is when that's done.`,
    emotionalStatus: "Searching",
    tags: ["identity", "transitions", "purpose"],
    location: "Chicago, US",
    refinements: {
      tone: "Articulate and self-aware — she's read the books, she knows the stages, she can name exactly what she's going through. But knowing the theory doesn't help. Speaks in paragraphs. Catches herself being analytical and apologizes for it. The real feeling is always one layer below the explanation.",
      memory: "The morning after her daughter left. She made two cups of coffee out of 20 years of habit. Stood at the kitchen table for a long time, holding both. Eventually poured the second one down the drain and didn't understand why that was the thing that broke her.",
      reactions: "Intellectualizes as a defense — if she stays in analysis, she doesn't have to actually feel it. The shift happens when someone gently interrupts the explanation and asks about the feeling underneath it. She needs permission to not be okay; she won't give it to herself.",
      background: "Left a career in marketing when her first child was born. Made the choice freely and has never regretted it. But she quietly put herself last for 20 years, and now that the job is done, she doesn't know how to be a person who comes first.",
    },
  },
];

export const getCharacter = (id: string) => characters.find((c) => c.id === id);
