function cleanText(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
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
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
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

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(cleanText(match[1])) : '';
}

function extractMetaDescription(html) {
  const match =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i);

  return match ? decodeHtmlEntities(cleanText(match[1])) : '';
}

function extractFirstTag(html, tagName) {
  const regex = new RegExp('<' + tagName + '[^>]*>([\\s\\S]*?)<\\/' + tagName + '>', 'i');
  const match = html.match(regex);
  return match ? decodeHtmlEntities(cleanText(match[1])) : '';
}

function extractAllTags(html, tagName) {
  const regex = new RegExp('<' + tagName + '[^>]*>([\\s\\S]*?)<\\/' + tagName + '>', 'gi');
  const out = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    const text = decodeHtmlEntities(cleanText(match[1]));
    if (text) out.push(text);
  }

  return uniqueStrings(out);
}

function extractTextPreview(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const raw = bodyMatch ? bodyMatch[1] : html;
  return decodeHtmlEntities(cleanText(raw)).slice(0, 3000);
}

function makeAbsoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return '';
  }
}

function shouldSkipLink(urlObj) {
  const href = urlObj.toString().toLowerCase();

  if (
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('javascript:')
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
    href.endsWith('.json') ||
    href.endsWith('.mp4') ||
    href.endsWith('.mp3') ||
    href.endsWith('.avi') ||
    href.endsWith('.woff') ||
    href.endsWith('.woff2') ||
    href.endsWith('.ttf')
  ) {
    return true;
  }

  return false;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function extractLinks(html, pageUrl, rootOrigin) {
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const results = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    const rawHref = String(match[1] || '').trim();
    const rawText = decodeHtmlEntities(cleanText(match[2] || ''));

    if (!rawHref) continue;

    const abs = makeAbsoluteUrl(rawHref, pageUrl);
    if (!abs) continue;

    let urlObj;
    try {
      urlObj = new URL(abs);
    } catch {
      continue;
    }

    if (urlObj.origin !== rootOrigin) continue;
    if (shouldSkipLink(urlObj)) continue;

    urlObj.hash = '';

    results.push({
      text: rawText,
      href: normalizeUrl(urlObj.toString())
    });
  }

  const seen = new Set();

  return results.filter(link => {
    if (!link.href) return false;
    if (seen.has(link.href)) return false;
    seen.add(link.href);
    return true;
  });
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'SiteMindAI/1.0'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch website: ' + response.status);
  }

  return await response.text();
}

async function crawlPage(url, rootOrigin) {
  const normalizedUrl = normalizeUrl(url);
  const html = await fetchHtml(normalizedUrl);

  const title = extractTitle(html);
  const metaDescription = extractMetaDescription(html);
  const h1 = extractFirstTag(html, 'h1');
  const h2 = extractAllTags(html, 'h2');
  const links = extractLinks(html, normalizedUrl, rootOrigin);
  const textPreview = extractTextPreview(html);

  return {
    url: normalizedUrl,
    page_title: title,
    meta_description: metaDescription,
    h1: h1,
    headings: h2,
    internal_links: links,
    text_preview: textPreview
  };
}

export async function crawlSinglePage(url) {
  const startUrl = normalizeUrl(url);
  const rootOrigin = new URL(startUrl).origin;

  const MAX_PAGES = 9; // homepage + 8 internal pages
  const crawledPages = [];
  const visited = new Set();
  const queue = [startUrl];

  while (queue.length > 0 && crawledPages.length < MAX_PAGES) {
    const currentUrl = normalizeUrl(queue.shift());

    if (!currentUrl || visited.has(currentUrl)) {
      continue;
    }

    visited.add(currentUrl);

    try {
      const page = await crawlPage(currentUrl, rootOrigin);
      crawledPages.push(page);

      const nextLinks = Array.isArray(page.internal_links) ? page.internal_links : [];

      for (const link of nextLinks) {
        const href = normalizeUrl(link && link.href ? link.href : '');
        if (!href) continue;
        if (visited.has(href)) continue;
        if (queue.includes(href)) continue;
        queue.push(href);
      }
    } catch (err) {
      // preskoči stranicu koja ne može biti dohvaćena
      continue;
    }
  }

  if (!crawledPages.length) {
    throw new Error('No pages could be crawled');
  }

  return crawledPages;
}
