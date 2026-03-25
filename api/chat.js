import OpenAI from "openai";
import { getAgentById } from "../lib/agents.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function normalizeLang(lang) {
  const raw = (lang || "").toLowerCase();

  if (raw.startsWith("hr") || raw.startsWith("bs") || raw.startsWith("sr")) {
    return "hr";
  }

  if (raw.startsWith("de")) {
    return "de";
  }

  return "en";
}

function trimText(text, maxLength) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function buildLanguageInstruction(lang) {
  if (lang === "hr") return "Odgovaraj isključivo na hrvatskom jeziku.";
  if (lang === "de") return "Antworte ausschließlich auf Deutsch.";
  return "Respond only in English.";
}

function extractAnswerText(response) {
  if (response && response.output_text && String(response.output_text).trim()) {
    return String(response.output_text).trim();
  }

  if (!response || !Array.isArray(response.output)) {
    return "";
  }

  const chunks = [];

  for (const item of response.output) {
    if (!item || item.type !== "message" || !Array.isArray(item.content)) continue;

    for (const part of item.content) {
      if (part && typeof part.text === "string" && part.text.trim()) {
        chunks.push(part.text.trim());
      }
    }
  }

  return chunks.join("\n").trim();
}

function fallbackAnswer(lang, pageContext) {
  if (lang === "hr") {
    if (pageContext.pageTitle) {
      return "Vidim stranicu: " + pageContext.pageTitle + ". Pokušajte postaviti konkretnije pitanje o sadržaju ove stranice.";
    }
    return "Pokušajte postaviti konkretnije pitanje o sadržaju ove stranice.";
  }

  if (lang === "de") {
    if (pageContext.pageTitle) {
      return "Ich sehe die Seite: " + pageContext.pageTitle + ". Bitte stellen Sie eine konkretere Frage zum Inhalt dieser Seite.";
    }
    return "Bitte stellen Sie eine konkretere Frage zum Inhalt dieser Seite.";
  }

  if (pageContext.pageTitle) {
    return "I can see the page: " + pageContext.pageTitle + ". Please ask a more specific question about this page.";
  }

  return "Please ask a more specific question about this page.";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const body = req.body || {};
    const message = trimText(body.message || "", 500);
    const agentId = body.agentId || "demo-agent";
    const userLang = normalizeLang(body.userLang || "en");
    const rawPageContext = body.pageContext || {};
    const agent = getAgentById(agentId);

    if (!message) {
      return res.status(400).json({
        error: "Missing message"
      });
    }

    const safePageContext = {
      pageUrl: rawPageContext.pageUrl || "",
      pageTitle: trimText(rawPageContext.pageTitle || "", 160),
      pageDescription: trimText(rawPageContext.pageDescription || "", 240),
      pageText: trimText(rawPageContext.pageText || "", 1500),
      lang: normalizeLang(rawPageContext.lang || "en")
    };

    const systemPrompt = `
Ti si ${agent.agentName || "SiteMind AI"}.

PRAVILA:
- odgovaraj kratko, jasno i korisno
- koristi informacije iz sadržaja stranice kada su dostupne
- ne izmišljaj podatke koji nisu vidljivi iz konteksta
- ako nešto nije jasno iz stranice, to iskreno reci
- odgovaraj na jeziku korisnikova pitanja

${buildLanguageInstruction(userLang)}
${trimText(agent.systemPrompt || "", 500)}
`.trim();

    const userPrompt = `
PITANJE KORISNIKA:
${message}

KONTEKST STRANICE:
Naslov: ${safePageContext.pageTitle || "-"}
Opis: ${safePageContext.pageDescription || "-"}
URL: ${safePageContext.pageUrl || "-"}
Tekst stranice: ${safePageContext.pageText || "-"}
`.trim();

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      max_output_tokens: 220,
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ]
    });

    const answer = extractAnswerText(response) || fallbackAnswer(userLang, safePageContext);

    return res.status(200).json({
      answer,
      debug: {
        pageTitle: safePageContext.pageTitle,
        pageTextLength: safePageContext.pageText.length,
        lang: userLang
      },
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
