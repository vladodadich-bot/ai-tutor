import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

function cleanText(html) {
  return String(html || '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cleanText(match ? match[1] : '');
}

function extractMetaDescription(html) {
  const str = String(html || '');
  const match1 = str.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i);
  if (match1 && match1[1]) return match1[1].trim();

  const match2 = str.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  if (match2 && match2[1]) return match2[1].trim();

  return '';
}

function extractHeadings(html) {
  const matches = String(html || '').match(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/gi) || [];
  return matches
    .map(item => cleanText(item))
    .filter(Boolean)
    .slice(0, 15);
}

function extractLinks(html, baseOrigin) {
  const regex = /href=["']([^"'#]+)["']/gi;
  const links = [];
  let match;

  while ((match = regex.exec(String(html || ''))) !== null) {
    try {
      const absolute = new URL(match[1], baseOrigin).toString();

      if (!absolute.startsWith(baseOrigin)) continue;
      if (absolute.includes('/search')) continue;
      if (absolute.includes('/feeds')) continue;
      if (absolute.includes('/wp-json')) continue;
      if (/\.(jpg|jpeg|png|gif|webp|pdf|xml|zip|mp4|mp3)$/i.test(absolute)) continue;

      if (!links.includes(absolute)) {
        links.push(absolute);
      }
    } catch {
      // ignore
    }
  }

  return links;
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 SiteMindAI/1.0'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch page: ' + response.status);
  }

  return response.text();
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
    const url = body.url;
    const agent_id = body.agent_id;

    if (!url || !agent_id) {
      return res.status(400).json({ error: 'Missing url or agent_id' });
    }

    const startUrl = normalizeUrl(url);
    const baseOrigin = new URL(startUrl).origin;

    const firstHtml = await fetchPage(startUrl);
    const discoveredLinks = extractLinks(firstHtml, baseOrigin);
    const urlsToCrawl = [startUrl].concat(discoveredLinks.slice(0, 8));

    const rows = [];

    for (const pageUrl of urlsToCrawl) {
      try {
        const html = await fetchPage(pageUrl);
        const title = extractTitle(html);
        const metaDescription = extractMetaDescription(html);
        const headings = extractHeadings(html);
        const internalLinks = extractLinks(html, baseOrigin).slice(0, 20);
        const textPreview = cleanText(html).slice(0, 1200);

        rows.push({
          agent_id: agent_id,
          url: pageUrl,
          content: textPreview,
          page_title: title,
          meta_description: metaDescription,
          h1: headings[0] || '',
          headings: JSON.stringify(headings),
          internal_links: JSON.stringify(internalLinks),
          text_preview: textPreview
        });
      } catch (err) {
        console.error('Page crawl failed:', pageUrl, err.message);
      }
    }

    if (!rows.length) {
      return res.status(500).json({ error: 'No pages crawled successfully' });
    }

    const { error: deleteError } = await supabase
      .from('site_content')
      .delete()
      .eq('agent_id', agent_id);

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    const { error: insertError } = await supabase
      .from('site_content')
      .insert(rows);

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    return res.status(200).json({
      success: true,
      agent_id: agent_id,
      start_url: startUrl,
      pages_crawled: rows.length
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Unknown crawl error'
    });
  }
}
