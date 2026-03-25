import OpenAI from "openai";
import { getAgentById } from "../lib/agents.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function normalizeLang(lang) {
  const raw = (lang || "").toLowerCase();

  if (
    raw.startsWith("hr") ||
    raw.startsWith("bs") ||
    raw.startsWith("sr")
  ) {
    return "hr";
  }

  if (raw.startsWith("de")) {
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

  if (/\b(how|what|price|contact|help|thanks|please|service)\b/.test(m)) {
    return "en";
  }

  return normalizeLang(fallback || "en");
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
  if (!Array.isArray(allowedDomains) || allowedDomains.length === 0) return true;

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

function shouldForceWebSearch(pageContext, message) {
  const pageText = trimText(pageContext.pageText || "", 2000);
  const q = (message || "").toLowerCase();

  if (!pageText || pageText.length < 120) {
    return true;
  }

  if (/today|latest|news|vrijeme|weather|stock|price today|heute|aktuell/.test(q)) {
    return true;
  }

  return false;
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
      pageText: trimText(rawPageContext.pageText || "", 1200),
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

    const systemPrompt = `
Ti si ${agent.agentName || "SiteMind AI"}.

PRAVILA:
- odgovaraj kratko, jasno i korisno
- prvo koristi sadržaj stranice iz konteksta
- ako sadržaj stranice nije dovoljan i web search je dopušten, koristi web search
- ne izmišljaj cijene, uvjete, kontakte ili obećanja ako nisu potvrđeni
- ako nisi siguran, reci to jasno
- odgovaraj na jeziku korisnikova pitanja

${buildLanguageInstruction(userLang)}
${trimText(agent.systemPrompt || "", 400)}
`.trim();

    const contextPrompt = `
NASLOV STRANICE: ${safePageContext.pageTitle || "-"}
OPIS STRANICE: ${safePageContext.pageDescription || "-"}
URL STRANICE: ${safePageContext.pageUrl || "-"}
SADRŽAJ STRANICE: ${safePageContext.pageText || "-"}
`.trim();

    const requestBody = {
      model: "gpt-5-mini",
      max_output_tokens: 180,
      reasoning: { effort: "minimal" },
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
    };

    if (agent.allowExternalSearch) {
      requestBody.tools = [{ type: "web_search" }];

      if (shouldForceWebSearch(safePageContext, message)) {
        requestBody.tool_choice = "required";
      }
    }

    const response = await openai.responses.create(requestBody);

    const answer =
      response.output_text && response.output_text.trim()
        ? response.output_text.trim()
        : fallbackAnswer(userLang);

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
