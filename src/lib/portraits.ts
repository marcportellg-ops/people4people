const LEONARDO_KEY = import.meta.env.VITE_LEONARDO_API_KEY;
const BASE = "https://cloud.leonardo.ai/api/rest/v1";

const headers = {
  "authorization": `Bearer ${LEONARDO_KEY}`,
  "content-type": "application/json",
};

async function startGeneration(prompt: string): Promise<string> {
  const res = await fetch(`${BASE}/generations`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt,
      modelId: "1dd50843-d653-4516-a8e3-f0238ee453ff", // Flux Schnell — fast
      width: 512,
      height: 768,
      num_images: 4,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Leonardo error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.sdGenerationJob.generationId;
}

async function pollForImages(generationId: string): Promise<string[]> {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch(`${BASE}/generations/${generationId}`, { headers });
    if (!res.ok) throw new Error(`Poll error ${res.status}`);

    const data = await res.json();
    const status = data.generations_by_pk?.status;

    if (status === "COMPLETE") {
      return data.generations_by_pk.generated_images.map((img: any) => img.url);
    }
    if (status === "FAILED") {
      throw new Error("Leonardo generation failed");
    }
  }

  throw new Error("Portrait generation timed out — please try again");
}

export async function generatePortraits(
  personDescription: string,
  age: number,
): Promise<string[]> {
  const prompt = [
    `Photorealistic portrait photo`,
    `Person: ${personDescription}, ${age} years old`,
    `Bust shot, full head and upper chest visible, ears fully showing, wide framing`,
    `Dark textured background, warm Rembrandt lighting from upper left`,
    `Face turned slightly, natural emotional expression`,
    `8k, hyperrealistic, cinematic`,
  ].join(". ");

  const generationId = await startGeneration(prompt);
  return pollForImages(generationId);
}
