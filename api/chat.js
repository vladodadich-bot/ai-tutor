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
    /\b(kako|sto|što|sta|šta|koliko|gdje|gde|moze|može|trebam|zelim|želim|htjeo|hteo|želio|ugraditi|staviti|widget|pomozi|pomoc|pomoć|stranica|stranicu|mogu li|mozes li|možeš li)\b/.test(m)
  ) {
    return "hr";
  }

  if (
    /\b(wie|was|hilfe|helfen|einbauen|widget|seite|ich|möchte|mochte|bitte|danke|kannst)\b/.test(m)
  ) {
    return "de";
  }

  if (
    /\b(how|what|help|can you|embed|widget|website|site|install|add|setup)\b/.test(m)
  ) {
    return "en";
  }

  return normalizeLang(fallback || "en");
}

function trimText(text, maxLength) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
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

function buildHardLanguageRule(lang) {
  if (lang === "hr") {
    return `
ODGOVARAJ SAMO NA HRVATSKOM.
- Ne koristi engleski.
- Ne koristi njemački.
- Čak i ako je sadržaj stranice na drugom jeziku, odgovor mora biti potpuno na hrvatskom.
`.trim();
  }

  if (lang === "de") {
    return `
ANTWORTE NUR AUF DEUTSCH.
- Verwende kein Kroatisch.
- Verwende kein Englisch.
- Auch wenn der Seiteninhalt auf einer anderen Sprache ist, muss die Antwort vollständig auf Deutsch sein.
`.trim();
  }

  return `
RESPOND ONLY IN ENGLISH.
- Do not use Croatian.
- Do not use German.
- Even if the page content is in another language, the answer must stay fully in English.
`.trim();
}

function buildContextualFallback(lang, pageContext) {
  const title = trimText(pageContext.pageTitle || "", 180);

  if (lang === "hr") {
    if (title) {
      return "Mogu pomoći oko ove stranice. Koliko vidim, riječ je o: " + title + ". Slobodno pitajte što vas konkretno zanima ili što želite napraviti.";
    }
    return "Mogu pomoći oko ove stranice. Slobodno pitajte što vas konkretno zanima ili što želite napraviti.";
  }

  if (lang === "de") {
    if (title) {
      return "Ich kann Ihnen bei dieser Seite helfen. Soweit ich sehe, geht es um: " + title + ". Fragen Sie einfach, was Sie konkret wissen oder tun möchten.";
    }
    return "Ich kann Ihnen bei dieser Seite helfen. Fragen Sie einfach, was Sie konkret wissen oder tun möchten.";
  }

  if (title) {
    return "I can help with this page. As far as I can tell, it is about: " + title + ". Feel free to ask what you want to know or do.";
  }

  return "I can help with this page. Feel free to ask what you want to know or do.";
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
      pageTitle: trimText(rawPageContext.pageTitle || "", 180),
      pageDescription: trimText(rawPageContext.pageDescription || "", 320),
      pageText: trimText(rawPageContext.pageText || "", 3200),
      lang: normalizeLang(rawPageContext.lang || "en")
    };

    const userLang = normalizeLang(
      body.userLang || detectUserLanguageFromMessage(message, safePageContext.lang)
    );

    const systemPrompt = `
Ti si ${agent.agentName || "SiteMind AI"}, pametan i prirodan AI asistent na web stranici.

TVOJA ULOGA:
- razgovaraš s korisnikom kao stvarna, korisna osoba
- pomažeš korisniku da razumije stranicu, koristi je i napravi sljedeći korak
- ne ponašaš se kao robot koji samo opisuje naslov stranice

NAJVAŽNIJA PRAVILA:
- uvijek odgovori na stvarnu namjeru korisnika
- ako korisnik traži pomoć, objasni kako mu možeš pomoći
- ako korisnik želi nešto napraviti, usmjeri ga prema rješenju
- ako korisnik pita može li nešto ugraditi, postaviti, kupiti, rezervirati, koristiti ili aktivirati, odgovori praktično
- ne vraćaj sažetak stranice osim ako korisnik izričito pita o čemu je stranica
- nemoj samo ponavljati naslov, opis ili tekst stranice
- koristi sadržaj stranice da razumiješ kontekst, ali ne da mehanički prepričavaš
- ako korisnik pita općenito "možeš li mi pomoći", reci da možeš i ukratko navedi kako
- ako korisnik pita za widget, embed, instalaciju, postavljanje ili korištenje, ponašaj se kao podrška koja vodi korisnika kroz korake
- odgovori trebaju zvučati razgovorno, prirodno i korisno

KAKO ODGOVARATI:
- za praktična pitanja daj izravan odgovor
- za pitanja o akciji daj pomoć i sljedeći korak
- za da/ne pitanja prvo odgovori jasno, pa kratko objasni
- za pitanja tipa "kako to može biti korisno" objasni korist za korisnika
- za pitanja tipa "možeš li mi pomoći" nemoj opisivati stranicu, nego reci da možeš i u čemu

ŠTO IZBJEGAVATI:
- izbjegavaj fraze poput:
  - "Iz ove stranice se vidi tema..."
  - "The topic appears to be..."
  - "Sadržaj upućuje na..."
  osim ako korisnik baš traži sažetak stranice
- nemoj odgovarati kao tražilica
- nemoj biti ukočen
- nemoj miješati jezike
- nemoj izmišljati konkretne podatke koji nisu vidljivi

${buildHardLanguageRule(userLang)}

DODATNI STIL:
- budi ljubazan, smiren i prirodan
- odgovaraj kao dobar support/sales agent
- ako korisnik traži pomoć, pokaži inicijativu
- ako korisnik želi rješenje, vodi ga prema rješenju
- neka odgovori budu kratki do srednje dugi, ne predugi

${trimText(agent.systemPrompt || "", 1000)}
`.trim();

    const userPrompt = `
USER_LANGUAGE: ${userLang}

USER_MESSAGE:
${message}

PAGE_CONTEXT:
Title: ${safePageContext.pageTitle || "-"}
Description: ${safePageContext.pageDescription || "-"}
URL: ${safePageContext.pageUrl || "-"}
Page text:
${safePageContext.pageText || "-"}
`.trim();

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      max_output_tokens: 420,
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
