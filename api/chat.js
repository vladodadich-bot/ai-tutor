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
    /\b(kako|sto|što|sta|šta|koliko|gdje|gde|moze|može|trebam|zelim|želim|htjeo|hteo|želio|ugraditi|staviti|widget|pomozi|pomoc|pomoć|stranica|stranicu|mogu li|mozes li|možeš li|builder|postavim|postaviti|prodaja|prodaje|nudi|korisno|pomoci|pomoći|instrukcije|upute|objasni|kako da|garancija|dostava|kontakt|cijena|popust|rok|uvjeti)\b/.test(m)
  ) {
    return "hr";
  }

  if (
    /\b(wie|was|hilfe|helfen|einbauen|widget|seite|ich|möchte|mochte|bitte|danke|kannst|builder|verkauf|bietet|nützlich|anleitung|erklären|garantie|lieferung|kontakt|preis|rabatt|bedingungen)\b/.test(m)
  ) {
    return "de";
  }

  if (
    /\b(how|what|help|embed|widget|website|site|install|add|setup|builder|can you|sell|offer|useful|instructions|explain|warranty|delivery|contact|price|discount|terms)\b/.test(m)
  ) {
    return "en";
  }

  return normalizeLang(fallback || "en");
}

function trimText(text, maxLength) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function buildHardLanguageRule(lang) {
  if (lang === "hr") {
    return `
ODGOVARAJ ISKLJUČIVO NA HRVATSKOM JEZIKU.
- Ne koristi engleski.
- Ne koristi njemački.
- Čak i ako je sadržaj stranice na drugom jeziku, odgovor mora ostati potpuno na hrvatskom.
- Ako moraš spomenuti naziv proizvoda, alata ili naslov koji je na drugom jeziku, smiješ ga kratko citirati, ali ostatak odgovora mora biti na hrvatskom.
`.trim();
  }

  if (lang === "de") {
    return `
ANTWORTE AUSSCHLIESSLICH AUF DEUTSCH.
- Verwende kein Englisch.
- Verwende kein Kroatisch.
- Auch wenn der Seiteninhalt in einer anderen Sprache ist, muss die Antwort vollständig auf Deutsch bleiben.
- Wenn du einen Produktnamen oder Titel in einer anderen Sprache erwähnen musst, darfst du ihn kurz zitieren, aber der Rest der Antwort muss auf Deutsch sein.
`.trim();
  }

  return `
RESPOND ONLY IN ENGLISH.
- Do not use Croatian.
- Do not use German.
- Even if the page content is in another language, the answer must remain fully in English.
- If you must mention a product name, tool name, or title in another language, you may quote it briefly, but the rest of the answer must stay in English.
`.trim();
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
      if (
        part &&
        part.type === "output_text" &&
        typeof part.text === "string" &&
        part.text.trim()
      ) {
        chunks.push(part.text.trim());
      }
    }
  }

  return chunks.join("\n").trim();
}

