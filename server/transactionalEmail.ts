export type DeliveryResult = { mode: "sent" | "preview" | "configuration_required"; previewUrl?: string };

export async function deliverAccountLink(input: { to: string; subject: string; heading: string; description: string; link: string }): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (apiKey && from) {
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: `<main style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1>${input.heading}</h1><p>${input.description}</p><p><a href="${input.link}">Continue securely</a></p><p>This link expires automatically and can be used once.</p></main>` }) });
    if (!response.ok) throw new Error("Email delivery could not be completed. Please try again later.");
    return { mode: "sent" };
  }
  return process.env.NODE_ENV === "production" ? { mode: "configuration_required" } : { mode: "preview", previewUrl: input.link };
}
