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
    /\b(kako|sto|što|sta|šta|koliko|gdje|gde|moze|može|trebam|zelim|želim|htjeo|hteo|želio|ugraditi|staviti|widget|pomozi|pomoc|pomoć|stranica|stranicu|mogu li|mozes li|možeš li|builder|postavim|postaviti)\b/.test(m)
  ) {
    return "hr";
  }

  if (
    /\b(wie|was|hilfe|helfen|einbauen|widget|seite|ich|möchte|mochte|bitte|danke|kannst|builder)\b/.test(m)
  ) {
    return "de";
  }

  if (
    /\b(how|what|help|embed|widget|website|site|install|add|setup|builder|can you)\b/.test(m)
  ) {
    return "en";
  }

  return normalizeLang(fallback || "en");
}

function trimText(text, maxLength) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function buildLanguageRule(lang) {
  if (lang === "hr") {
    return "Odgovaraj isključivo na hrvatskom jeziku. Ne koristi engleski ni njemački u odgovoru.";
  }

  if (lang === "de") {
    return "Antworte ausschließlich auf Deutsch. Verwende kein Englisch und kein Kroatisch.";
  }

  return "Respond only in English. Do not use Croatian or German in the answer.";
}

function fallbackAnswer(lang) {
  if (lang === "hr") {
    return "Mogu pomoći, ali iz sadržaja koji trenutno vidim nemam još dovoljno jasnih informacija za točan odgovor.";
  }

  if (lang === "de") {
    return "Ich kann helfen, aber aus dem aktuell sichtbaren Inhalt habe ich noch nicht genug klare Informationen für eine genaue Antwort.";
  }

  return "I can help, but I do not yet have enough clear information from the visible page content for a precise answer.";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const body = req.body || {};
    const message = trimText(body.message || "", 900);
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
      pageTitle: trimText(rawPageContext.pageTitle || "", 200),
      pageDescription: trimText(rawPageContext.pageDescription || "", 400),
      pageText: trimText(rawPageContext.pageText || "", 5000),
      lang: normalizeLang(rawPageContext.lang || "en")
    };

    const userLang = normalizeLang(
      body.userLang || detectUserLanguageFromMessage(message, safePageContext.lang)
    );

    const systemPrompt = `
Ti si ${agent.agentName || "SiteMind AI"}, pametan i prirodan AI asistent na web stranici.

TVOJA ULOGA:
- razgovaraš s korisnikom kao stvarna osoba
- pomažeš korisniku razumjeti stranicu i napraviti sljedeći korak
- ne ponašaš se kao robot koji samo prepričava naslov stranice

NAJVAŽNIJE:
- odgovori na stvarnu namjeru korisnika
- ako korisnik traži pomoć, pomozi mu konkretno
- ako pita kako nešto postaviti, objasni korake
- ako pita nalazi li se nešto na stranici, procijeni iz sadržaja i odgovori jasno
- ako odgovor nije potpuno siguran, reci to iskreno, ali ipak daj najbolju moguću procjenu

PRAVILA:
- ne vraćaj samo opis stranice ako korisnik traži praktičnu pomoć
- ne ponavljaj naslov stranice bez razloga
- koristi kontekst stranice da razumiješ o čemu je riječ
- ako korisnik pita:
  - "možeš li mi pomoći kako da postavim widget na stranicu"
  tada objasni kako bi to okvirno išlo
- ako korisnik pita:
  - "da li se na ovoj stranici nalazi widget builder"
  tada odgovori jasno vidi li se to ili ne vidi iz sadržaja
- ako korisnik pita općenito, budi prirodan i koristan
- budi razgovoran, ali konkretan

STIL:
- kratak do srednje dug
- prirodan
- ljudski
- konkretan
- koristan

${buildLanguageRule(userLang)}

DODATNE UPUTE AGENTA:
${trimText(agent.systemPrompt || "", 1200)}
`.trim();

    const userPrompt = `
KORISNIKOVO PITANJE:
${message}

KONTEKST STRANICE:
Naslov: ${safePageContext.pageTitle || "-"}
Opis: ${safePageContext.pageDescription || "-"}
URL: ${safePageContext.pageUrl || "-"}
Tekst stranice:
${safePageContext.pageText || "-"}
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      max_completion_tokens: 420
    });

    const answer =
      completion?.choices?.[0]?.message?.content?.trim() || fallbackAnswer(userLang);

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
