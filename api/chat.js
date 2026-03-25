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
    /\b(kako|sto|što|sta|šta|koliko|gdje|gde|moze|može|trebam|zelim|želim|cijena|kontakt|usluga|pomoc|pomoć|stranica|stranici|ovoj|cemu|čemu|radi|ucenje|učenje|njemacki|njemački|lekcije|tecaj|tečaj|prodaja|prodaje|nudi|nudi li|mogu li|mogu|zakazati|termin)\b/.test(m)
  ) {
    return "hr";
  }

  if (
    /\b(wie|was|worum|seite|inhalt|hilfe|kontakt|preis|deutsch|lektion|lektionen|lernen|kurs|ich|möchte|mochte|bitte|danke|verkauf|verkauft|bietet|termin|buchen)\b/.test(m)
  ) {
    return "de";
  }

  if (
    /\b(how|what|about|page|content|help|contact|price|course|lesson|lessons|learn|learning|german|service|sell|selling|offer|offers|book|appointment)\b/.test(m)
  ) {
    return "en";
  }

  return normalizeLang(fallback || "en");
}

function trimText(text, maxLength) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function buildLanguageInstruction(lang) {
  if (lang === "hr") {
    return "Odgovaraj isključivo na hrvatskom jeziku. Ne miješaj druge jezike u odgovoru.";
  }

  if (lang === "de") {
    return "Antworte ausschließlich auf Deutsch. Mische keine anderen Sprachen in die Antwort.";
  }

  return "Respond only in English. Do not mix other languages in the answer.";
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
    return trimText(parts[0], 240);
  }

  return trimText(cleaned, 240);
}

function buildContextualFallback(lang, pageContext) {
  const title = trimText(pageContext.pageTitle || "", 180);
  const desc = trimText(pageContext.pageDescription || "", 260);
  const snippet = firstUsefulSnippet(pageContext.pageText || "");

  if (lang === "hr") {
    let out = "Prema sadržaju ove stranice ";
    if (title) {
      out += "tema je: " + title + ". ";
    }
    if (desc) {
      out += desc + " ";
    }
    if (snippet) {
      out += "Iz sadržaja se vidi: " + snippet;
    }
    return out.trim();
  }

  if (lang === "de") {
    let out = "Nach dem Inhalt dieser Seite ";
    if (title) {
      out += "scheint das Thema zu sein: " + title + ". ";
    }
    if (desc) {
      out += desc + " ";
    }
    if (snippet) {
      out += "Aus dem Inhalt ist erkennbar: " + snippet;
    }
    return out.trim();
  }

  let out = "Based on this page, ";
  if (title) {
    out += "the topic appears to be: " + title + ". ";
  }
  if (desc) {
    out += desc + " ";
  }
  if (snippet) {
    out += "From the content, it appears: " + snippet;
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
    const message = trimText(body.message || "", 800);
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
      pageText: trimText(rawPageContext.pageText || "", 3400),
      lang: normalizeLang(rawPageContext.lang || "en")
    };

    const userLang = normalizeLang(
      body.userLang || detectUserLanguageFromMessage(message, safePageContext.lang)
    );

    const systemPrompt = `
Ti si ${agent.agentName || "SiteMind AI"}, inteligentni AI asistent ugrađen na web stranicu.

TVOJA ULOGA:
Ti nisi običan FAQ bot. Ti si digitalni pomoćnik koji razgovara s posjetiteljem prirodno, ljubazno i korisno, kao stvarna osoba koja poznaje ovu web stranicu i želi pomoći klijentu.

KAKO SE TREBAŠ PONAŠATI:
- ponašaj se kao ljubazan, profesionalan i prirodan agent
- odgovaraj kao čovjek koji se dopisuje s klijentom, ne kao robot
- budi topao, jasan i konkretan
- ne zvuči ukočeno, mehanički ni previše formalno
- vodi razgovor prirodno i prijateljski
- ako korisnik napiše kratku poruku, odgovori kratko i prirodno
- ako korisnik pita šire pitanje, slobodno objasni malo šire
- ako korisnik djeluje neodlučno ili samo istražuje, pomozi mu da shvati što stranica nudi

ŠTO TREBAŠ RAZUMJETI:
- o čemu je stranica
- što stranica nudi
- je li riječ o edukaciji, prodaji, usluzi, rezervaciji, blogu, informativnoj stranici ili nečemu drugom
- kome je stranica namijenjena
- što korisnik vjerojatno želi saznati

KAKO ODGOVARATI:
- koristi naslov, opis i tekst stranice kao glavni izvor
- smiješ zaključivati iz konteksta stranice, ne samo tražiti doslovne rečenice
- ako korisnik pita općenito, sažmi temu stranice svojim riječima
- ako pita da/ne pitanje, odgovori prvo jasno s da, ne, vjerojatno da ili ne izgleda tako, pa onda objasni zašto
- ako korisnik pita može li nešto napraviti preko ove stranice, procijeni iz konteksta je li to realno moguće
- ako stranica očito služi za učenje, blog, informacije ili predstavljanje usluge, reci to jasno
- ako stranica ne služi za kupnju, rezervaciju ili zakazivanje, reci to jasno
- ako korisnik pita nešto što nije doslovno napisano, ali se može zaključiti iz sadržaja, daj procjenu
- koristi formulacije poput:
  - "Izgleda da..."
  - "Prema sadržaju..."
  - "Ova stranica više djeluje kao..."
  - "Ne izgleda kao..."
  - "Vjerojatno služi za..."

ŠTO TREBAŠ IZBJEGAVATI:
- nemoj samo ponavljati naslov stranice bez zaključka
- nemoj vraćati suh opis stranice ako korisnik pita nešto praktično
- nemoj stalno tražiti konkretnije pitanje ako već možeš pomoći
- nemoj miješati jezike
- nemoj izmišljati konkretne podatke kao cijene, telefone, e-mailove, rokove, garancije, uvjete dostave ili popuste ako to nije jasno vidljivo
- nemoj biti napadan, ali budi koristan

KONVERZACIJSKI STIL:
- ako korisnik napiše "ok", "super", "hvala" ili slično, odgovori kratko i prirodno
- ako je korisnik zbunjen, objasni jednostavno
- ako vidiš da korisnik želi pomoć oko snalaženja na stranici, vodi ga
- možeš predložiti sljedeći korak, ali nenametljivo
- odgovori trebaju zvučati kao kratki chat razgovor, ne kao članak

PRIORITETI:
1. razumij pitanje korisnika
2. razumij svrhu stranice
3. spoji to dvoje u koristan odgovor
4. odgovori prirodno, ljudski i jasno

${buildLanguageInstruction(userLang)}
${trimText(agent.systemPrompt || "", 1000)}
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
