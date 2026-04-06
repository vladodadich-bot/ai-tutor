import { createClient } from '@supabase/supabase-js';
import { crawlSinglePage } from '../lib/crawl.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

// ========================================
// AUTH HELPERS - START
// ========================================

function getBearerToken(req) {
  const authHeader =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    '';

  if (!authHeader || typeof authHeader !== 'string') {
    return '';
  }

  if (!authHeader.startsWith('Bearer ')) {
    return '';
  }

  return authHeader.slice(7).trim();
}

async function getAuthenticatedUser(req) {
  const token = getBearerToken(req);

  if (!token) {
    return {
      user: null,
      error: 'Missing Authorization bearer token'
    };
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return {
        user: null,
        error: error?.message || 'Invalid or expired session'
      };
    }

    return {
      user: data.user,
      error: null
    };
  } catch (err) {
    return {
      user: null,
      error: err && err.message ? err.message : 'Authentication failed'
    };
  }
}

async function requireAuthenticatedUser(req, res) {
  const { user, error } = await getAuthenticatedUser(req);

  if (error || !user) {
    res.status(401).json({
      error: error || 'Unauthorized'
    });
    return null;
  }

  return user;
}

// ========================================
// AUTH HELPERS - END
// ========================================

// ========================================
// CREATE AGENT - START
// ========================================

async function handleCreateAgent(req, res, body) {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const agentName = String(body.agentName || body.agent_name || 'My Agent').trim();
  const welcomeMessage = String(body.welcomeMessage || body.welcome_message || 'Hi! How can I help?').trim();
  const themeColor = String(body.themeColor || body.theme_color || '#2563eb').trim();
  const siteDomain = String(body.siteDomain || body.site_domain || '').trim();

  if (!siteDomain) {
    return res.status(400).json({ error: 'Missing siteDomain' });
  }

  if (!process.env.SUPABASE_URL) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY' });
  }

  const agentId = 'agent_' + Math.random().toString(36).slice(2, 10);

  const { data, error } = await supabase
    .from('agents')
    .insert({
      user_id: user.id,
      agent_id: agentId,
      agent_name: agentName,
      welcome_message: welcomeMessage,
      theme_color: themeColor,
      site_domain: siteDomain
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    success: true,
    userId: data.user_id,
    agentId: data.agent_id,
    agentName: data.agent_name,
    welcomeMessage: data.welcome_message,
    themeColor: data.theme_color,
    siteDomain: data.site_domain
  });
}

// ========================================
// CREATE AGENT - END
// ========================================

// ========================================
// GET AGENTS - START
// ========================================

async function handleGetAgents(req, res, body) {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  if (!process.env.SUPABASE_URL) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY' });
  }

  const siteDomain = String(body.siteDomain || body.site_domain || '').trim();

  let query = supabase
    .from('agents')
    .select('agent_id, agent_name, welcome_message, theme_color, site_domain, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (siteDomain) {
    query = query.eq('site_domain', siteDomain);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    success: true,
    agents: data || []
  });
}

// ========================================
// GET AGENTS - END
// ========================================

// ========================================
// UPDATE AGENT - START
// ========================================

async function handleUpdateAgent(req, res, body) {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const agentId = String(body.agentId || body.agent_id || '').trim();

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }

  if (!process.env.SUPABASE_URL) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY' });
  }

  const { data: existingAgent, error: existingError } = await supabase
    .from('agents')
    .select('agent_id, user_id')
    .eq('agent_id', agentId)
    .eq('user_id', user.id)
    .single();

  if (existingError || !existingAgent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const updates = {};

  if (body.agentName !== undefined || body.agent_name !== undefined) {
    updates.agent_name = String(body.agentName || body.agent_name || '').trim();
  }

  if (body.welcomeMessage !== undefined || body.welcome_message !== undefined) {
    updates.welcome_message = String(body.welcomeMessage || body.welcome_message || '').trim();
  }

  if (body.themeColor !== undefined || body.theme_color !== undefined) {
    updates.theme_color = String(body.themeColor || body.theme_color || '').trim();
  }

  if (body.siteDomain !== undefined || body.site_domain !== undefined) {
    updates.site_domain = String(body.siteDomain || body.site_domain || '').trim();
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const { data, error } = await supabase
    .from('agents')
    .update(updates)
    .eq('agent_id', agentId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    success: true,
    agent: data
  });
}

