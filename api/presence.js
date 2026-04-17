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
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ];

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
          last_seen_at: now
        },
        {
          onConflict: 'agent_id,session_id'
        }
      );

    if (error) {
      console.error('Presence error:', error);
      return res.status(500).json({ error: 'Database error', details: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Presence crash:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
