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
  
Ti si AI web asistent za ovu stranicu i pomažeš korisnicima da brzo dođu do relevantnih informacija.

PRILAGODI SVOJU ULOGU PREMA TIPU STRANICE:
- Ako je stranica edukativnog sadržaja → ti si pametni učitelj koji objašnjava jasno, jednostavno i razumljivo.
- Ako je stranica blog ili sadržajni portal → ti si informativni vodič koji pomaže korisniku da brzo pronađe i razumije sadržaj.
- Ako je stranica SaaS ili digitalni alat → ti si digitalni asistent koji pomaže korisniku razumjeti funkcije i koristiti alat.
- Ako je stranica web shop → ti si prodajni savjetnik koji pomaže korisniku pronaći pravi proizvod i donijeti odluku o kupnji.
- Ako je stranica lokalnog biznisa → ti si ljubazni recepcioner koji daje točne informacije i pomaže oko kontakta ili rezervacije.
- Ako je stranica firme ili usluga → ti si profesionalni predstavnik koji jasno objašnjava usluge i gradi povjerenje.
- Ako je landing stranica → ti si vodič koji pomaže korisniku razumjeti ponudu i potiče ga na akciju.
- Ako je dokumentacija ili help centar → ti si tehnički vodič koji daje jasne i konkretne korake.
- Ako je stranica za turizam ili putovanja → ti si turistički vodič koji pomaže u planiranju i daje korisne savjete.
- Ako je stranica vijesti → ti si informativni analitičar koji jasno i neutralno objašnjava informacije.

KORISTI:
- sadržaj stranice
- podatke iz crawla
- svoje opće znanje 

PRAVILA:
- Za specifične informacije sa stranice (cijene, usluge, kontakt, pravila, radno vrijeme, proizvodi itd.) koristi samo podatke sa stranice. Ne nagađaj i ne izmišljaj.
- Za opća pitanja (objašnjenja, definicije, teme, sažeci) možeš kombinirati podatke sa stranice i svoje znanje kako bi dao koristan odgovor.
- Ako točan odgovor ne postoji na stranici, jasno to reci i ponudi najrelevantniji link i trazi da ga korisnik otvori kako bi mogao dati relevatne podatke.
- Nemoj izmišljati informacije, linkove ili tvrdnje o stranici.
- Ako korisnik postavi kratko pitanje poput "ok", "može", "napiši", "objasni", "nastavi", "hvala" pretpostavi da se odnosi na prethodnu temu i nastavi razgovor smisleno.
- Odgovaraj prirodno, jasno i korisno, bez nepotrebnog ponavljanja.
- Ne odgovaraj na pitanja o programiranju, hakiranju ili tehničkim zloupotrebama.
- Ako pitanje nije povezano sa sadržajem stranice, pokušaj ga blago usmjeriti nazad na temu stranice.
- Odgovaraj na istom jeziku kojim se korisnik obraća.
- ako korisnik ponovi isto pitanje ljubazno ga usmjeri na drugu temu.