// ========================================
// UPDATE AGENT - END
// ========================================

// ========================================
// DELETE AGENT - START
// ========================================

async function handleDeleteAgent(req, res, body) {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const agentId = String(body.agentId || body.agent_id || '').trim();

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }

  if (!process.env.SUPABASE_URL) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY' });
  }

  const { data: existingAgent, error: existingError } = await supabase
    .from('agents')
    .select('agent_id, user_id')
    .eq('agent_id', agentId)
    .eq('user_id', user.id)
    .single();

  if (existingError || !existingAgent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const deleteSiteContent = await supabase
    .from('site_content')
    .delete()
    .eq('agent_id', agentId);

  if (deleteSiteContent.error) {
    return res.status(500).json({ error: deleteSiteContent.error.message });
  }

  const deleteAgent = await supabase
    .from('agents')
    .delete()
    .eq('agent_id', agentId)
    .eq('user_id', user.id);

  if (deleteAgent.error) {
    return res.status(500).json({ error: deleteAgent.error.message });
  }

  return res.status(200).json({
    success: true,
    deletedAgentId: agentId
  });
}

// ========================================
// DELETE AGENT - END
// ========================================

// ========================================
// CRAWL HELPERS - START
// ========================================

function normalizeUrlValue(value) {
  return String(value || '').trim();
}

function normalizeCrawlResultToRows(crawlResult, agentId) {
  let pages = [];

  if (Array.isArray(crawlResult)) {
    pages = crawlResult;
  } else if (Array.isArray(crawlResult?.pages)) {
    pages = crawlResult.pages;
  } else if (crawlResult && typeof crawlResult === 'object') {
    pages = [crawlResult];
  }

  const normalizedRows = pages
    .filter(Boolean)
    .map((page) => {
      const headings = Array.isArray(page?.headings) ? page.headings : [];
      const internalLinks = Array.isArray(page?.internal_links)
        ? page.internal_links
        : Array.isArray(page?.internalLinks)
          ? page.internalLinks
          : [];

      const safeHeadings = headings
        .map((item) => String(item || '').trim())
        .filter(Boolean);

      const safeInternalLinks = internalLinks
        .map((link) => ({
          text: String(link?.text || '').trim(),
          href: String(link?.href || '').trim()
        }))
        .filter((link) => link.href);

      return {
        agent_id: agentId,
        url: normalizeUrlValue(page?.url),
        content: String(page?.content || ''),
        page_title: String(page?.page_title || page?.pageTitle || ''),
        meta_description: String(page?.meta_description || page?.metaDescription || ''),
        h1: String(page?.h1 || ''),
        headings: safeHeadings,
        internal_links: safeInternalLinks,
        text_preview: String(page?.text_preview || page?.textPreview || '')
      };
    })
    .filter((row) => row.url);

  return normalizedRows;
}
// ========================================
// CRAWL HELPERS - END
// ========================================

// ========================================
// CRAWL SITE - START
// ========================================

