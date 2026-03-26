import OpenAI from "openai";
import { getAgentById } from "../lib/agents.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function cleanText(value, max = 1000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .map((item) => ({
      role: item && item.role === "assistant" ? "assistant" : "user",
      content: cleanText(item && item.content, 1200)
    }))
    .filter((item) => item.content)
    .slice(-12);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      message,
      agentId,
      history,
      pageContext,
      pageTitle,
      pageDescription,
      pageUrl
    } = req.body || {};

    const userMessage = cleanText(message, 800);

    if (!userMessage) {
      return res.status(400).json({ error: "Missing message" });
    }

    const agent = getAgentById(agentId || "demo-agent");
    const safeHistory = normalizeHistory(history);

    const safePageTitle = cleanText(pageTitle, 200);
    const safePageDescription = cleanText(pageDescription, 400);
    const safePageUrl = cleanText(pageUrl, 300);
    const safePageContext = cleanText(pageContext, 3500);

    const pageInfoBlock = `
PODACI O STRANICI:
- URL: ${safePageUrl || "Nije dostupno"}
- Naslov: ${safePageTitle || "Nije dostupno"}
- Opis: ${safePageDescription || "Nije dostupno"}

SADRŽAJ STRANICE:
${safePageContext || "Sadržaj stranice nije dostupan."}
    `.trim();

    const systemPrompt = `
${agent.systemPrompt || ""}

DODATNA PRAVILA:
- Ako korisnik pita nešto o ovoj stranici, proizvodu, usluzi ili sadržaju stranice, koristi prvenstveno podatke iz bloka "PODACI O STRANICI" i "SADRŽAJ STRANICE".
- Ako odgovor nije jasno vidljiv iz sadržaja stranice, reci to iskreno.
- Ne izmišljaj funkcije, cijene, uvjete, kontakte ili tehničke mogućnosti.
- Ako korisnik postavi opće tehničko pitanje koje nije direktno vezano za stranicu, pomozi kratko i jasno.
- Uzmi u obzir prethodne poruke iz razgovora i ponašaj se kao da je razgovor kontinuiran.
- Ako korisnik napiše kratko "ok", "u redu", "može", "nastavi", odgovori u skladu s prethodnim kontekstom.
- Odgovaraj kratko, jasno i korisno.
- Idealna dužina odgovora je do 160 riječi, osim ako je za tehničko objašnjenje potrebno malo više.

${pageInfoBlock}
    `.trim();

    const messages = [
      { role: "system", content: systemPrompt },
      ...safeHistory,
      { role: "user", content: userMessage }
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages,
      temperature: 0.4
    });

    const answer =
      completion.choices?.[0]?.message?.content?.trim() || "Trenutno nemam odgovor.";

    return res.status(200).json({
      answer
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: String(error?.message || error)
    });
  }
}
