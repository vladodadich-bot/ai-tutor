import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
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

    // UPSERT (insert or update)
    const { error } = await supabase
      .from('live_presence')
      .upsert(
        {
          agent_id,
          session_id,
          page_url,
          page_title,
          user_agent,
          last_seen_at: now
        },
        {
          onConflict: 'agent_id,session_id'
        }
      );

    if (error) {
      console.error('Presence error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Presence crash:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
