import { createClient } from '@supabase/supabase-js';

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
// AGENT CONFIG - START
// ========================================

async function handleAgentConfig(req, res, body) {
  const query = req.query || {};
  const agentId = String(body.agentId || body.agent_id || query.agentId || '').trim();

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }

  return res.status(200).json({
    agentId: agentId,
    agentName: 'Test Agent',
    welcomeMessage: 'Hello from config',
    themeColor: '#2563eb',
    siteDomain: 'https://example.com'
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

  const systemPrompt =
    'You are SiteMind AI, a helpful website assistant. ' +
    'Answer based only on the provided page information. ' +
    'Be clear, short, and useful. ' +
    'If the answer is not clearly available from the page data, say that honestly. ' +
    'Reply in the same language as the user.';

  const pageInfo =
    'Page title: ' + (pageTitle || 'N/A') + '\n' +
    'Page description: ' + (pageDescription || 'N/A') + '\n' +
    'Page URL: ' + (pageUrl || 'N/A') + '\n' +
    'Page context:\n' + (pageContext || 'N/A');

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
    if (req.method === 'GET' && query.testCreate === '1') {
  return await handleCreateAgent(req, res, {
    agentName: 'Test Agent',
    welcomeMessage: 'Hello from SiteMind',
    themeColor: '#2563eb',
    siteDomain: 'https://example.com'
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