- Answer in ${languageLabel}
`.trim();
}

function buildUserPrompt(payload) {
  const headingsText = Array.isArray(payload.headings) ? payload.headings.join(' | ') : '';
  const historyText = Array.isArray(payload.history) && payload.history.length
    ? payload.history
        .slice(-2)
        .map((item) => `${item.role}: ${item.content}`)
        .join('\n')
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

function scorePageForMessage(page, message) {
  const text = String(message || '').toLowerCase();
  if (!text) return 0;

const title = String(page.page_title || '').toLowerCase();
const meta = String(page.meta_description || '').toLowerCase();
const h1 = String(page.h1 || '').toLowerCase();
const headings = safeJsonArray(page.headings).join(' ').toLowerCase();
const links = safeJsonArray(page.internal_links)
  .map((link) => ((link && link.text) || '') + ' ' + ((link && link.href) || ''))
  .join(' ')
  .toLowerCase();
const content = '';

  let score = 0;
  const words = text.split(/\s+/).filter(Boolean);

  for (const word of words) {
    if (word.length < 2) continue;
    if (title.includes(word)) score += 5;
    if (h1.includes(word)) score += 4;
    if (headings.includes(word)) score += 3;
    if (meta.includes(word)) score += 2;
    if (links.includes(word)) score += 1;
    if (content.includes(word)) score += 6;
  }

  return score;
}

function scoreLinkMatch(link, message) {
  const text = String(message || '').toLowerCase();
  if (!text) return 0;

  const linkText = String(link && link.text ? link.text : '').toLowerCase();
  const linkHref = String(link && link.href ? link.href : '').toLowerCase();

  let score = 0;
  const words = text.split(/\s+/).filter(Boolean);

  for (const word of words) {
    if (word.length < 2) continue;
    if (linkText.includes(word)) score += 5;
    if (linkHref.includes(word)) score += 3;
  }

  return score;
}

function pickRelevantCrawledPages(rows, message, limit = 3) {
  const scored = (rows || [])
    .map((row) => ({
      ...row,
      _score: scorePageForMessage(row, message)
    }))
    .sort((a, b) => b._score - a._score);

  const useful = scored.filter((row) => row._score > 0).slice(0, limit);
  if (useful.length) return useful;

  return scored.slice(0, limit);
}

function findRelevantLinkCandidates(rows, message, limit = 3) {
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
      const score = scoreLinkMatch(link, message);
      const href = String(link && link.href ? link.href : '').trim();
      const title = String(link && link.text ? link.text : '').trim() || href;

      if (score > 0 && href) {
        matches.push({
          title,
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

  let crawledRows = [];

  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('url, page_title, meta_description, h1, headings, internal_links, text_preview, content')
      .eq('agent_id', agentId);

    if (!error && Array.isArray(data)) {
      crawledRows = data;
    }
  } catch (e) {
    crawledRows = [];
  }

  const relevantPages = pickRelevantCrawledPages(crawledRows, message, 3);
  const linkCandidates = findRelevantLinkCandidates(crawledRows, message, 3);

  const hasStrongCurrentPageContent = pageText.length > 180 || pageContext.length > 180;
  const hasStrongRelevantContent = Array.isArray(relevantPages) && relevantPages.some((row) => {
    const content = String(row.content || row.text_preview || '');
    return content.trim().length > 180 && scorePageForMessage(row, message) >= 4;
  });

  if (!hasStrongCurrentPageContent && !hasStrongRelevantContent && linkCandidates.length > 0) {
    return res.status(200).json({
      reply: buildLinkSuggestionReply(language, linkCandidates)
    });
  }

  let crawlContext = '';

  try {
    const rowsToUse = Array.isArray(relevantPages) && relevantPages.length
      ? relevantPages
      : crawledRows.slice(0, 3);

    if (rowsToUse.length > 0) {
      const shortRows = rowsToUse.map((row) => {
        const headingsValue = safeJsonArray(row.headings);
        const linksValue = safeJsonArray(row.internal_links);

        return {
          url: row.url || '',
          page_title: row.page_title || '',
          meta_description: row.meta_description || '',
          h1: row.h1 || '',
          headings: headingsValue.slice(0, 8),
          internal_links: linksValue.slice(0, 12),
          text_preview: limitText(row.text_preview || '', 1000),
          content: limitText(row.content || '', 2500)
        };
      });

      crawlContext = JSON.stringify(shortRows, null, 2);
    }
  } catch (e) {
    crawlContext = '';
  }

  const languageLabel = getLanguageLabel(language);
  const systemPrompt = buildAdaptiveSystemPrompt(languageLabel);

  const userPrompt = buildUserPrompt({
    message,
    pageTypeHint,
    language,
    pageTitle,
    pageDescription,
    pageUrl,
    h1,
    headings,
    pageContext,
    pageText,
    crawlContext,
    history
  });

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
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