async function handleCrawlSite(req, res, body) {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const agentId = String(body.agentId || body.agent_id || '').trim();
  const requestedUrl = String(body.url || body.siteUrl || body.site_url || '').trim();
  const requestedSiteDomain = String(body.siteDomain || body.site_domain || '').trim();

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }

  if (!process.env.SUPABASE_URL) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY' });
  }

  const { data: existingAgent, error: existingError } = await supabase
    .from('agents')
    .select('agent_id, user_id, site_domain')
    .eq('agent_id', agentId)
    .eq('user_id', user.id)
    .single();

  if (existingError || !existingAgent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const crawlUrl =
    requestedUrl ||
    requestedSiteDomain ||
    String(existingAgent.site_domain || '').trim();

  if (!crawlUrl) {
    return res.status(400).json({ error: 'Missing crawl url/siteDomain and agent has no saved site_domain' });
  }

  try {
    const crawlResult = await crawlSinglePage(crawlUrl);
    const rowsToInsert = normalizeCrawlResultToRows(crawlResult, agentId);

    if (!rowsToInsert.length) {
      console.error('CRAWL NORMALIZE ERROR: No valid rows produced from crawl result');
      return res.status(500).json({ error: 'Crawler returned no valid rows to insert' });
    }

    console.log('CRAWL ROWS TO INSERT:', rowsToInsert.length);
    console.log('CRAWL SAMPLE ROW:', rowsToInsert[0]);

    const deleteResult = await supabase
      .from('site_content')
      .delete()
      .eq('agent_id', agentId);

    if (deleteResult.error) {
      return res.status(500).json({ error: deleteResult.error.message });
    }

    const insertResult = await supabase
      .from('site_content')
      .insert(rowsToInsert);

    if (insertResult.error) {
      console.error('SITE_CONTENT INSERT ERROR:', insertResult.error);
      return res.status(500).json({ error: insertResult.error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Crawl saved',
      pagesCrawled: rowsToInsert.length
    });
  } catch (err) {
    console.error('CRAWL FAILED:', err);
    return res.status(500).json({
      error: err && err.message ? err.message : 'Crawl failed'
    });
  }
}

// ========================================
// CRAWL SITE - END
// ========================================

// ========================================
// AGENT CONFIG - START
// ========================================

async function handleAgentConfig(req, res, body) {
  const query = req.query || {};
  const agentId = String(body.agentId || body.agent_id || query.agentId || '').trim();

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }

  if (!process.env.SUPABASE_URL) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY' });
  }

  const { data, error } = await supabase
    .from('agents')
    .select('agent_id, agent_name, welcome_message, theme_color, site_domain')
    .eq('agent_id', agentId)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  return res.status(200).json({
    agentId: data.agent_id,
    agentName: data.agent_name,
    welcomeMessage: data.welcome_message,
    themeColor: data.theme_color,
    siteDomain: data.site_domain
  });
}

// ========================================
// AGENT CONFIG - END
// ========================================

// ========================================
// CHAT HELPERS - START
// ========================================

