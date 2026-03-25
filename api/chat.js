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
  if (lang === "hr") return "Odgovaraj isključivo na hrvatskom jeziku.";
  if (lang === "de") return "Antworte ausschließlich auf Deutsch.";
  return "Respond only in English.";
}

function getHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (e) {
    return "";
  }
}

function isAllowedDomain(hostname, allowedDomains) {
  if (!hostname) return false;

  if (!Array.isArray(allowedDomains) || allowedDomains.length === 0) {
    return true;
  }

  return allowedDomains.some((domain) => {
    const d = String(domain).toLowerCase();
    return hostname === d || hostname.endsWith("." + d);
  });
}

function fallbackAnswer(lang) {
  if (lang === "hr") {
    return "Trenutno nemam dovoljno informacija za siguran odgovor.";
  }

  if (lang === "de") {
    return "Im Moment habe ich nicht genug Informationen für eine sichere Antwort.";
  }

  return "I do not have enough information for a reliable answer right now.";
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
      pageTitle: trimText(rawPageContext.pageTitle || "", 140),
      pageDescription: trimText(rawPageContext.pageDescription || "", 220),
      pageText: trimText(rawPageContext.pageText || "", 900),
      lang: normalizeLang(rawPageContext.lang || "en")
    };

    const hostname = getHostname(safePageContext.pageUrl);

    if (!isAllowedDomain(hostname, agent.allowedDomains)) {
      return res.status(403).json({
        error: "Domain not allowed"
      });
    }

    const languageInstruction = buildLanguageInstruction(userLang);

    const systemPrompt = `
Ti si ${agent.agentName || "SiteMind AI"}.
Odgovaraj kratko, jasno i korisno.
Prvo koristi sadržaj stranice.
Ne izmišljaj specifične podatke koji nisu na stranici.
Ako odgovor nije jasno vidljiv na stranici, reci to iskreno i pomozi općenitim savjetom.
${languageInstruction}
`.trim();

    const contextPrompt = `
NASLOV: ${safePageContext.pageTitle || "-"}
OPIS: ${safePageContext.pageDescription || "-"}
URL: ${safePageContext.pageUrl || "-"}
SADRŽAJ: ${safePageContext.pageText || "-"}
`.trim();

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      max_output_tokens: 140,
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "developer",
          content: contextPrompt
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
        : fallbackAnswer(userLang);

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
