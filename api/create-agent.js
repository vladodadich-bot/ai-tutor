import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

function generateAgentId() {
  return 'agent_' + Math.random().toString(36).slice(2, 10);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};

    const agent_name = (body.agent_name || '').trim();
    const site_domain = (body.site_domain || '').trim();
    const welcome_message = (body.welcome_message || 'Bok! Kako ti mogu pomoći?').trim();
    const theme_color = (body.theme_color || '#2563eb').trim();
    const system_prompt = (body.system_prompt || 'Ti si SiteMind AI asistent za web stranicu.').trim();
    const allow_external_search = body.allow_external_search === true;

    if (!agent_name || !site_domain) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const agent_id = generateAgentId();

    const { data, error } = await supabase
      .from('agents')
      .insert({
        agent_id,
        agent_name,
        welcome_message,
        theme_color,
        site_domain,
        system_prompt,
        allow_external_search
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      agent_id: data.agent_id,
      embed_code: `<script src="https://ai-tutor-rouge-theta.vercel.app/sitemind-embed.js" data-agent-id="${data.agent_id}"></script>`
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Server error'
    });
  }
}