function cleanText(value) {
  return String(value || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function limitText(value, max) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  return text.slice(0, max);
}

function normalizeHistoryItems(history, maxItems = 8) {
  if (!Array.isArray(history)) return [];

  return history
    .map((item) => ({
      role: item && item.role === 'assistant' ? 'assistant' : 'user',
      content: limitText(item && item.content ? item.content : '', 1200)
    }))
    .filter((item) => item.content)
    .slice(-maxItems);
}

function getLanguageLabel(language) {
  const lang = String(language || '').toLowerCase();
  if (lang.startsWith('hr')) return 'Croatian';
  if (lang.startsWith('de')) return 'German';
  if (lang.startsWith('it')) return 'Italian';
  return 'English';
}

function buildAdaptiveSystemPrompt(languageLabel) {
  return `
You are an AI website master assistant, Respond in a natural, human, and friendly way.
You help users using:
- the current page content
- crawled website data
- the structure of the website (headings, links, topics)

You can combine information from these sources to give the best possible answer.
When helpful, include a relevant internal link.

RULES:
- If the user asks about programming or code, politely refuse and say you only help with the content of this website.
- Prioritize relevant content from the current page and site data
- Do not invent facts, links, or information
- If exact information is not available, guide the user to the most relevant page or topic
- Keep answers short, clear, and useful max ~150 words
- If a user repeats the same question several times, do not repeat the full answer again
- In repeated-question cases, reply very briefly and tell the user to look above
- If a question is unrelated to this website’s content or asks for unsafe, harmful, illegal, or technical instructions, politely refuse and redirect the user to questions about this website.
- Answer in ${languageLabel}

STYLE:
- Natural, confident, and helpful
- Give a direct answer first, then optional guidance
- Prefer practical and actionable responses over long explanations

GOAL:
Help the user quickly understand the topic or find the right content on the website.
`.trim();
}

function buildUserPrompt(payload) {
  const headingsText = Array.isArray(payload.headings) ? payload.headings.join(' | ') : '';
  const historyText = Array.isArray(payload.history) && payload.history.length
    ? payload.history.map((item) => `${item.role}: ${item.content}`).join('\n')
    : 'N/A';

  return `
User message:
${payload.message || 'N/A'}

Page type hint:
${payload.pageTypeHint || 'general'}

Page language:
${payload.language || 'en'}

Page title:
${payload.pageTitle || 'N/A'}

Page description:
${payload.pageDescription || 'N/A'}

Page URL:
${payload.pageUrl || 'N/A'}

Main H1:
${payload.h1 || 'N/A'}

Headings:
${headingsText || 'N/A'}

Current page content:
${payload.pageText || payload.pageContext || 'N/A'}

Relevant crawled website context:
${payload.crawlContext || 'N/A'}

Recent conversation:
${historyText}
  `.trim();
}

function buildLinkSuggestionReply(language, candidates) {
  const lang = String(language || 'en').toLowerCase();
  const items = (candidates || []).slice(0, 2);

  if (!items.length) return '';

  if (lang.startsWith('de')) {
    if (items.length === 1) {
      return `Ich habe hier keinen vollständigen Inhalt zu diesem Thema, aber es gibt auf der Website offenbar eine passende Seite: ${items[0].title} – ${items[0].url}`;
    }
    return `Ich habe hier keinen vollständigen Inhalt zu diesem Thema, aber auf der Website gibt es passende Seiten:\n- ${items[0].title} – ${items[0].url}\n- ${items[1].title} – ${items[1].url}`;
  }

  if (lang.startsWith('hr')) {
    if (items.length === 1) {
      return `Nemam ovdje puni sadržaj o toj temi, ali na stranici očito postoji relevantan članak: ${items[0].title} – ${items[0].url}`;
    }
    return `Nemam ovdje puni sadržaj o toj temi, ali na stranici postoje relevantne poveznice:\n- ${items[0].title} – ${items[0].url}\n- ${items[1].title} – ${items[1].url}`;
  }

  if (lang.startsWith('it')) {
    if (items.length === 1) {
      return `Qui non ho il contenuto completo su questo argomento, ma sul sito esiste una pagina pertinente: ${items[0].title} – ${items[0].url}`;
    }
    return `Qui non ho il contenuto completo su questo argomento, ma sul sito ci sono pagine pertinenti:\n- ${items[0].title} – ${items[0].url}\n- ${items[1].title} – ${items[1].url}`;
  }

  if (items.length === 1) {
    return `I do not have the full content for that topic here, but there is a relevant page on the website: ${items[0].title} – ${items[0].url}`;
  }

  return `I do not have the full content for that topic here, but there are relevant pages on the website:\n- ${items[0].title} – ${items[0].url}\n- ${items[1].title} – ${items[1].url}`;
}

function normalizeQuestionForRepeat(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function countRecentRepeatedUserQuestions(history, message) {
  const normalizedMessage = normalizeQuestionForRepeat(message);
  if (!normalizedMessage) return 0;

  let count = 0;

  for (const item of history || []) {
    if (item.role !== 'user') continue;

    const normalizedHistoryMessage = normalizeQuestionForRepeat(item.content);
    if (!normalizedHistoryMessage) continue;

    if (normalizedHistoryMessage === normalizedMessage) {
      count += 1;
    }
  }

  return count;
}

function buildRepeatedQuestionReply(language) {
  const lang = String(language || 'en').toLowerCase();

  if (lang.startsWith('de')) return 'Schon beantwortet — oben schauen.';
  if (lang.startsWith('hr')) return 'Već odgovoreno — pogledaj iznad.';
  if (lang.startsWith('it')) return 'Già risposto — guarda sopra.';
  return 'Already answered — look above.';
}

// ========================================
// CHAT HELPERS - END
// ========================================

// ========================================
// CRAWL CHAT HELPERS - START
// ========================================

function safeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeSearchText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMeaningfulWords(value) {
  const stopWords = new Set([
    'a', 'ali', 'ako', 'da', 'do', 'ga', 'i', 'ili', 'iz', 'je', 'još', 'ju',
    'li', 'na', 'ne', 'no', 'od', 'o', 'po', 'sa', 'se', 'su', 'to', 'u', 'uz',
    'za', 'the', 'and', 'for', 'are', 'with', 'from', 'this', 'that',
    'kratki', 'kratka', 'kratko', 'sadrzaj', 'sadržaj', 'lektira', 'likovi',
    'tema', 'ideja', 'analiza', 'opis', 'poruka', 'pouka', 'djelo', 'djela',
    'redoslijed', 'dogadjaja', 'događaja', 'radnja', 'radnje', 'pisac',
    'autor', 'glavni', 'sporedni', 'vrsta', 'mjesto', 'vrijeme',
    'figuren', 'figur', 'charakterisierung', 'zusammenfassung', 'inhalt',
    'analyse', 'thema', 'motive', 'roman', 'pripovijetka'
  ]);

  return normalizeSearchText(value)
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => word.length >= 3 && !stopWords.has(word));
}

function scoreTextByWords(text, words, weight) {
  if (!text || !words.length) return 0;

  const haystack = normalizeSearchText(text);
  let score = 0;

  for (const word of words) {
    if (haystack.includes(word)) score += weight;
  }

  return score;
}

function scorePageForMessage(page, message) {
  const words = getMeaningfulWords(message);
  if (!words.length) return 0;

  let score = 0;

  score += scoreTextByWords(page.page_title || '', words, 10);
  score += scoreTextByWords(page.h1 || '', words, 9);
  score += scoreTextByWords(safeJsonArray(page.headings).join(' '), words, 5);
  score += scoreTextByWords(page.meta_description || '', words, 3);
  score += scoreTextByWords(page.text_preview || '', words, 7);

  const linksText = safeJsonArray(page.internal_links)
    .map((link) => `${link?.text || ''} ${link?.href || ''}`)
    .join(' ');
  score += scoreTextByWords(linksText, words, 2);

  return score;
}

function currentPageCanAnswer({ message, pageTitle, h1, pageText, pageContext }) {
  const sourceText = String(pageText || pageContext || '').trim();
  if (sourceText.length < 120) return false;

  const words = getMeaningfulWords(message);

  if (!words.length) {
    return sourceText.length > 250;
  }

  const combined = normalizeSearchText(`${pageTitle || ''} ${h1 || ''} ${sourceText}`);
  let hits = 0;

  for (const word of words) {
    if (combined.includes(word)) hits += 1;
  }

  if (hits >= 2) return true;

  const titleZone = normalizeSearchText(`${pageTitle || ''} ${h1 || ''}`);
  for (const word of words) {
    if (titleZone.includes(word)) return true;
  }

  return false;
}

function isUniversalQuestion(message, pageTypeHint) {
  const text = normalizeSearchText(`${pageTypeHint || ''} ${message || ''}`);

  const patterns = [
    'sta je ', 'što je ', 'what is ', 'was ist ', 'cos è ', 'che cos è ',
    'kako ', 'how to ', 'wie ', 'come ',
    'objasni ', 'explain ', 'erkläre ', 'spiega ',
    'razlika izmedju ', 'razlika između ', 'difference between ',
    'definicija ', 'definition ', 'bedeutung '
  ];

  const generalSignals = [
    'tema knjizevnog djela', 'tema književnog djela',
    'karakterizacija lika', 'pripovjedac', 'pripovjedač',
    'metafora', 'personifikacija', 'epitet', 'uvod', 'zakljucak', 'zaključak',
    'esej', 'sastav', 'seminarski', 'kolokvij',
    'api', 'frontend', 'backend', 'hosting', 'html', 'css', 'javascript',
    'fotosinteza', 'gravitacija'
  ];

  if (patterns.some((pattern) => text.startsWith(pattern))) return true;
  if (generalSignals.some((signal) => text.includes(signal))) return true;

  return false;
}

function pickRelevantCrawledPages(rows, message, limit = 1) {
  const scored = (rows || [])
    .map((row) => ({
      ...row,
      _score: scorePageForMessage(row, message)
    }))
    .filter((row) => row._score > 0)
    .sort((a, b) => b._score - a._score);

  return scored.slice(0, limit);
}

function extractRelevantSnippet(page, message, maxLen = 700) {
  const baseText = String(page?.text_preview || page?.content || '').trim();
  if (!baseText) return '';

  const words = getMeaningfulWords(message);
  if (!words.length) {
    return limitText(baseText, maxLen);
  }

  const lowered = baseText.toLowerCase();
  let bestIndex = -1;

  for (const word of words) {
    const idx = lowered.indexOf(word.toLowerCase());
    if (idx !== -1) {
      bestIndex = idx;
      break;
    }
  }

  if (bestIndex === -1) {
    return limitText(baseText, maxLen);
  }

  const half = Math.floor(maxLen / 2);
  let start = Math.max(0, bestIndex - half);
  let end = Math.min(baseText.length, bestIndex + half);

  while (start > 0 && baseText[start] !== ' ') start -= 1;
  while (end < baseText.length && baseText[end] !== ' ') end += 1;

  const snippet = baseText.slice(start, end).trim();

  if (snippet.length <= maxLen) return snippet;
  return limitText(snippet, maxLen);
}

function findBestCrawlMatch(rows, message) {
  const matches = pickRelevantCrawledPages(rows, message, 1);
  if (!matches.length) return null;

  const best = matches[0];
  const snippet = extractRelevantSnippet(best, message, 700);

  return {
    page: best,
    score: best._score || 0,
    snippet
  };
}

function shouldStopAfterMatch(bestMatch) {
  if (!bestMatch) return false;
  if ((bestMatch.score || 0) >= 10) return true;
  if (String(bestMatch.snippet || '').trim().length >= 120) return true;
  return false;
}

function findRelevantLinkCandidates(rows, message, limit = 2) {
  const matches = [];

  for (const row of rows || []) {
    const pageTitle = String(row.page_title || '').trim();
    const pageUrl = String(row.url || '').trim();
    const pageH1 = String(row.h1 || '').trim();
    const links = safeJsonArray(row.internal_links);

    const pageScore = scorePageForMessage(row, message);
    if (pageScore > 0 && pageUrl) {
      matches.push({
        title: pageTitle || pageH1 || pageUrl,
        url: pageUrl,
        score: pageScore + 4
      });
    }

    for (const link of links) {
      const linkText = String(link?.text || '').trim();
      const href = String(link?.href || '').trim();
      const score =
        scoreTextByWords(linkText, getMeaningfulWords(message), 5) +
        scoreTextByWords(href, getMeaningfulWords(message), 2);

      if (score > 0 && href) {
        matches.push({
          title: linkText || href,
          url: href,
          score
        });
      }
    }
  }

  const deduped = [];
  const seen = new Set();

  matches
    .sort((a, b) => b.score - a.score)
    .forEach((item) => {
      const key = String(item.url || '').trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      deduped.push(item);
    });

  return deduped.slice(0, limit);
}

async function getAgentWithAccess(agentId) {
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('agent_id, user_id, agent_name, welcome_message, theme_color, site_domain')
    .eq('agent_id', agentId)
    .maybeSingle();

  if (agentError || !agent) {
    return {
      agent: null,
      accessAllowed: false,
      reason: 'AGENT_NOT_FOUND'
    };
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select('status, is_active, current_period_end, created_at')
    .eq('user_id', agent.user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionError || !subscription) {
    return {
      agent,
      accessAllowed: false,
      reason: 'NO_SUBSCRIPTION'
    };
  }

  const isActive = subscription.is_active === true;
  const status = String(subscription.status || '').toLowerCase().trim();
  const periodEndRaw = subscription.current_period_end || null;

  if (!isActive) {
    return {
      agent,
      accessAllowed: false,
      reason: 'INACTIVE_SUBSCRIPTION'
    };
  }

  if (!periodEndRaw) {
    return {
      agent,
      accessAllowed: false,
      reason: 'MISSING_PERIOD_END'
    };
  }

  const now = new Date();
  const periodEnd = new Date(periodEndRaw);

  if (Number.isNaN(periodEnd.getTime()) || periodEnd < now) {
    return {
      agent,
      accessAllowed: false,
      reason: 'TRIAL_EXPIRED'
    };
  }

  if (!['trial', 'active', 'paid'].includes(status)) {
    return {
      agent,
      accessAllowed: false,
      reason: 'INVALID_STATUS'
    };
  }

  return {
    agent,
    accessAllowed: true,
    reason: null
  };
}

function createUtf8StreamWriter(res) {
  let headersSent = false;
  let ended = false;

  function ensureHeaders() {
    if (headersSent) return;
    headersSent = true;
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
  }

  return {
    write(chunk) {
      if (ended) return;
      if (!chunk) return;
      ensureHeaders();
      res.write(chunk);
    },
    end() {
      if (ended) return;
      ensureHeaders();
      ended = true;
      res.end();
    },
    get ended() {
      return ended;
    },
    get headersSent() {
      return headersSent || res.headersSent;
    }
  };
}

async function streamOpenAIResponseToNodeResponse(openaiRes, res) {
  if (!openaiRes.body) {
    throw new Error('OpenAI stream body is missing');
  }

  const writer = createUtf8StreamWriter(res);
  const reader = openaiRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const eventBlock of events) {
      const lines = eventBlock.split('\n');
      let payload = '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          payload += trimmed.slice(5).trim();
        }
      }

      if (!payload || payload === '[DONE]') {
        continue;
      }

      try {
        const parsed = JSON.parse(payload);

        if (parsed.type === 'response.output_text.delta' && parsed.delta) {
          writer.write(parsed.delta);
        }

        if (parsed.type === 'response.completed') {
          writer.end();
          return;
        }

        if (parsed.type === 'response.failed') {
          console.error('OPENAI STREAM FAILED:', parsed);
          writer.end();
          return;
        }
      } catch (err) {
        // ignore incomplete event chunk
      }
    }
  }

  if (buffer.trim()) {
    const lines = buffer.split('\n');
    let payload = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) {
        payload += trimmed.slice(5).trim();
      }
    }

    if (payload && payload !== '[DONE]') {
      try {
        const parsed = JSON.parse(payload);
        if (parsed.type === 'response.output_text.delta' && parsed.delta) {
          writer.write(parsed.delta);
        }
      } catch (err) {
        // ignore trailing partial event
      }
    }
  }

  writer.end();
}

