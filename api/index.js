import { createClient } from '@supabase/supabase-js';
import { crawlSinglePage } from '../lib/crawl.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);
// ========================================
// CREATE AGENT - START
// ========================================

async function handleCreateAgent(req, res, body) {
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
    .eq('agent_id', agentId);

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
// CRAWL SITE - START
// ========================================

async function handleCrawlSite(req, res, body) {
  const url = String(body.url || '').trim();
  const agentId = String(body.agentId || body.agent_id || '').trim();

  if (!url || !agentId) {
    return res.status(400).json({ error: 'Missing url or agentId' });
  }

  if (!process.env.SUPABASE_URL) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY' });
  }

  try {
    const page = await crawlSinglePage(url);

    const deleteResult = await supabase
      .from('site_content')
      .delete()
      .eq('agent_id', agentId);

    if (deleteResult.error) {
      return res.status(500).json({ error: deleteResult.error.message });
    }

    const insertResult = await supabase
      .from('site_content')
      .insert({
        agent_id: agentId,
        url: page.url,
        content: '',
        page_title: page.page_title || '',
        meta_description: page.meta_description || '',
        h1: page.h1 || '',
        headings: JSON.stringify(page.headings || []),
        internal_links: JSON.stringify(page.internal_links || []),
        text_preview: page.text_preview || ''
      });

    if (insertResult.error) {
      return res.status(500).json({ error: insertResult.error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Crawl saved',
      pagesCrawled: 1
    });
  } catch (err) {
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

function extractResponseText(data) {
  if (data && typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const parts = [];
  const output = Array.isArray(data && data.output) ? data.output : [];

  for (const item of output) {
    const content = Array.isArray(item && item.content) ? item.content : [];
    for (const block of content) {
      if (block && block.type === 'output_text' && typeof block.text === 'string') {
        parts.push(block.text);
      }
    }
  }

  return parts.join('\n').trim();
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
    .map(link => ((link && link.text) || '') + ' ' + ((link && link.href) || ''))
    .join(' ')
    .toLowerCase();

  let score = 0;
  const words = text.split(/\s+/).filter(Boolean);

  for (const word of words) {
    if (word.length < 2) continue;
    if (title.includes(word)) score += 5;
    if (h1.includes(word)) score += 4;
    if (headings.includes(word)) score += 3;
    if (meta.includes(word)) score += 2;
    if (links.includes(word)) score += 1;
  }

  return score;
}

function pickRelevantCrawledPages(rows, message, limit = 3) {
  const scored = (rows || [])
    .map(row => ({
      ...row,
      _score: scorePageForMessage(row, message)
    }))
    .sort((a, b) => b._score - a._score);

  const useful = scored.filter(row => row._score > 0).slice(0, limit);
  if (useful.length) return useful;

  return scored.slice(0, limit);
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
  const pageTitle = String(body.pageTitle || '').trim();
  const pageDescription = String(body.pageDescription || '').trim();
  const pageUrl = String(body.pageUrl || '').trim();
  const pageContext = String(body.pageContext || '').trim().slice(0, 3000);

  if (!agentId || !message) {
    return res.status(400).json({ error: 'Missing agentId or message' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
  }
  let crawledRows = [];

  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('url, page_title, meta_description, h1, headings, internal_links')
      .eq('agent_id', agentId);

    if (!error && Array.isArray(data)) {
      crawledRows = data;
    }
  } catch (e) {
    crawledRows = [];
  }

  const relevantPages = pickRelevantCrawledPages(crawledRows, message, 3);
  const systemPrompt =
    'You are SiteMind AI, a helpful website assistant. ' +
    'Answer based only on the provided page information. ' +
    'Be clear, short, and useful. ' +
    'If the answer is not clearly available from the page data, say that honestly. ' +
    'Reply in the same language as the user.';

  let crawlContext = '';

try {
  const { data: crawledRows, error: crawlError } = await supabase
    .from('site_content')
    .select('url, page_title, meta_description, h1, headings, internal_links')
    .eq('agent_id', agentId)
    .limit(5);

  if (!crawlError && Array.isArray(crawledRows) && crawledRows.length > 0) {
    const shortRows = crawledRows.map(function (row) {
      let headings = [];
      let links = [];

      try {
        headings = Array.isArray(row.headings) ? row.headings : JSON.parse(row.headings || '[]');
      } catch (e) {
        headings = [];
      }

      try {
        links = Array.isArray(row.internal_links) ? row.internal_links : JSON.parse(row.internal_links || '[]');
      } catch (e) {
        links = [];
      }

      return {
        url: row.url || '',
        page_title: row.page_title || '',
        meta_description: row.meta_description || '',
        h1: row.h1 || '',
        headings: headings.slice(0, 8),
        internal_links: links.slice(0, 12)
      };
    });

    crawlContext = JSON.stringify(shortRows, null, 2);
  }
} catch (e) {
  crawlContext = '';
}
  const pageInfo =
  'Page title: ' + (pageTitle || 'N/A') + '\n' +
  'Page description: ' + (pageDescription || 'N/A') + '\n' +
  'Page URL: ' + (pageUrl || 'N/A') + '\n' +
  'Page context:\n' + (pageContext || 'N/A') + '\n\n' +
  'Crawled site data:\n' + (crawlContext || 'N/A');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
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
                text: pageInfo
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: message
              }
            ]
          }
        ]
      })
    });

    const rawText = await response.text();

    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      return res.status(500).json({
        error: 'OpenAI did not return JSON',
        details: rawText.slice(0, 500)
      });
    }

    if (!response.ok) {
      return res.status(500).json({
        error: data.error && data.error.message ? data.error.message : 'OpenAI request failed',
        details: data
      });
    }

    const reply = extractResponseText(data);

    if (!reply) {
      return res.status(500).json({
        error: 'No reply generated',
        details: JSON.stringify(data).slice(0, 1200)
      });
    }

    return res.status(200).json({
      reply: reply
    });
  } catch (err) {
    return res.status(500).json({
      error: err && err.message ? err.message : 'Chat request failed'
    });
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
  res.setHeader('Access-Control-Allow-Headers', '*');
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
if (req.method === 'GET' && query.ping === '1') {
  return res.status(200).json({ ok: true, message: 'index alive' });
}
if (req.method === 'GET' && query.testCrawl === '1') {
  return await handleCrawlSite(req, res, {
    url: 'https://njemacki2.blogspot.com/',
    agentId: 'agent_ji9hsuvk'
  });
}
    // ========================================
    // ACTION ROUTING - START
    // ========================================

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
    // ========================================
    // ACTION ROUTING - END
    // ========================================

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
