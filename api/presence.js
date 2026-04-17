import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function applyCors(req, res) {
  const origin = req.headers.origin || '';

  const allowedOrigins = [
    'https://www.lektirko.com',
    'https://lektirko.com',
    'https://www.zusammenfassung24.de',
    'https://zusammenfassung24.de',
    'https://sitemindai.app',
    'https://www.sitemindai.app',
    'https://popustolovac.com',
    'https://www.popustolovac.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ];

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const agentId = req.query.agentId || null;

      if (!agentId) {
        return res.status(400).json({ success: false, error: 'Missing agentId' });
      }

      const cutoffIso = new Date(Date.now() - 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('live_presence')
        .select('agent_id, session_id, page_url, page_title, user_agent, city, country, last_seen_at')
        .eq('agent_id', agentId)
        .gte('last_seen_at', cutoffIso)
        .order('last_seen_at', { ascending: false })
        .limit(12);

      if (error) {
        console.error('Presence GET error:', error);
        return res.status(500).json({
          success: false,
          error: 'Database error',
          details: error.message
        });
      }

      return res.status(200).json({
        success: true,
        visitors: Array.isArray(data) ? data : []
      });
    } catch (err) {
      console.error('Presence GET crash:', err);
      return res.status(500).json({ success: false, error: 'Server error' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      agent_id,
      session_id,
      page_url,
      page_title,
      user_agent
    } = req.body || {};

    if (!agent_id || !session_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const city = req.headers['x-vercel-ip-city'] || null;
    const country = req.headers['x-vercel-ip-country'] || null;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('live_presence')
      .upsert(
        {
          agent_id,
          session_id,
          page_url: page_url || null,
          page_title: page_title || null,
          user_agent: user_agent || null,
          city: city || null,
          country: country || null,
          last_seen_at: now
        },
        {
          onConflict: 'agent_id,session_id'
        }
      );

    if (error) {
      console.error('Presence POST error:', error);
      return res.status(500).json({ error: 'Database error', details: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Presence POST crash:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
