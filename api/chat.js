import OpenAI from "openai";
import { getAgentById } from "../lib/agents.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const memoryCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 10;

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

function trimText(text, maxLength) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function buildLanguageInstruction(lang) {
  if (lang === "hr") return "Odgovaraj na hrvatskom.";
  if (lang === "de") return "Antworte auf Deutsch.";
  return "Respond in English.";
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

function getCacheKey(agentId, message, pageContext) {
  return [
    agentId || "",
    (message || "").toLowerCase().trim(),
    pageContext.pageTitle || "",
    pageContext.pageUrl || "",
    pageContext.lang || ""
  ].join("||");
}

function getFromCache(key) {
  const cached = memoryCache.get(key);
  if (!cached) return null;

  if (Date.now() > cached.expiresAt) {
    memoryCache.delete(key);
    return null;
  }

  return cached.value;
}

function setCache(key, value) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

function getFastFaqAnswer(message, lang, pageContext) {
  const q = (message || "").toLowerCase();

  if (/cijena|price|preis|koliko košta|cost/.test(q)) {
    if (pageContext.pageText && /€|eur|usd|price|cijena|preis/i.test(pageContext.pageText)) {
      return null;
    }

    if (lang === "hr") {
      return "Ne vidim jasnu cijenu u sadržaju ove stranice. Mogu pomoći sažeti što se ovdje nudi ako želite.";
    }

    if (lang === "de") {
      return "Ich sehe auf dieser Seite keinen klaren Preis. Ich kann aber kurz zusammenfassen, was hier angeboten wird.";
    }

    return "I cannot see a clear price on this page. I can briefly summarize what is being offered here.";
  }

  if (/kontakt|contact|telefon|email|e-mail/.test(q)) {
    const match = (pageContext.pageText || "").match(
      /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i
    );

    if (match) {
      if (lang === "hr") return "Na stranici vidim kontakt e-mail: " + match[1];
      if (lang === "de") return "Auf der Seite sehe ich diese Kontakt-E-Mail: " + match[1];
      return "I can see this contact email on the page: " + match[1];
    }
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const message = trimText(body.message || "", 500);
    const agentId = body.agentId || "demo-agent";
    const rawPageContext = body.pageContext || {};
    const agent = getAgentById(agentId);

    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    const safePageContext = {
      pageUrl: rawPageContext.pageUrl || "",
      pageTitle: trimText(rawPageContext.pageTitle || "", 180),
      pageDescription: trimText(rawPageContext.pageDescription || "", 260),
      pageText: trimText(rawPageContext.pageText || "", 1800),
      lang: normalizeLang(rawPageContext.lang || "en")
    };

    const hostname = getHostname(safePageContext.pageUrl);

    if (!isAllowedDomain(hostname, agent.allowedDomains)) {
      return res.status(403).json({
        error: "Domain not allowed"
      });
    }

    const faqAnswer = getFastFaqAnswer(message, safePageContext.lang, safePageContext);
    if (faqAnswer) {
      return res.status(200).json({
        answer: faqAnswer,
        cached: false,
        fastPath: true,
        agent: {
          agentId: agent.agentId || agentId,
          agentName: agent.agentName || "SiteMind AI",
          welcomeMessage: agent.welcomeMessage || "",
          themeColor: agent.themeColor || "#2563eb"
        }
      });
    }

    const cacheKey = getCacheKey(agentId, message, safePageContext);
    const cachedAnswer = getFromCache(cacheKey);

    if (cachedAnswer) {
      return res.status(200).json({
        answer: cachedAnswer,
        cached: true,
        agent: {
          agentId: agent.agentId || agentId,
          agentName: agent.agentName || "SiteMind AI",
          welcomeMessage: agent.welcomeMessage || "",
          themeColor: agent.themeColor || "#2563eb"
        }
      });
    }

    const languageInstruction = buildLanguageInstruction(safePageContext.lang);

    const systemPrompt = `
Ti si ${agent.agentName || "SiteMind AI"}.
Odgovaraj kratko, jasno i korisno.
Koristi sadržaj stranice.
Ne izmišljaj podatke.
Ako nešto nije jasno, reci to iskreno.
${languageInstruction}
${trimText(agent.systemPrompt || "", 500)}
`.trim();

    const pageContextPrompt = `
NASLOV: ${safePageContext.pageTitle || "-"}
OPIS: ${safePageContext.pageDescription || "-"}
URL: ${safePageContext.pageUrl || "-"}
SADRŽAJ: ${safePageContext.pageText || "-"}
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
          role: "developer",
          content: pageContextPrompt
        },
        {
          role: "user",
          content: message
        }
      ]
    });
function detectUserLanguage(message, fallback) {
  const m = (message || "").toLowerCase();

  if (/[čćžšđ]/.test(m)) return "hr";
  if (/[äöüß]/.test(m)) return "de";

  if (/\b(der|die|das|und|ist|nicht|ich)\b/.test(m)) return "de";
  if (/\b(the|and|what|how|is|are)\b/.test(m)) return "en";

  return fallback || "en";
}
    const answer =
      response.output_text && response.output_text.trim()
        ? response.output_text.trim()
        : safePageContext.lang === "hr"
        ? "Trenutno nemam dovoljno informacija za siguran odgovor."
        : safePageContext.lang === "de"
        ? "Im Moment habe ich nicht genug Informationen für eine sichere Antwort."
        : "I do not have enough information for a reliable answer right now.";

    setCache(cacheKey, answer);

    return res.status(200).json({
      answer,
      cached: false,
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
