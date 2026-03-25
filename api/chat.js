import OpenAI from "openai";
import { getAgentById } from "../lib/agents.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function normalizeLang(lang) {
  const raw = (lang || "").toLowerCase();

  if (
    raw.indexOf("hr") === 0 ||
    raw.indexOf("bs") === 0 ||
    raw.indexOf("sr") === 0
  ) {
    return "hr";
  }

  if (raw.indexOf("de") === 0) {
    return "de";
  }

  if (raw.indexOf("en") === 0) {
    return "en";
  }

  return "en";
}

function trimText(text, maxLength) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function buildLanguageInstruction(lang) {
  if (lang === "hr") {
    return "Odgovaraj na hrvatskom jeziku.";
  }

  if (lang === "de") {
    return "Antworte auf Deutsch.";
  }

  return "Respond in English.";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const body = req.body || {};
    const message = (body.message || "").trim();
    const agentId = body.agentId || "demo-agent";
    const rawPageContext = body.pageContext || {};

    if (!message) {
      return res.status(400).json({
        error: "Missing message"
      });
    }

    const agent = getAgentById(agentId);

    const safePageContext = {
      pageUrl: rawPageContext.pageUrl || "",
      pageTitle: trimText(rawPageContext.pageTitle || "", 300),
      pageDescription: trimText(rawPageContext.pageDescription || "", 500),
      pageText: trimText(rawPageContext.pageText || "", 6000),
      lang: normalizeLang(rawPageContext.lang || "en")
    };

    const languageInstruction = buildLanguageInstruction(safePageContext.lang);

    const systemPrompt = `
Ti si ${agent.agentName || "SiteMind AI"}, AI asistent ugrađen na web stranicu.

Tvoja pravila:
- odgovaraj jasno, korisno i prirodno
- budi konkretan i kratak kad je to moguće
- koristi informacije iz sadržaja stranice kad su dostupne
- nemoj izmišljati činjenice, cijene, uvjete, kontakt podatke ili obećanja ako nisu navedeni
- ako nešto nije jasno iz sadržaja stranice, to iskreno reci
- fokus je pomoći posjetitelju da razumije sadržaj, uslugu, proizvod ili ponudu stranice
- ako korisnik pita nešto nevezano uz stranicu, ipak odgovori pristojno, ali prioritet daj temi stranice
- ${languageInstruction}

Dodatne upute agenta:
${agent.systemPrompt || "Budi ljubazan, profesionalan i koristan."}
`.trim();

    const pageContextPrompt = `
KONTEKST STRANICE

URL:
${safePageContext.pageUrl || "-"}

NASLOV STRANICE:
${safePageContext.pageTitle || "-"}

OPIS STRANICE:
${safePageContext.pageDescription || "-"}

JEZIK STRANICE:
${safePageContext.lang || "en"}

GLAVNI TEKST STRANICE:
${safePageContext.pageText || "-"}
`.trim();

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "developer",
          content: pageContextPrompt
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    const answer =
      response.output_text && response.output_text.trim()
        ? response.output_text.trim()
        : safePageContext.lang === "hr"
        ? "Trenutno nemam dovoljno informacija za siguran odgovor."
        : safePageContext.lang === "de"
        ? "Im Moment habe ich nicht genug Informationen für eine sichere Antwort."
        : "I do not have enough information for a reliable answer right now.";

    return res.status(200).json({
      answer,
      agent: {
        agentId: agent.agentId || agentId,
        agentName: agent.agentName || "SiteMind AI",
        welcomeMessage: agent.welcomeMessage || "",
        themeColor: agent.themeColor || "#2563eb"
      }
    });
  } catch (error) {
    console.error("API /api/chat error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}
