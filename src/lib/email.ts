import emailjs from "@emailjs/browser";

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  as string | undefined;

export async function sendDeliveryEmail(params: {
  toEmail: string;
  characterName: string;
  summary: string;
  highlight: string;
  recommendations: string[];
}): Promise<void> {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.info("[email] EmailJS not configured — delivery email skipped");
    return;
  }

  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_email:        params.toEmail,
      character_name:  params.characterName,
      summary:         params.summary,
      highlight:       params.highlight,
      recommendations: params.recommendations.map((r) => `• ${r}`).join("\n"),
    },
    PUBLIC_KEY,
  );
}
