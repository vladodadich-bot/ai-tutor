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

function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
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
      // ignore bad URLs
    }
  }

  return Array.from(found);
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

    // 1. Fetch početne stranice
    const startHtml = await fetchPage(startUrl);

    // 2. Nađi interne linkove
    const links = extractLinks(startHtml, baseOrigin);

    // 3. Uzmi početni URL + prvih nekoliko internih linkova
    const urlsToCrawl = [startUrl, ...links.filter(link => link !== startUrl).slice(0, 8)];

    let combinedContent = '';
    const crawledUrls = [];

    for (const pageUrl of urlsToCrawl) {
      try {
        const pageHtml = await fetchPage(pageUrl);
        const pageText = extractText(pageHtml).slice(0, 5000);

        if (!pageText) continue;

        combinedContent += `\n\n--- PAGE: ${pageUrl} ---\n\n${pageText}`;
        crawledUrls.push(pageUrl);
      } catch (err) {
        console.error('Error crawling page:', pageUrl, err.message);
      }
    }

    if (!combinedContent.trim()) {
      return res.status(500).json({ error: 'No content extracted from crawled pages' });
    }

    const { error } = await supabase.from('site_content').insert({
      agent_id,
      url: startUrl,
      content: combinedContent.slice(0, 50000)
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      agent_id,
      url: startUrl,
      pages_crawled: crawledUrls.length,
      crawled_urls: crawledUrls,
      content_length: combinedContent.length
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Unknown crawl error'
    });
  }
}
