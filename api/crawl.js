import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

const MAX_PAGES = 20;
const FETCH_TIMEOUT_MS = 10000;

function stripTags(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function uniqueStrings(arr) {
  return Array.from(
    new Set(
      (arr || [])
        .map(v => String(v || '').trim())
        .filter(Boolean)
    )
  );
}

function absoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function shouldSkipUrl(urlObj) {
  const href = urlObj.toString().toLowerCase();

  if (
    href.includes('#') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  ) {
    return true;
  }

  if (
    href.endsWith('.jpg') ||
    href.endsWith('.jpeg') ||
    href.endsWith('.png') ||
    href.endsWith('.gif') ||
    href.endsWith('.webp') ||
    href.endsWith('.svg') ||
    href.endsWith('.pdf') ||
    href.endsWith('.zip') ||
    href.endsWith('.rar') ||
    href.endsWith('.css') ||
    href.endsWith('.js') ||
    href.endsWith('.xml') ||
    href.endsWith('.json')
  ) {
    return true;
  }

  return false;
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(stripTags(match[1])) : '';
}

function extractMetaDescription(html) {
  const match =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i);

  return match ? decodeHtmlEntities(stripTags(match[1])) : '';
}

function extractFirstTag(html, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = html.match(regex);
  return match ? decodeHtmlEntities(stripTags(match[1])) : '';
}

function extractAllTags(html, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  const results = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    const text = decodeHtmlEntities(stripTags(match[1]));
    if (text) results.push(text);
  }

  return uniqueStrings(results);
}

function extractLinks(html, pageUrl, rootOrigin) {
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const results = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    const rawHref = String(match[1] || '').trim();
    const rawText = decodeHtmlEntities(stripTags(match[2] || ''));

    if (!rawHref) continue;

    const abs = absoluteUrl(rawHref, pageUrl);
    if (!abs) continue;

    let urlObj;
    try {
      urlObj = new URL(abs);
    } catch {
      continue;
    }

    if (urlObj.origin !== rootOrigin) continue;
    if (shouldSkipUrl(urlObj)) continue;

    urlObj.hash = '';

    const finalHref = urlObj.toString();
    const text = rawText.trim();

    results.push({
      text,
      href: finalHref
    });
  }

  const seen = new Set();
  return results.filter(link => {
    const key = `${link.href}__${link.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SiteMindAI/1.0'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function crawlSite(startUrl) {
  const root = new URL(startUrl);
  const rootOrigin = root.origin;

  const queue = [root.toString()];
  const visited = new Set();
  const pages = [];
  const discoveredLinks = new Set();

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const currentUrl = queue.shift();
    if (!currentUrl || visited.has(currentUrl)) continue;

    visited.add(currentUrl);

    try {
      const html = await fetchHtml(currentUrl);

      const title = extractTitle(html);
      const metaDescription = extractMetaDescription(html);
      const h1 = extractFirstTag(html, 'h1');
      const h2 = extractAllTags(html, 'h2');
      const links = extractLinks(html, currentUrl, rootOrigin);

      pages.push({
        url: currentUrl,
        title,
        meta_description: metaDescription,
        h1,
        h2,
        links
      });

      for (const link of links) {
        if (!visited.has(link.href) && !discoveredLinks.has(link.href)) {
          discoveredLinks.add(link.href);
          queue.push(link.href);
        }
      }
    } catch (err) {
      pages.push({
        url: currentUrl,
        title: '',
        meta_description: '',
        h1: '',
        h2: [],
        links: [],
        error: err.message || 'Failed to crawl page'
      });
    }
  }

  return pages;
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
    const url = String(body.url || '').trim();
    const agent_id = String(body.agent_id || '').trim();

    if (!url || !agent_id) {
      return res.status(400).json({ error: 'Missing url or agent_id' });
    }

    let normalizedUrl;
    try {
      normalizedUrl = new URL(url).toString();
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const crawledPages = await crawlSite(normalizedUrl);

    const rows = crawledPages.map(page => ({
      agent_id,
      url: page.url,
      content: '',
      page_title: page.title || '',
      meta_description: page.meta_description || '',
      h1: page.h1 || '',
      headings: page.h2 || [],
      internal_links: page.links || [],
      text_preview: JSON.stringify({
        title: page.title || '',
        h1: page.h1 || '',
        h2: page.h2 || [],
        links: (page.links || []).slice(0, 20)
      })
    }));

    const deleteResult = await supabase
      .from('site_content')
      .delete()
      .eq('agent_id', agent_id);

    if (deleteResult.error) {
      return res.status(500).json({ error: deleteResult.error.message });
    }

    if (rows.length > 0) {
      const insertResult = await supabase
        .from('site_content')
        .insert(rows);

      if (insertResult.error) {
        return res.status(500).json({ error: insertResult.error.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Crawl saved',
      pages_crawled: rows.length
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Unknown crawl error'
    });
  }
}
