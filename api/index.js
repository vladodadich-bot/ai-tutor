import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';

const MAX_CRAWL_PAGES = 20;
const FETCH_TIMEOUT_MS = 10000;
const MAX_RELEVANT_PAGES = 5;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function json(res, status, data) {
  return res.status(status).json(data);
}

function cleanText(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function uniqueStrings(arr) {
  return Array.from(
    new Set(
      (arr || [])
        .map(v => String(v || '').trim())
        .filter(Boolean)
    )
  );
}

function normalizeUrl(input) {
  try {
    return new URL(String(input || '').trim()).toString();
  } catch {
    return '';
  }
}

function getOrigin(input) {
  try {
    return new URL(String(input || '').trim()).origin;
  } catch {
    return '';
  }
}

function makeAbsoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return '';
  }
}

function shouldSkipLink(urlObj) {
  const href = urlObj.toString().toLowerCase();

  if (
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  ) {
    return true;
  }

  if (
    href.endsWith('.jpg') ||
    href.endsWith('.jpeg') ||
    href.endsWith('.png') ||
    href.endsWith('.gif') ||
    href.endsWith('.webp') ||
    href.endsWith('.svg') ||
    href.endsWith('.pdf') ||
    href.endsWith('.zip') ||
    href.endsWith('.rar') ||
    href.endsWith('.css') ||
    href.endsWith('.js') ||
    href.endsWith('.xml') ||
    href.endsWith('.json')
  ) {
    return true;
  }

  return false;
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(cleanText(match[1])) : '';
}

function extractMetaDescription(html) {
  const match =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i);

  return match ? decodeHtmlEntities(cleanText(match[1])) : '';
}

function extractFirstTag(html, tagName) {
  const regex = new RegExp('<' + tagName + '[^>]*>([\\s\\S]*?)<\\/' + tagName + '>', 'i');
  const match = html.match(regex);
  return match ? decodeHtmlEntities(cleanText(match[1])) : '';
}

function extractAllTags(html, tagName) {
  const regex = new RegExp('<' + tagName + '[^>]*>([\\s\\S]*?)<\\/' + tagName + '>', 'gi');
  const out = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    const text = decodeHtmlEntities(cleanText(match[1]));
    if (text) out.push(text);
  }

  return uniqueStrings(out);
}

function extractLinks(html, pageUrl, rootOrigin) {
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const results = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    const rawHref = String(match[1] || '').trim();
    const rawText = decodeHtmlEntities(cleanText(match[2] || ''));

    if (!rawHref) continue;

    const abs = makeAbsoluteUrl(rawHref, pageUrl);
    if (!abs) continue;

    let urlObj;
    try {
      urlObj = new URL(abs);
    } catch {
      continue;
    }

    if (urlObj.origin !== rootOrigin) continue;
    if (shouldSkipLink(urlObj)) continue;

    urlObj.hash = '';

    results.push({
      text: rawText,
      href: urlObj.toString()
    });
  }

  const seen = new Set();

  return results.filter(link => {
    const key = link.href + '__' + link.text;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'SiteMindAI/1.0' },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error('Failed to fetch website: ' + response.status);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function crawlSite(startUrl) {
  const rootUrl = normalizeUrl(startUrl);
  const rootOrigin = getOrigin(rootUrl);

  const queue = [rootUrl];
  const visited = new Set();
  const discovered = new Set([rootUrl]);
  const pages = [];

  while (queue.length > 0 && pages.length < MAX_CRAWL_PAGES) {
    const currentUrl = queue.shift();
    if (!currentUrl || visited.has(currentUrl)) continue;

    visited.add(currentUrl);

    try {
      const html = await fetchHtml(currentUrl);

      const title = extractTitle(html);
      const metaDescription = extractMetaDescription(html);
      const h1 = extractFirstTag(html, 'h1');
      const h2 = extractAllTags(html, 'h2');
      const links = extractLinks(html, currentUrl, rootOrigin);

      pages.push({
        url: currentUrl,
        page_title: title,
        meta_description: metaDescription,
        h1,
        headings: h2,
        internal_links: links,
        text_preview: JSON.stringify({
          title,
          description: metaDescription,
          h1,
          h2,
          links: links.slice(0, 25)
        })
      });

      for (const link of links) {
        if (!discovered.has(link.href) && pages.length + queue.length < MAX_CRAWL_PAGES * 3) {
          discovered.add(link.href);
          queue.push(link.href);
        }
      }
    } catch (err) {
      pages.push({
        url: currentUrl,
        page_title: '',
        meta_description: '',
        h1: '',
        headings: [],
        internal_links: [],
        text_preview: JSON.stringify({
          error: err.message || 'Failed to crawl page'
        })
      });
    }
  }

  return pages;
}

function asArray(value) {
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

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s-]/gi, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t && t.length > 1);
}

