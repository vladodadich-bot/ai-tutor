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

  if (
    /\b(kako|sto|što|sta|šta|koliko|gdje|gde|moze|može|trebam|zelim|želim|cijena|kontakt|usluga|pomoc|pomoć|stranica|stranici|ovoj|cemu|čemu|radi|ucenje|učenje|njemacki|njemački|lekcije|tečaj|tecaj)\b/.test(m)
  ) {
    return "hr";
  }

  if (
    /\b(wie|was|worum|seite|inhalt|hilfe|kontakt|preis|deutsch|lektion|lektionen|lernen|kurs|ich|möchte|mochte|bitte|danke)\b/.test(m)
  ) {
    return "de";
  }

  if (
    /\b(how|what|about|page|content|help|contact|price|course|lesson|lessons|learn|learning|german|service)\b/.test(m)
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
  const cleaned = trimText(text || "", 400);
  if (!cleaned) return "";

  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 0) {
    return trimText(sentences[0], 220);
  }

  return trimText(cleaned, 220);
}

function buildContextualFallback(lang, pageContext) {
  const title = trimText(pageContext.pageTitle || "", 160);
  const desc = trimText(pageContext.pageDescription || "", 220);
  const snippet = firstUsefulSnippet(pageContext.pageText || "");

  if (lang === "hr") {
    if (title || desc || snippet) {
      let out = "Ova stranica ";
      if (title) {
        out += "se odnosi na: " + title + ". ";
      }
      if (desc) {
        out += desc + " ";
      }
      if (snippet) {
        out += "Iz sadržaja se vidi: " + snippet;
      }
      return out.trim();
    }
    return "Vidim ovu stranicu, ali nemam dovoljno jasnog sadržaja za bolji sažetak. Postavite pitanje malo konkretnije.";
  }

  if (lang === "de") {
    if (title || desc || snippet) {
      let out = "Diese Seite ";
      if (title) {
        out += "handelt wahrscheinlich von: " + title + ". ";
      }
      if (desc) {
        out += desc + " ";
      }
      if (snippet) {
        out += "Aus dem Inhalt ist erkennbar: " + snippet;
      }
      return out.trim();
    }
    return "Ich sehe diese Seite, aber ich habe nicht genug klaren Inhalt für eine bessere Zusammenfassung. Bitte stellen Sie eine etwas konkretere Frage.";
  }

  if (title || desc || snippet) {
    let out = "This page appears to be about ";
    if (title) {
      out += title + ". ";
    }
    if (desc) {
      out += desc + " ";
    }
    if (snippet) {
      out += "From the content, it seems: " + snippet;
    }
    return out.trim();
  }

  return "I can see this page, but I do not have enough clear content for a better summary. Please ask a slightly more specific question.";
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
      pageDescription: trimText(rawPageContext.pageDescription || "", 300),
      pageText: trimText(rawPageContext.pageText || "", 2600),
      lang: normalizeLang(rawPageContext.lang || "en")
    };

    const userLang = normalizeLang(
      body.userLang || detectUserLanguageFromMessage(message, safePageContext.lang)
    );

    const systemPrompt = `
Ti si ${agent.agentName || "SiteMind AI"}, AI asistent ugrađen na web stranicu.

PRAVILA:
- odgovaraj prirodno, jasno i korisno
- koristi sadržaj stranice kao glavni izvor
- smiješ zaključivati iz konteksta stranice, ne samo tražiti doslovne rečenice
- ako korisnik pita općenito, npr. "o čemu se radi", "što je ovo", "what is this page about", "worum geht es", sažmi temu stranice
- ako pitanje nije potpuno precizno, ipak pokušaj pomoći na temelju naslova, opisa i teksta stranice
- nemoj izmišljati konkretne podatke kao cijene, telefoni, e-mailovi, rokovi ili uvjeti ako nisu jasno vidljivi
- ako nešto nije jasno, reci to iskreno, ali svejedno pokušaj dati koristan sažetak ili objašnjenje
- odgovaraj na jeziku korisnikova pitanja

${buildLanguageInstruction(userLang)}
${trimText(agent.systemPrompt || "", 700)}
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
      max_output_tokens: 320,
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
