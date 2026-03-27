import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

function decodeHtml(str) {
  return String(str || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function cleanText(html) {
  let text = String(html || '');

  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ');
  text = text.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, ' ');
  text = text.replace(/<img[^>]*>/gi, ' ');
  text = text.replace(/<[^>]+>/g, '\n');

  text = decodeHtml(text);

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      if (line.length < 25) return false;

      const lower = line.toLowerCase();

      if (line.startsWith('@')) return false;
      if (line.includes('{') || line.includes('}')) return false;
      if (line.includes('function(') || line.includes('function ')) return false;
      if (line.includes('=>')) return false;
      if (line.includes('var ') || line.includes('let ') || line.includes('const ')) return false;
      if (line.includes('.wp-') || line.includes('--wp--')) return false;
      if (line.includes('charset')) return false;

      if (
        lower.includes('display:') ||
        lower.includes('font-size:') ||
        lower.includes('margin:') ||
        lower.includes('padding:') ||
        lower.includes('background:') ||
        lower.includes('color:') ||
        lower.includes('border:')
      ) return false;

      if (/^[.#][a-z0-9\-_]+/i.test(line)) return false;
      if (/^[a-z\-]+\s*:/i.test(line) && line.length < 140) return false;

      const specialChars = (line.match(/[:;{}<>]/g) || []).length;
      if (specialChars > 8) return false;

      return true;
    });

  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

function extractTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cleanText(match ? match[1] : '');
}

function extractLinks(html, baseOrigin) {
  const regex = /href=["']([^"'#]+)["']/gi;
  const links = [];
  let match;

  while ((match = regex.exec(String(html || ''))) !== null) {
    try {
      const absolute = new URL(match[1], baseOrigin).toString();
      const normalized = normalizeUrl(absolute);

      if (!normalized.startsWith(baseOrigin)) continue;
      if (normalized.includes('/search')) continue;
      if (normalized.includes('/feeds')) continue;
      if (normalized.includes('/wp-json')) continue;
      if (normalized.includes('/tag/')) continue;
      if (normalized.includes('/category/')) continue;
      if (normalized.includes('/author/')) continue;
      if (/\.(jpg|jpeg|png|gif|webp|pdf|xml|zip|mp4|mp3)$/i.test(normalized)) continue;

      if (!links.includes(normalized)) {
        links.push(normalized);
      }
    } catch {
      // ignore invalid links
    }
  }

  return links;
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'SiteMindAI'
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

    const urlsToCrawl = [startUrl, ...discoveredLinks.filter(link => link !== startUrl).slice(0, 19)];

    const rows = [];

    for (const pageUrl of urlsToCrawl) {
      try {
        const html = await fetchPage(pageUrl);
        const title = extractTitle(html);
        const textPreview = cleanText(html).slice(0, 1500);

        rows.push({
          agent_id: agent_id,
          url: pageUrl,
          content: textPreview,
          page_title: title,
          meta_description: '',
          h1: '',
          headings: '[]',
          internal_links: '[]',
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
      pages_crawled: rows.length,
      crawled_urls: urlsToCrawl
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Unknown crawl error'
    });
  }
}