function scorePageAgainstQuestion(page, question) {
  const qTokens = tokenize(question);
  if (!qTokens.length) return 0;

  const title = String(page.page_title || '').toLowerCase();
  const desc = String(page.meta_description || '').toLowerCase();
  const h1 = String(page.h1 || '').toLowerCase();
  const headings = asArray(page.headings).join(' ').toLowerCase();
  const links = asArray(page.internal_links)
    .map(l => (l.text || '') + ' ' + (l.href || ''))
    .join(' ')
    .toLowerCase();

  let score = 0;

  for (const token of qTokens) {
    if (title.includes(token)) score += 6;
    if (h1.includes(token)) score += 5;
    if (headings.includes(token)) score += 4;
    if (desc.includes(token)) score += 3;
    if (links.includes(token)) score += 2;
  }

  return score;
}

function pickRelevantPages(rows, question) {
  const scored = (rows || [])
    .map(page => ({
      ...page,
      _score: scorePageAgainstQuestion(page, question)
    }))
    .sort((a, b) => b._score - a._score);

  const filtered = scored.filter(p => p._score > 0).slice(0, MAX_RELEVANT_PAGES);
  return filtered.length ? filtered : scored.slice(0, Math.min(MAX_RELEVANT_PAGES, scored.length));
}

function buildChatMessages(systemPrompt, history, userMessage, siteContext) {
  const input = [];

  input.push({
    role: 'system',
    content: [{ type: 'input_text', text: systemPrompt }]
  });

  input.push({
    role: 'system',
    content: [
      {
        type: 'input_text',
        text: 'Website context:\n' + JSON.stringify(siteContext, null, 2)
      }
    ]
  });

  const safeHistory = Array.isArray(history) ? history.slice(-8) : [];

  for (const item of safeHistory) {
    const isAssistant = item && item.role === 'assistant';
    const role = isAssistant ? 'assistant' : 'user';
    const text = String(item && item.content ? item.content : '').trim();

    if (!text) continue;

    input.push({
      role,
      content: [
        {
          type: isAssistant ? 'output_text' : 'input_text',
          text
        }
      ]
    });
  }

  input.push({
    role: 'user',
    content: [{ type: 'input_text', text: String(userMessage || '') }]
  });

  return input;
}

  const safeHistory = Array.isArray(history) ? history.slice(-8) : [];

  for (const item of safeHistory) {
    const role = item && item.role === 'assistant' ? 'assistant' : 'user';
    const text = String(item && item.content ? item.content : '').trim();
    if (!text) continue;

    input.push({
      role,
      content: [{ type: 'input_text', text }]
    });
  }

  input.push({
    role: 'user',
    content: [{ type: 'input_text', text: String(userMessage || '') }]
  });

  return input;
}

async function callOpenAI(input) {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error && data.error.message ? data.error.message : 'OpenAI request failed');
  }

  const outputText = String(data.output_text || '').trim();

  if (outputText) return outputText;

  try {
    const parts = [];
    const output = Array.isArray(data.output) ? data.output : [];

    for (const item of output) {
      const content = Array.isArray(item.content) ? item.content : [];
      for (const c of content) {
        if (c.type === 'output_text' && c.text) parts.push(c.text);
      }
    }

    return parts.join('\n').trim() || 'No response generated.';
  } catch {
    return 'No response generated.';
  }
}

