import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.SUPABASE_URL) {
      return res.status(500).json({ error: 'Missing SUPABASE_URL' });
    }

    if (!process.env.SUPABASE_KEY) {
      return res.status(500).json({ error: 'Missing SUPABASE_KEY' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data || []);
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Unknown server error'
    });
  }
}