// ========================================
// CRAWL CHAT HELPERS - END
// ========================================

// ========================================
// CHAT - START
// ========================================

async function handleChat(req, res, body) {
  const agentId = String(body.agentId || body.agent_id || '').trim();
  const message = String(body.message || '').trim();

  const language = limitText(body.language || 'en', 20);
  const pageTypeHint = limitText(body.pageTypeHint || 'general', 50);

  const pageTitle = limitText(body.pageTitle || '', 300);
  const pageDescription = limitText(body.pageDescription || '', 500);
  const pageUrl = limitText(body.pageUrl || '', 500);
  const h1 = limitText(body.h1 || '', 300);

  const pageContext = limitText(body.pageContext || '', 5000);
  const pageText = limitText(body.pageText || body.pageContext || '', 7000);

  const headings = Array.isArray(body.headings)
    ? body.headings.map((item) => limitText(item, 200)).filter(Boolean).slice(0, 12)
    : [];

  const history = normalizeHistoryItems(body.history, 8);

  if (!agentId || !message) {
    return res.status(400).json({ error: 'Missing agentId or message' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
  }

  const repeatedCount = countRecentRepeatedUserQuestions(history, message);

  if (repeatedCount >= 2) {
    return res.status(200).json({
      reply: buildRepeatedQuestionReply(language)
    });
  }

  const accessCheck = await getAgentWithAccess(agentId);

  if (!accessCheck.agent) {
    return res.status(404).json({
      error: 'Agent not found'
    });
  }

  if (!accessCheck.accessAllowed) {
    return res.status(403).json({
      error: 'TRIAL_EXPIRED',
      code: accessCheck.reason || 'ACCESS_DENIED',
      message: 'Trial ili pretplata nisu aktivni. Aktivirajte plan za nastavak korištenja.'
    });
  }

  const useCurrentPageOnly = currentPageCanAnswer({
    message,
    pageTitle,
    h1,
    pageText,
    pageContext
  });

  const allowUniversalKnowledge = isUniversalQuestion(message, pageTypeHint);

  let crawledRows = [];
  let bestMatch = null;
  let linkCandidates = [];

  if (!useCurrentPageOnly && !allowUniversalKnowledge) {
    try {
      const { data, error } = await supabase
        .from('site_content')
        .select('url, page_title, meta_description, h1, headings, internal_links, text_preview')
        .eq('agent_id', agentId);

      if (!error && Array.isArray(data)) {
        crawledRows = data;
      }
    } catch (e) {
      crawledRows = [];
    }

    bestMatch = findBestCrawlMatch(crawledRows, message);
    linkCandidates = findRelevantLinkCandidates(crawledRows, message, 2);

    if (!bestMatch && linkCandidates.length > 0) {
      return res.status(200).json({
        reply: buildLinkSuggestionReply(language, linkCandidates)
      });
    }

    if (bestMatch && shouldStopAfterMatch(bestMatch) && bestMatch.page?.url) {
      linkCandidates = [
        {
          title: bestMatch.page.page_title || bestMatch.page.h1 || bestMatch.page.url,
          url: bestMatch.page.url
        }
      ];
    }
  }

  let crawlContext = '';

  if (!useCurrentPageOnly && !allowUniversalKnowledge && bestMatch) {
    try {
      const headingsValue = safeJsonArray(bestMatch.page.headings);
      const linksValue = safeJsonArray(bestMatch.page.internal_links);

      crawlContext = JSON.stringify([
        {
          url: bestMatch.page.url || '',
          page_title: bestMatch.page.page_title || '',
          h1: bestMatch.page.h1 || '',
          headings: headingsValue.slice(0, 6),
          relevant_snippet: limitText(bestMatch.snippet || '', 700),
          internal_links: linksValue.slice(0, 4)
        }
      ], null, 2);
    } catch (e) {
      crawlContext = '';
    }
  }

  const languageLabel = getLanguageLabel(language);
  const systemPrompt = buildAdaptiveSystemPrompt(languageLabel);

  const sourceMode = useCurrentPageOnly
    ? 'current_page_only'
    : allowUniversalKnowledge
      ? 'general_knowledge_allowed'
      : 'single_best_crawl_match';

  const userPrompt = buildUserPrompt({
    message,
    pageTypeHint,
    language,
    pageTitle,
    pageDescription,
    pageUrl,
    h1,
    headings,
    pageContext: useCurrentPageOnly ? pageContext : '',
    pageText: useCurrentPageOnly ? pageText : '',
    crawlContext,
    history
  }) + `

Source mode:
${sourceMode}

Extra answering rules:
- If Source mode is current_page_only, answer from the current page content first.
- If Source mode is general_knowledge_allowed, you may answer from general knowledge without using crawled site data.
- If Source mode is single_best_crawl_match, use only the provided relevant snippet or link context and do not assume more than what is shown.
- Never expand to unrelated pages or unrelated topics.
- If one relevant crawl match is already enough, stop there.
- Keep the answer concise and directly relevant to the user's question.
`;

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        stream: true,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: systemPrompt
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: userPrompt
              }
            ]
          }
        ]
      })
    });

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text();
      return res.status(500).json({
        error: 'OpenAI streaming request failed',
        details: errorText.slice(0, 1000)
      });
    }

    await streamOpenAIResponseToNodeResponse(openaiRes, res);
    return;
  } catch (err) {
    console.error('CHAT STREAM ERROR:', err);

    if (!res.headersSent) {
      return res.status(500).json({
        error: err && err.message ? err.message : 'Chat stream failed'
      });
    }

    try {
      res.end();
    } catch (e) {
      // ignore
    }

    return;
  }
}