async function handleCreateAgent(req, res, body) {
  const agentName = String(body.agentName || body.agent_name || 'My Agent').trim();
  const welcomeMessage = String(body.welcomeMessage || body.welcome_message || 'Hi! How can I help?').trim();
  const themeColor = String(body.themeColor || body.theme_color || '#2563eb').trim();
  const siteDomain = String(body.siteDomain || body.site_domain || '').trim();

  if (!siteDomain) {
    return json(res, 400, { error: 'Missing siteDomain' });
  }

  const agentId = 'agent_' + Math.random().toString(36).slice(2, 10);

  const { data, error } = await supabase
    .from('agents')
    .insert({
      agent_id: agentId,
      agent_name: agentName,
      welcome_message: welcomeMessage,
      theme_color: themeColor,
      site_domain: siteDomain
    })
    .select()
    .single();

  if (error) {
    return json(res, 500, { error: error.message });
  }

  return json(res, 200, {
    success: true,
    agentId: data.agent_id,
    agentName: data.agent_name,
    welcomeMessage: data.welcome_message,
    themeColor: data.theme_color,
    siteDomain: data.site_domain
  });
}

async function handleAgentConfig(req, res, body) {
  const agentId = String(body.agentId || body.agent_id || req.query.agentId || '').trim();

  if (!agentId) {
    return json(res, 400, { error: 'Missing agentId' });
  }

  const { data, error } = await supabase
    .from('agents')
    .select('agent_id, agent_name, welcome_message, theme_color, site_domain')
    .eq('agent_id', agentId)
    .single();

  if (error || !data) {
    return json(res, 404, { error: 'Agent not found' });
  }

  return json(res, 200, {
    agentId: data.agent_id,
    agentName: data.agent_name,
    welcomeMessage: data.welcome_message,
    themeColor: data.theme_color,
    siteDomain: data.site_domain
  });
}

async function handleCrawlSite(req, res, body) {
  const url = String(body.url || '').trim();
  const agentId = String(body.agentId || body.agent_id || '').trim();

  if (!url || !agentId) {
    return json(res, 400, { error: 'Missing url or agentId' });
  }

  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    return json(res, 400, { error: 'Invalid URL' });
  }

  const pages = await crawlSite(normalizedUrl);

  const rows = pages.map(page => ({
    agent_id: agentId,
    url: page.url,
    content: '',
    page_title: page.page_title || '',
    meta_description: page.meta_description || '',
    h1: page.h1 || '',
    headings: page.headings || [],
    internal_links: page.internal_links || [],
    text_preview: page.text_preview || ''
  }));

  const deleteResult = await supabase
    .from('site_content')
    .delete()
    .eq('agent_id', agentId);

  if (deleteResult.error) {
    return json(res, 500, { error: deleteResult.error.message });
  }

  if (rows.length > 0) {
    const insertResult = await supabase
      .from('site_content')
      .insert(rows);

    if (insertResult.error) {
      return json(res, 500, { error: insertResult.error.message });
    }
  }

  return json(res, 200, {
    success: true,
    message: 'Crawl saved',
    pagesCrawled: rows.length
  });
}

