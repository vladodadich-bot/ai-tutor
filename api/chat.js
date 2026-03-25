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

function detectUserLanguageFromMessage(message, fallback) {
  const m = (message || "").trim().toLowerCase();

  if (!m) return normalizeLang(fallback || "en");

  if (/[čćžšđ]/.test(m)) return "hr";
  if (/[äöüß]/.test(m)) return "de";

  if (
    /\b(kako|sto|što|sta|šta|koliko|gdje|gde|moze|može|trebam|zelim|želim|cijena|kontakt|usluga|pomoc|pomoć|stranica|stranici|ovoj|cemu|čemu|radi|ucenje|učenje|njemacki|njemački|lekcije|tecaj|tečaj|prodaja|prodaje|nudi|nudi li)\b/.test(m)
  ) {
    return "hr";
  }

  if (
    /\b(wie|was|worum|seite|inhalt|hilfe|kontakt|preis|deutsch|lektion|lektionen|lernen|kurs|ich|möchte|mochte|bitte|danke|verkauf|verkauft|bietet)\b/.test(m)
  ) {
    return "de";
  }

  if (
    /\b(how|what|about|page|content|help|contact|price|course|lesson|lessons|learn|learning|german|service|sell|selling|offer|offers)\b/.test(m)
  ) {
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

function firstUsefulSnippet(text) {
  const cleaned = trimText(text || "", 500);
  if (!cleaned) return "";

  const parts = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length > 0) {
    return trimText(parts[0], 220);
  }

  return trimText(cleaned, 220);
}

function buildContextualFallback(lang, pageContext) {
  const title = trimText(pageContext.pageTitle || "", 180);
  const desc = trimText(pageContext.pageDescription || "", 260);
  const snippet = firstUsefulSnippet(pageContext.pageText || "");

  if (lang === "hr") {
    let out = "Iz ove stranice ";
    if (title) {
      out += "se vidi tema: " + title + ". ";
    }
    if (desc) {
      out += desc + " ";
    }
    if (snippet) {
      out += "Sadržaj upućuje na: " + snippet;
    }
    return out.trim();
  }

  if (lang === "de") {
    let out = "Aus dieser Seite ";
    if (title) {
      out += "ist das Thema erkennbar: " + title + ". ";
    }
    if (desc) {
      out += desc + " ";
    }
    if (snippet) {
      out += "Der Inhalt deutet darauf hin: " + snippet;
    }
    return out.trim();
  }

  let out = "From this page ";
  if (title) {
    out += "the topic appears to be: " + title + ". ";
  }
  if (desc) {
    out += desc + " ";
  }
  if (snippet) {
    out += "The content suggests: " + snippet;
  }
  return out.trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const body = req.body || {};
    const message = trimText(body.message || "", 700);
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
      pageTitle: trimText(rawPageContext.pageTitle || "", 180),
      pageDescription: trimText(rawPageContext.pageDescription || "", 320),
      pageText: trimText(rawPageContext.pageText || "", 3200),
      lang: normalizeLang(rawPageContext.lang || "en")
    };

    const userLang = normalizeLang(
      body.userLang || detectUserLanguageFromMessage(message, safePageContext.lang)
    );

    const systemPrompt = `
Ti si ${agent.agentName || "SiteMind AI"}, inteligentni AI asistent ugrađen na web stranicu.

TVOJ POSAO:
- razumjeti o čemu je stranica
- procijeniti što stranica nudi, kome je namijenjena i koja joj je svrha
- odgovarati ne samo doslovno, nego i zaključivati iz konteksta

VAŽNA PRAVILA:
- koristi naslov, opis i tekst stranice kao glavni izvor
- smiješ razumno zaključivati iz sadržaja stranice
- ako korisnik pita nešto poput:
  - da li stranica nešto prodaje
  - nudi li uslugu
  - je li edukativna
  - je li blog
  - kome je namijenjena
  - što je cilj stranice
  - radi li se o proizvodu, usluzi, sadržaju ili informativnoj stranici
  tada nemoj samo ponoviti sadržaj stranice, nego daj procjenu i kratko objašnjenje

KAKO ODGOVARATI:
- ako možeš zaključiti odgovor iz konteksta, odgovori jasno
- koristi formulacije poput:
  - "Izgleda da..."
  - "Ova stranica vjerojatno..."
  - "Ne djeluje kao..."
  - "Više izgleda kao..."
  - "Prema sadržaju, ova stranica..."
- kod pitanja tipa da/ne:
  - prvo daj jasan odgovor
  - zatim u jednoj ili dvije rečenice objasni zašto
- nemoj stalno samo tražiti konkretnije pitanje
- nemoj izmišljati konkretne podatke kao cijene, telefone, mailove, rokove, uvjete ili garancije ako nisu jasno vidljivi
- ako nešto stvarno nije jasno, reci to iskreno, ali svejedno pokušaj dati najbolju procjenu iz konteksta
- odgovaraj prirodno i korisno, kao pametan prodajni i web asistent, ne kao robot

${buildLanguageInstruction(userLang)}
${trimText(agent.systemPrompt || "", 900)}
`.trim();

    const userPrompt = `
PITANJE KORISNIKA:
${message}

KONTEKST STRANICE:
Naslov: ${safePageContext.pageTitle || "-"}
Opis: ${safePageContext.pageDescription || "-"}
URL: ${safePageContext.pageUrl || "-"}
Tekst stranice:
${safePageContext.pageText || "-"}
`.trim();

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      max_output_tokens: 360,
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

    const answer =
      extractAnswerText(response) || buildContextualFallback(userLang, safePageContext);

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
