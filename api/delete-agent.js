import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { agent_id } = req.body;

  const { error } = await supabase
    .from('agents')
    .delete()
    .eq('agent_id', agent_id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json({ success: true });
}