async function handleChat(req, res, body) {
  const agentId = String(body.agentId || body.agent_id || '').trim();
  const message = String(body.message || '').trim();
  const history = Array.isArray(body.history) ? body.history : [];
  const pageTitle = String(body.pageTitle || '').trim();
  const pageDescription = String(body.pageDescription || '').trim();
  const pageUrl = String(body.pageUrl || '').trim();

  if (!agentId || !message) {
    return json(res, 400, { error: 'Missing agentId or message' });
  }

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('agent_id, agent_name, welcome_message, theme_color, site_domain')
    .eq('agent_id', agentId)
    .single();

  if (agentError || !agent) {
    return json(res, 404, { error: 'Agent not found' });
  }

  const allowedOrigin = getOrigin(agent.site_domain);
  const currentOrigin = getOrigin(pageUrl);

  if (allowedOrigin && currentOrigin && allowedOrigin !== currentOrigin) {
    return json(res, 403, { error: 'Domain not allowed' });
  }

  const { data: siteRows, error: siteError } = await supabase
    .from('site_content')
    .select('url, page_title, meta_description, h1, headings, internal_links')
    .eq('agent_id', agentId);

  if (siteError) {
    return json(res, 500, { error: siteError.message });
  }

  const relevantPages = pickRelevantPages(siteRows || [], message);

  const siteContext = {
    agent: {
      name: agent.agent_name || 'SiteMind AI',
      welcomeMessage: agent.welcome_message || ''
    },
    currentPage: {
      title: pageTitle,
      description: pageDescription,
      url: pageUrl
    },
    relevantPages: relevantPages.map(p => ({
      url: p.url,
      title: p.page_title || '',
      description: p.meta_description || '',
      h1: p.h1 || '',
      h2: asArray(p.headings),
      links: asArray(p.internal_links).slice(0, 20)
    }))
  };

  const systemPrompt =
    'You are SiteMind AI, a helpful website assistant.\n\n' +
    'You answer using only:\n' +
    '- the user question\n' +
    '- recent conversation history\n' +
    '- the provided crawled website structure\n\n' +
    'The crawl contains only:\n' +
    '- page titles\n' +
    '- meta descriptions\n' +
    '- h1 headings\n' +
    '- h2 headings\n' +
    '- internal links with anchor text\n\n' +
    'Rules:\n' +
    '1. Do not invent page content that is not clearly supported by the crawl data.\n' +
    '2. If the answer is visible from titles, headings, or link text, answer clearly.\n' +
    '3. If a relevant page exists, include the best matching full link.\n' +
    '4. If the crawl data is not enough, say that honestly.\n' +
    '5. Keep the answer concise, natural, and useful.\n' +
    '6. Never claim you read the full page text if only headings and links are available.\n' +
    '7. Reply in the same language as the user message.\n';

  const input = buildChatMessages(systemPrompt, history, message, siteContext);
  const answer = await callOpenAI(input);

  return json(res, 200, {
    reply: answer
  });
}
async function handleGetAgents(req, res, body) {
  const siteDomain = String(body.siteDomain || body.site_domain || '').trim();

  let query = supabase
    .from('agents')
    .select('agent_id, agent_name, welcome_message, theme_color, site_domain, created_at')
    .order('created_at', { ascending: false });

  if (siteDomain) {
    query = query.eq('site_domain', siteDomain);
  }

  const { data, error } = await query;

  if (error) {
    return json(res, 500, { error: error.message });
  }

  return json(res, 200, {
    success: true,
    agents: data || []
  });
}

async function handleUpdateAgent(req, res, body) {
  const agentId = String(body.agentId || body.agent_id || '').trim();

  if (!agentId) {
    return json(res, 400, { error: 'Missing agentId' });
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
    return json(res, 400, { error: 'No fields to update' });
  }

  const { data, error } = await supabase
    .from('agents')
    .update(updates)
    .eq('agent_id', agentId)
    .select('agent_id, agent_name, welcome_message, theme_color, site_domain')
    .single();

  if (error) {
    return json(res, 500, { error: error.message });
  }

  return json(res, 200, {
    success: true,
    agent: data
  });
}

async function handleDeleteAgent(req, res, body) {
  const agentId = String(body.agentId || body.agent_id || '').trim();

  if (!agentId) {
    return json(res, 400, { error: 'Missing agentId' });
  }

  const deleteSiteContent = await supabase
    .from('site_content')
    .delete()
    .eq('agent_id', agentId);

  if (deleteSiteContent.error) {
    return json(res, 500, { error: deleteSiteContent.error.message });
  }

  const deleteAgent = await supabase
    .from('agents')
    .delete()
    .eq('agent_id', agentId);

  if (deleteAgent.error) {
    return json(res, 500, { error: deleteAgent.error.message });
  }

  return json(res, 200, {
    success: true,
    deletedAgentId: agentId
  });
}
export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = req.body || {};
    const action = String(body.action || req.query.action || '').trim();

    if (!action) {
      return json(res, 400, { error: 'Missing action' });
    }

    if (action === 'create-agent') {
      return await handleCreateAgent(req, res, body);
    }

    if (action === 'agent-config') {
      return await handleAgentConfig(req, res, body);
    }

    if (action === 'crawl-site') {
      return await handleCrawlSite(req, res, body);
    }

    if (action === 'chat') {
      return await handleChat(req, res, body);
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
    return json(res, 404, { error: 'Unknown action' });
  } catch (err) {
    return json(res, 500, {
      error: err.message || 'Unknown server error'
    });
  }
}