function fallbackAnswer(lang, pageContext) {
  const title = trimText(pageContext.pageTitle || "", 180);

  if (lang === "hr") {
    if (title) {
      return `Mogu pomoći oko ove stranice. Koliko se vidi, stranica je povezana s temom: ${title}. Slobodno pitajte što vas konkretno zanima ili što želite napraviti.`;
    }
    return "Mogu pomoći oko ove stranice. Slobodno pitajte što vas konkretno zanima ili što želite napraviti.";
  }

  if (lang === "de") {
    if (title) {
      return `Ich kann bei dieser Seite helfen. Soweit erkennbar, geht es um: ${title}. Fragen Sie einfach, was Sie konkret wissen oder tun möchten.`;
    }
    return "Ich kann bei dieser Seite helfen. Fragen Sie einfach, was Sie konkret wissen oder tun möchten.";
  }

  if (title) {
    return `I can help with this page. As far as I can tell, it is related to: ${title}. Feel free to ask what you want to know or do.`;
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
    const message = trimText(body.message || "", 1000);
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
      pageTitle: trimText(rawPageContext.pageTitle || "", 220),
      pageDescription: trimText(rawPageContext.pageDescription || "", 500),
      pageText: trimText(rawPageContext.pageText || "", 6000),
      lang: normalizeLang(rawPageContext.lang || "en")
    };

    const userLang = normalizeLang(
      body.userLang || detectUserLanguageFromMessage(message, safePageContext.lang)
    );

    const systemPrompt = `
Ti si ${agent.agentName || "SiteMind AI"}, prirodan, inteligentan i koristan AI asistent na web stranici.

TVOJA ULOGA:
- razgovaraš s korisnikom kao stvarna osoba
- koristiš sadržaj stranice da razumiješ o čemu se radi
- koristiš svoje opće znanje, logiku i sposobnost objašnjavanja kako bi stvarno pomogao korisniku
- ne ponašaš se kao robot koji samo ponavlja naslov i opis stranice

GLAVNO PRAVILO:
Smiješ osmišljavati korisnu pomoć, objašnjenja, korake, prijedloge, procjene, sažetke i praktične instrukcije.
Ne smiješ izmišljati specifične činjenice o ovoj stranici, proizvodu, usluzi ili poslovanju ako nisu jasno potvrđene u dostupnom kontekstu.

TO ZNAČI:
- smiješ izmišljati način pomoći
- smiješ koristiti opće znanje za objašnjenja i korake
- smiješ predlagati što korisnik može napraviti dalje
- smiješ objasniti kako nešto tipično funkcionira
- smiješ voditi korisnika kroz postupak
- ne smiješ izmišljati konkretne poslovne podatke koji nisu potvrđeni

KORISTI KONTEXT + INTELIGENCIJU ZAJEDNO:
1. prvo pogledaj sadržaj stranice i shvati kontekst
2. zatim odgovori koristeći i taj kontekst i svoje opće znanje
3. ako korisnik traži pomoć, instrukcije, korake, savjet ili objašnjenje, slobodno ih smisli i objasni kao ljudski agent
4. ako korisnik pita nešto što traži potvrđene činjenice o toj stranici ili poslovanju, osloni se na ono što vidiš u kontekstu

KADA SMIJEŠ DATI OPĆU POMOĆ IZ SVOG ZNANJA:
- kako postaviti widget
- kako nešto ugraditi u stranicu
- kako nešto obično radi
- što bi moglo biti korisno
- koji su tipični koraci
- kako započeti
- kako nešto testirati
- kako korisnik može pristupiti problemu
- kako bi mu ova vrsta alata mogla pomoći

KADA NE SMIJEŠ IZMIŠLJATI:
- cijenu
- popust
- garanciju
- trajanje dostave
- kontakt podatke
- dostupnost
- rokove
- uvjete
- lokacije
- potvrdu da neka funkcija ili proizvod postoji na stranici, ako to nije vidljivo

KAKO ODGOVARATI:
- odgovori na stvarnu namjeru korisnika
- ako korisnik pita kako nešto napraviti, daj konkretan, koristan odgovor
- ako pita da/ne pitanje, prvo odgovori jasno pa kratko objasni
- ako pita kako mu nešto može koristiti, objasni korist
- ako pita nalazi li se nešto na stranici, reci vidi li se to jasno ili ne
- ako se nešto ne vidi jasno na stranici, reci to iskreno, ali pokušaj pomoći općim savjetom
- ne vraćaj samo opis stranice osim ako korisnik baš pita o čemu je stranica
- ne ponašaj se kao tražilica teksta
- ne koristi ukočene fraze poput:
  - "Iz ove stranice se vidi tema..."
  - "The topic appears to be..."
  - "Sadržaj upućuje na..."
  osim ako je to stvarno najbolji odgovor, što će rijetko biti slučaj

STIL:
- prirodan
- ljudski
- konkretan
- koristan
- smiren
- razgovoran
- kratak do srednje dug

POSEBNO:
Ako korisnik traži pomoć, nemoj ga vraćati na opis stranice.
Ako korisnik pita kako nešto postaviti ili koristiti, odgovori praktično.
Ako korisnik pita nešto poslovno-specifično što se ne vidi na stranici, reci da to ne možeš potvrditi, ali ponudi korisnu pomoć dalje.

${buildHardLanguageRule(userLang)}

DODATNE UPUTE AGENTA:
${trimText(agent.systemPrompt || "", 1200)}
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
      max_output_tokens: 520,
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
    console.error("API /api/chat error FULL:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}
