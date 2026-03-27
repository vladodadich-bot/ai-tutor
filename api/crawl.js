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
  return decodeHtml(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<img[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function extractTagContent(html, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = html.match(regex);
  return stripTags(match?.[1] || '');
}

function extractMetaDescription(html) {
  const match =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);

  return decodeHtml(match?.[1] || '');
}

function extractHeadings(html) {
  const regex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  const headings = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    const text = stripTags(match[1]);
    if (text && !headings.includes(text)) {
      headings.push(text);
    }
  }

  return headings.slice(0, 20);
}

function extractLinks(html, baseOrigin) {
  const regex = /href=["']([^"'#]+)["']/gi;
  const found = new Set();
  let match;

  while ((match = regex.exec(html)) !== null) {
    const raw = match[1];

    try {
      const absolute = new URL(raw, baseOrigin).toString();
      const normalized = normalizeUrl(absolute);

      if (!normalized.startsWith(baseOrigin)) continue;
      if (
        normalized.includes('/search') ||
        normalized.includes('/feeds') ||
        normalized.includes('/?m=1') ||
        normalized.match(/\.(jpg|jpeg|png|webp|gif|pdf|xml|zip)$/i)
      ) {
        continue;
      }

      found.add(normalized);
    } catch {
      // ignore
    }
  }

  return Array.from(found);
}

function extractTextPreview(html) {
  const text = stripTags(html);
  return text.slice(0, 1200);
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url, agent_id } = req.body || {};

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

    const { error } = await supabase.from('site_content').insert(rows);

    if (error) {
      return res.status(500).json({ error: error.message });
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