// ========================================
// CHAT - END
// ========================================

// ========================================
// MAIN HANDLER - START
// ========================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const query = req.query || {};
    const body = req.body || {};
    const action = String(body.action || query.action || '').trim();

    if (req.method === 'GET' && query.ping === '1') {
      return res.status(200).json({ ok: true, message: 'index alive' });
    }

    if (req.method === 'GET' && query.testCrawl === '1') {
      return await handleCrawlSite(req, res, {
        url: 'https://njemacki2.blogspot.com/',
        agentId: 'agent_ji9hsuvk'
      });
    }

    if (action === 'create-agent') {
      return await handleCreateAgent(req, res, body);
    }

    if (action === 'get-agents') {
      return await handleGetAgents(req, res, body);
    }

    if (action === 'update-agent') {
      return await handleUpdateAgent(req, res, body);
    }

    if (action === 'delete-agent') {
      return await handleDeleteAgent(req, res, body);
    }

    if (action === 'crawl-site') {
      return await handleCrawlSite(req, res, body);
    }

    if (action === 'agent-config') {
      return await handleAgentConfig(req, res, body);
    }

    if (action === 'chat') {
      return await handleChat(req, res, body);
    }

    return res.status(400).json({ error: 'Unknown or missing action' });
  } catch (err) {
    console.error('INDEX ERROR:', err);
    return res.status(500).json({
      error: err && err.message ? err.message : 'Unknown server error',
      details: err && err.stack ? String(err.stack).slice(0, 2000) : ''
    });
  }
}

// ========================================
// MAIN HANDLER - END
// ========================================
