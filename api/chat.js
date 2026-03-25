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

  return "en";
}

function detectUserLanguageFromMessage(message, fallback) {
  const m = (message || "").trim().toLowerCase();

  if (!m) return normalizeLang(fallback || "en");

  if (/[čćžšđ]/.test(m)) return "hr";
  if (/[äöüß]/.test(m)) return "de";

  if (/\b(kako|što|sta|koliko|gdje|može|mozes|trebam|želim|zelim|cijena|kontakt|usluga|pomoc)\b/.test(m)) {
    return "hr";
  }

  if (/\b(wie|was|preis|hilfe|kontakt|danke|bitte|ich|möchte|mochte|service)\b/.test(m)) {
    return "de";
  }

  if (/\b(how|what|price|contact|help|thanks|please|i|want|service)\b/.test(m)) {
    return "en";
  }

  return normalizeLang(fallback || "en");
}

function trimText(text, maxLength) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function buildLanguageInstruction(lang) {
  if (lang === "hr") {
    return "Odgovaraj isključivo na hrvatskom jeziku.";
  }

  if (lang === "de") {
    return "Antworte ausschließlich auf Deutsch.";
  }

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
  if (!Array.isArray(allowedDomains) || !allowedDomains.length) return true;

  return allowedDomains.some(function (domain) {
    const d = String(domain).toLowerCase();
    return hostname === d || hostname.endsWith("." + d);
  });
}

function extractTextFromResponse(response) {
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
      if (part && part.type === "output_text" && part.text) {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function getFallbackAnswer(lang) {
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

    const userLang = normalizeLang(
      body.userLang || detectUserLanguageFromMessage(message, safePageContext.lang)
    );

    const hostname = getHostname(safePageContext.pageUrl);

    if (!isAllowedDomain(hostname, agent.allowedDomains)) {
      return res.status(403).json({
        error: "Domain not allowed"
      });
    }

    const languageInstruction = buildLanguageInstruction(userLang);

    const systemPrompt = `
Ti si ${agent.agentName || "SiteMind AI"}.

PRAVILA:
- odgovaraj kratko, jasno i korisno
- prvo koristi sadržaj stranice iz konteksta
- ako sadržaj stranice nije dovoljan, a dopušten je web search, smiješ potražiti dodatne informacije na webu
- ne izmišljaj cijene, uvjete, kontakte ili obećanja ako to nije potvrđeno
- ako ni tada nisi siguran, reci to jasno
- odgovaraj na jeziku korisnikova pitanja

${languageInstruction}
${trimText(agent.systemPrompt || "", 500)}
`.trim();

    const pageContextPrompt = `
NASLOV: ${safePageContext.pageTitle || "-"}
OPIS: ${safePageContext.pageDescription || "-"}
URL: ${safePageContext.pageUrl || "-"}
SADRŽAJ STRANICE: ${safePageContext.pageText || "-"}
`.trim();

    const requestBody = {
      model: "gpt-5-mini",
      reasoning: { effort: "minimal" },
      max_output_tokens: 180,
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
    };

    if (agent.allowExternalSearch) {
      requestBody.tools = [
        {
          type: "web_search_preview",
          search_context_size: "medium"
        }
      ];

      requestBody.include = ["web_search_call.action.sources"];
    }

    const response = await openai.responses.create(requestBody);
    const answer = extractTextFromResponse(response) || getFallbackAnswer(userLang);

    return res.status(200).json({
      answer,
      usedWebSearch: !!agent.allowExternalSearch,
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
