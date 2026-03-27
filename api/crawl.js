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
    .replace(/&gt;/gi, '>')
    .trim();
}

function stripTags(html) {
  let text = String(html || '');

  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  text = text.replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  text = text.replace(/<img[^>]*>/gi, ' ');
  text = text.replace(/<[^>]+>/g, '\n');

  text = decodeHtml(text);

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      if (line.length < 25) return false;

      if (line.startsWith('@')) return false;
      if (line.includes('{') || line.includes('}')) return false;
      if (line.includes('function(') || line.includes('function ')) return false;
      if (line.includes('=>')) return false;
      if (line.includes('var ') || line.includes('let ') || line.includes('const ')) return false;
      if (line.includes('.wp-') || line.includes('--wp--')) return false;
      if (line.includes('charset')) return false;
      if (
        line.includes('display:') ||
        line.includes('font-size:') ||
        line.includes('margin:') ||
        line.includes('padding:')
      ) return false;

      if (/^[.#][a-z0-9\-_]+/i.test(line)) return false;
      if (/^[a-z\-]+\s*:/i.test(line) && line.length < 120) return false;

      const specialChars = (line.match(/[:;{}<>]/g) || []).length;
      if (specialChars > 8) return false;

      return true;
    });

  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

function extractTagContent(html, tagName) {
  const openTag = '<' + tagName;
  const closeTag = '</' + tagName + '>';
  const lowerHtml = String(html || '');
  const start = lowerHtml.toLowerCase().indexOf(openTag.toLowerCase());

  if (start === -1) return '';

  const openEnd = lowerHtml.indexOf('>', start);
  if (openEnd === -1) return '';

  const end = lowerHtml.toLowerCase().indexOf(closeTag.toLowerCase(), openEnd);
  if (end === -1) return '';

  return stripTags(lowerHtml.slice(openEnd + 1, end));
}

function extractMetaDescription(html) {
  const str = String(html || '');
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i
  ];

  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match && match[1]) return decodeHtml(match[1]);
  }

  return '';
}

function extractHeadings(html) {
  const str = String(html || '');
  const regex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  const headings = [];
  let match;

  while ((match = regex.exec(str)) !== null) {
    const text = stripTags(match[1]);
    if (text && !headings.includes(text)) {
      headings.push(text);
    }
  }

  return headings.slice(0, 20);
}

function extractLinks(html, baseOrigin) {
  const str = String(html || '');
  const regex = /href=["']([^"'#]+)["']/gi;
  const found = new Set();
  let match;

  while ((match = regex.exec(str)) !== null) {
    const raw = match[1];

    try {
      const absolute = new URL(raw, baseOrigin).toString();
      const normalized = normalizeUrl(absolute);

      if (!normalized.startsWith(baseOrigin)) continue;

      if (
        normalized.includes('/search') ||
        normalized.includes('/feeds') ||
        normalized.includes('/?m=1') ||
        normalized.includes('/wp-json') ||
        normalized.includes('/tag/') ||
        normalized.includes('/category/') ||
        normalized.includes('/author/') ||
        normalized.includes('/page/') ||
        /\.(jpg|jpeg|png|webp|gif|pdf|xml|zip|mp4|mp3)$/i.test(normalized)
      ) {
        continue;
      }

      found.add(normalized);
    } catch {
      // ignore bad URLs
    }
  }

  return Array.from(found);
}

function extractTextPreview(html) {
  return stripTags(html).slice(0, 1200);
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 SiteMindAI/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }

  return await response.text();
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

    const startHtml = await fetchPage(startUrl);
    const discoveredLinks = extractLinks(startHtml, baseOrigin);
    const urlsToCrawl = [startUrl, ...discoveredLinks.filter(link => link !== startUrl).slice(0, 12)];

    const rows = [];
    const crawledUrls = [];

    for (const pageUrl of urlsToCrawl) {
      try {
        const html = await fetchPage(pageUrl);

        const pageTitle = extractTagContent(html, 'title');
        const metaDescription = extractMetaDescription(html);
        const headings = extractHeadings(html);
        const internalLinks = extractLinks(html, baseOrigin).slice(0, 30);
        const textPreview = extractTextPreview(html);
        const h1 = headings[0] || '';

        rows.push({
          agent_id,
          url: pageUrl,
          content: textPreview,
          page_title: pageTitle,
          meta_description: metaDescription,
          h1,
          headings: JSON.stringify(headings),
          internal_links: JSON.stringify(internalLinks),
          text_preview: textPreview
        });

        crawledUrls.push(pageUrl);
      } catch (err) {
        console.error('Error crawling page:', pageUrl, err.message);
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
      agent_id,
      start_url: startUrl,
      pages_crawled: rows.length,
      crawled_urls: crawledUrls
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Unknown crawl error'
    });
  }
}
