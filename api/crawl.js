import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url, agent_id } = req.body || {};

    if (!url || !agent_id) {
      return res.status(400).json({ error: 'Missing url or agent_id' });
    }

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to fetch URL' });
    }

    const html = await response.text();
    const content = extractText(html).slice(0, 20000);

    const { error } = await supabase.from('site_content').insert({
      agent_id,
      url,
      content
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      url,
      agent_id,
      content_length: content.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
