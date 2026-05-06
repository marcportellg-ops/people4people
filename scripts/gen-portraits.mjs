// One-time script to generate portraits for characters that currently share one.
// Run with: node scripts/gen-portraits.mjs
// Requires VITE_LEONARDO_API_KEY in .env

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, "../.env"), "utf8");
const KEY = env.match(/VITE_LEONARDO_API_KEY=(.+)/)?.[1]?.trim();
if (!KEY) { console.error("VITE_LEONARDO_API_KEY not found in .env"); process.exit(1); }

const BASE = "https://cloud.leonardo.ai/api/rest/v1";
const headers = { authorization: `Bearer ${KEY}`, "content-type": "application/json" };

const characters = [
  {
    id: "tomas",
    prompt: "35 year old Spanish man, dark straight hair, light stubble beard, business casual appearance, olive skin, Mediterranean features, quietly composed expression, slight weight on his shoulders",
  },
  {
    id: "robert",
    prompt: "67 year old British man, silver-grey hair neatly combed, clean-shaven, formal dignified appearance, fair skin, Northern European features, weathered kind face, restrained composed expression",
  },
  {
    id: "sofia",
    prompt: "24 year old Italian woman, dark wavy hair, expressive warm eyes, olive skin, Mediterranean features, young professional appearance, smile just barely held back, slight vulnerability beneath",
  },
  {
    id: "christine",
    prompt: "48 year old American woman, shoulder-length brown hair with hints of grey, professional warm appearance, light skin, intelligent tired eyes, articulate poised expression",
  },
];

async function startGeneration(prompt) {
  const res = await fetch(`${BASE}/generations`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: `Photorealistic portrait photo. Person: ${prompt}. Bust shot, full head and upper chest, ears visible, wide framing. Dark textured background, warm Rembrandt lighting from upper left. Face turned 20 degrees, natural emotional expression. 8k, hyperrealistic, cinematic.`,
      modelId: "b2614463-296c-462a-9586-aafdb8f00e36",
      width: 512,
      height: 768,
      num_images: 1,
    }),
  });
  if (!res.ok) throw new Error(`Start error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.sdGenerationJob.generationId;
}

async function pollForUrl(generationId) {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`${BASE}/generations/${generationId}`, { headers });
    if (!res.ok) throw new Error(`Poll error ${res.status}`);
    const data = await res.json();
    const status = data.generations_by_pk?.status;
    if (status === "COMPLETE") return data.generations_by_pk.generated_images[0].url;
    if (status === "FAILED") throw new Error("Generation failed");
    process.stdout.write(".");
  }
  throw new Error("Timed out");
}

async function downloadImage(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download error ${res.status}`);
  const buf = await res.arrayBuffer();
  writeFileSync(dest, Buffer.from(buf));
}

for (const { id, prompt } of characters) {
  const dest = resolve(__dirname, `../src/assets/${id}.jpg`);
  console.log(`\nGenerating ${id}...`);
  const genId = await startGeneration(prompt);
  const url = await pollForUrl(genId);
  await downloadImage(url, dest);
  console.log(` saved → src/assets/${id}.jpg`);
}

console.log("\nAll done.");
