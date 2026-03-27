import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

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
    const url = body.url;
    const agent_id = body.agent_id;

    if (!url || !agent_id) {
      return res.status(400).json({ error: 'Missing url or agent_id' });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SiteMindAI'
      }
    });

    if (!response.ok) {
      return res.status(500).json({
        error: 'Failed to fetch website: ' + response.status
      });
    }

    const html = await response.text();
    const preview = String(html || '').slice(0, 2000);

    const { error: deleteError } = await supabase
      .from('site_content')
      .delete()
      .eq('agent_id', agent_id);

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    const { error: insertError } = await supabase
      .from('site_content')
      .insert({
        agent_id: agent_id,
        url: url,
        content: preview,
        page_title: '',
        meta_description: '',
        h1: '',
        headings: '[]',
        internal_links: '[]',
        text_preview: preview
      });

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Crawl saved',
      length: preview.length
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Unknown crawl error'
    });
  }
}
