import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function cleanText(value, max = 1000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .map((item) => ({
      role: item && item.role === "assistant" ? "assistant" : "user",
      content: cleanText(item && item.content, 1200)
    }))
    .filter((item) => item.content)
    .slice(-12);
}

function extractAnswer(data) {
  let answer = data.output_text || "";

  if (!answer && data.output && Array.isArray(data.output)) {
    const parts = [];

    for (const item of data.output) {
      if (item.content && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.type === "output_text" && c.text) {
            parts.push(c.text);
          }
        }
      }
    }

    answer = parts.join("\n");
  }

  return answer || "Trenutno nemam odgovora.";
}

function normalizeDomain(url) {
  return String(url || "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim()
    .toLowerCase();
}

function isDomainAllowed(agent, pageUrl) {
  const allowedDomain = normalizeDomain(agent && agent.site_domain ? agent.site_domain : "");
  const currentDomain = normalizeDomain(pageUrl);

  if (!allowedDomain) return true;
  if (!currentDomain) return false;

  return currentDomain === allowedDomain;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    if (!process.env.SUPABASE_URL) {
      return res.status(500).json({ error: "Missing SUPABASE_URL" });
    }

    if (!process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: "Missing SUPABASE_ANON_KEY" });
    }

    const {
      message,
      agentId,
      history,
      pageTitle,
      pageDescription,
      pageUrl,
      pageContext
    } = req.body || {};

    const userMessage = cleanText(message, 800);
    const safeAgentId = cleanText(agentId, 100);

    if (!userMessage) {
      return res.status(400).json({ error: "Missing message" });
    }

    if (!safeAgentId) {
      return res.status(400).json({ error: "Missing agentId" });
    }

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("*")
      .eq("agent_id", safeAgentId)
      .limit(1)
      .maybeSingle();

    if (agentError) {
      return res.status(500).json({
        error: "Agent fetch failed",
        details: agentError.message
      });
    }

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

   if (!isDomainAllowed(agent, pageUrl)) {
  return res.status(403).json({
    error: "Domain not allowed",
    details: `Allowed: ${agent.site_domain || "none"}, got: ${pageUrl || "missing pageUrl"}`
  });
}

    const safeHistory = normalizeHistory(history);
    const safePageTitle = cleanText(pageTitle, 200);
    const safePageDescription = cleanText(pageDescription, 400);
    const safePageUrl = cleanText(pageUrl, 400);
    const safePageContext = cleanText(pageContext, 4000);

    const historyText = safeHistory.length
      ? safeHistory
          .map((item, index) => {
            const label = item.role === "assistant" ? "AI" : "Korisnik";
            return `Poruka ${index + 1} (${label}): ${item.content}`;
          })
          .join("\n")
      : "Nema prethodnih poruka.";
const { data: contentData } = await supabase
  .from("site_content")
  .select("content, url, created_at")
  .eq("agent_id", agentId)
  .order("created_at", { ascending: false })
  .limit(1);

const crawledContent = (contentData?.[0]?.content || "").slice(0, 12000);
const crawledUrl = contentData?.[0]?.url || "";
   const { data: crawledPages, error: crawledError } = await supabase
  .from('site_content')
  .select('url, page_title, meta_description, h1, headings, internal_links, text_preview')
  .eq('agent_id', agentId)
  .order('created_at', { ascending: false })
  .limit(12);

const crawledSummary = (crawledPages || [])
  .map((page, index) => {
    let headings = [];
    let internalLinks = [];

    try {
      headings = JSON.parse(page.headings || '[]');
    } catch (e) {
      headings = [];
    }

    try {
      internalLinks = JSON.parse(page.internal_links || '[]');
    } catch (e) {
      internalLinks = [];
    }

    return `
STRANICA ${index + 1}
URL: ${page.url || "Nije dostupno"}
TITLE: ${page.page_title || "Nije dostupno"}
META OPIS: ${page.meta_description || "Nije dostupno"}
H1: ${page.h1 || "Nije dostupno"}
NASLOVI: ${headings.slice(0, 8).join(' | ') || "Nije dostupno"}
VAŽNI LINKOVI: ${internalLinks.slice(0, 10).join(' | ') || "Nije dostupno"}
KRATKI SADRŽAJ: ${page.text_preview || "Nije dostupno"}
`.trim();
  })
  .join('\n\n----------------------\n\n');
    
    const prompt = `
${agent.system_prompt || "Ti si SiteMind AI asistent za web stranicu."}

PODACI O TRENUTNOJ STRANICI:
Naslov: ${safePageTitle || "Nije dostupno"}
Opis: ${safePageDescription || "Nije dostupno"}
URL: ${safePageUrl || "Nije dostupno"}

SADRŽAJ TRENUTNE STRANICE:
${safePageContext || "Sadržaj stranice nije dostupan."}

CRAWLANI PREGLED WEB STRANICE:
${crawledSummary || "Crawlani sadržaj nije dostupan."}

PRETHODNI RAZGOVOR:
${historyText}

NOVA PORUKA KORISNIKA:
${userMessage}

DODATNA PRAVILA:
- koristi prvenstveno podatke sa trenutne stranice ako korisnik pita baš o toj stranici
- koristi crawlani pregled stranica za širi kontekst o cijelom websiteu
- oslanjaj se posebno na title, meta opis, naslove i važne linkove
- ako ne znaš odgovor iz dostupnih podataka, reci to iskreno
- ne izmišljaj informacije
- uzmi u obzir prethodni razgovor
- odgovaraj kratko, jasno i korisno
- ako korisnik pita gdje nešto može pronaći, pokušaj ga uputiti prema odgovarajućoj stranici ili linku iz crawlanih podataka
`.trim();
    
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: prompt
      })
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return res.status(openaiResponse.status).json({
        error: "OpenAI API error",
        details: data
      });
    }

    const answer = extractAnswer(data);

    return res.status(200).json({
      answer
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: String(error && error.message ? error.message : error)
    });
  }
}
