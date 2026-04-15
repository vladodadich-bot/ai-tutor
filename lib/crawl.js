function cleanText(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<canvas[\s\S]*?<\/canvas>/gi, ' ')
    .replace(/<video[\s\S]*?<\/video>/gi, ' ')
    .replace(/<audio[\s\S]*?<\/audio>/gi, ' ')
    .replace(/<form[\s\S]*?<\/form>/gi, ' ')
    .replace(/<button[\s\S]*?<\/button>/gi, ' ')
    .replace(/<textarea[\s\S]*?<\/textarea>/gi, ' ')
    .replace(/<select[\s\S]*?<\/select>/gi, ' ')
    .replace(/<input[^>]*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/section>/gi, '\n')
    .replace(/<\/article>/gi, '\n')
    .replace(/<\/main>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '...')
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : _;
    });
}

function uniqueStrings(arr) {
  return Array.from(
    new Set(
      (arr || [])
        .map((v) => String(v || '').trim())
        .filter(Boolean)
    )
  );
}

function normalizeExtractedText(value, maxLength) {
  const text = decodeHtmlEntities(cleanText(value || ''));
  if (!maxLength || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim();
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizeExtractedText(match[1], 300) : '';
}

function extractMetaDescription(html) {
  const match =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i) ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i);

  return match ? normalizeExtractedText(match[1], 500) : '';
}

function extractFirstTag(html, tagName) {
  const regex = new RegExp('<' + tagName + '[^>]*>([\\s\\S]*?)<\\/' + tagName + '>', 'i');
  const match = html.match(regex);
  return match ? normalizeExtractedText(match[1], 300) : '';
}

function extractAllTags(html, tagName) {
  const regex = new RegExp('<' + tagName + '[^>]*>([\\s\\S]*?)<\\/' + tagName + '>', 'gi');
  const out = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    const text = normalizeExtractedText(match[1], 200);
    if (text) out.push(text);
  }

  return uniqueStrings(out);
}

function stripNoiseBlocks(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<canvas[\s\S]*?<\/canvas>/gi, ' ')
    .replace(/<video[\s\S]*?<\/video>/gi, ' ')
    .replace(/<audio[\s\S]*?<\/audio>/gi, ' ')
    .replace(/<form[\s\S]*?<\/form>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

function extractBodyHtml(html) {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
}

function extractByContainerPattern(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const cleaned = normalizeExtractedText(match[1], 25000);
      if (cleaned.length > 300) {
        return cleaned;
      }
    }
  }

  return '';
}

function extractMainContent(html) {
  const bodyHtml = stripNoiseBlocks(extractBodyHtml(html));

  const preferredPatterns = [
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*id=["'][^"']*\bpost-body\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id=["'][^"']*\bcontent\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*\bpost-body\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*\bentry-content\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*\bpost-content\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*\barticle-content\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*\barticle-body\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*\bmain-content\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*\bpage-content\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*\bpost hentry\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*\bitem-content\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*\bstory-body\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*\bcontent\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
  ];

  const preferred = extractByContainerPattern(bodyHtml, preferredPatterns);
  if (preferred) return preferred;

  return normalizeExtractedText(bodyHtml, 25000);
}

function limitWords(text, maxWords) {
  const words = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  if (!maxWords || words.length <= maxWords) {
    return words.join(' ');
  }

  return words.slice(0, maxWords).join(' ');
}

function extractTextPreview(html, maxWords = 70) {
  const content = extractMainContent(html);
  if (content) {
    return limitWords(content, maxWords);
  }

  const bodyHtml = extractBodyHtml(html);
  const fallbackText = normalizeExtractedText(bodyHtml, 6000);
  return limitWords(fallbackText, maxWords);
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
  const pathname = urlObj.pathname.toLowerCase();
  const search = urlObj.search.toLowerCase();

  if (
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('javascript:')
  ) {
    return true;
  }

  if (
    pathname === '' ||
    pathname === '/search' ||
    pathname.startsWith('/search/') ||
    pathname.includes('/wp-admin') ||
    pathname.includes('/wp-login') ||
    pathname.includes('/feed') ||
    pathname.includes('/tag/') ||
    pathname.includes('/category/') ||
    pathname.includes('/author/') ||
    pathname.includes('/label/')
  ) {
    return true;
  }

  if (
    search.includes('m=1') ||
    search.includes('updated-max=') ||
    search.includes('max-results=') ||
    search.includes('showcomment=') ||
    search.includes('comment=') ||
    search.includes('fbclid=') ||
    search.includes('utm_')
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
    if (u.pathname !== '/') {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }
    return u.toString();
  } catch {
    return '';
  }
}

function scoreInternalLink(link) {
  const href = String(link && link.href ? link.href : '').toLowerCase();
  const text = String(link && link.text ? link.text : '').toLowerCase();

  let score = 0;

  if (text) score += 2;
  if (text.length > 12) score += 2;
  if (text.length > 30) score += 1;
  if (href.split('/').length <= 7) score += 1;

  if (/\/20\d{2}\//.test(href)) score += 6;
  if (href.includes('.html')) score += 4;
  if (href.includes('/202')) score += 3;

  if (
    text.includes('zusammenfassung') ||
    text.includes('figuren') ||
    text.includes('analyse') ||
    text.includes('charakterisierung') ||
    text.includes('inhaltsangabe') ||
    text.includes('interpretation')
  ) {
    score += 3;
  }

  if (
    text.includes('home') ||
    text.includes('početna') ||
    text.includes('start')
  ) {
    score -= 3;
  }

  if (
    text.includes('kontakt') ||
    text.includes('contact') ||
    text.includes('impressum') ||
    text.includes('datenschutz') ||
    text.includes('privacy') ||
    text.includes('terms')
  ) {
    score -= 2;
  }

  return score;
}

function extractLinks(html, pageUrl, rootOrigin) {
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const results = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    const rawHref = String(match[1] || '').trim();
    const rawText = normalizeExtractedText(match[2] || '', 180);

    if (!rawHref) continue;
    if (rawHref.startsWith('#')) continue;

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

  return results
    .filter((link) => {
      if (!link.href) return false;
      if (seen.has(link.href)) return false;
      seen.add(link.href);
      return true;
    })
    .sort((a, b) => scoreInternalLink(b) - scoreInternalLink(a))
    .slice(0, 300);
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
  const textPreview = extractTextPreview(html, 70);
  const discoveredLinks = extractLinks(html, normalizedUrl, rootOrigin);

  return {
    url: normalizedUrl,
    page_title: title,
    meta_description: metaDescription,
    h1,
    headings: h2,
    text_preview: textPreview,
    _discoveredLinks: discoveredLinks
  };
}

function scoreQueueUrl(url, startUrl) {
  const href = String(url || '').toLowerCase();
  const start = String(startUrl || '').toLowerCase();

  let score = 0;

  if (href === start) score += 100;
  if (/\/20\d{2}\//.test(href)) score += 8;
  if (href.includes('.html')) score += 5;
  if (href.includes('zusammenfassung')) score += 4;
  if (href.includes('figuren')) score += 3;
  if (href.includes('analyse')) score += 3;
  if (href.includes('charakterisierung')) score += 3;
  if (href.includes('inhaltsangabe')) score += 3;

  if (
    href.endsWith('/impressum') ||
    href.endsWith('/datenschutz') ||
    href.endsWith('/kontakt') ||
    href.endsWith('/privacy') ||
    href.endsWith('/terms')
  ) {
    score -= 6;
  }

  return score;
}

export async function crawlSinglePage(url) {
  const startUrl = normalizeUrl(url);

  if (!startUrl) {
    throw new Error('Invalid crawl URL');
  }

  const rootOrigin = new URL(startUrl).origin;
  const MAX_PAGES = 250;
  const crawledPages = [];
  const visited = new Set();
  const queue = [startUrl];

  while (queue.length > 0 && crawledPages.length < MAX_PAGES) {
    queue.sort((a, b) => scoreQueueUrl(b, startUrl) - scoreQueueUrl(a, startUrl));

    const nextItem = queue.shift();
    const currentUrl = normalizeUrl(nextItem);

    if (!currentUrl || visited.has(currentUrl)) {
      continue;
    }

    visited.add(currentUrl);

    try {
      const page = await crawlPage(currentUrl, rootOrigin);

      crawledPages.push({
        url: page.url,
        page_title: page.page_title,
        meta_description: page.meta_description,
        h1: page.h1,
        headings: page.headings,
        text_preview: page.text_preview
      });

      const nextLinks = Array.isArray(page._discoveredLinks) ? page._discoveredLinks : [];

      for (const link of nextLinks) {
        const href = normalizeUrl(link && link.href ? link.href : '');
        if (!href) continue;
        if (visited.has(href)) continue;
        if (queue.includes(href)) continue;
        queue.push(href);
      }
    } catch (err) {
      console.error('CRAWL PAGE ERROR:', currentUrl, err && err.message ? err.message : err);
      continue;
    }
  }

  if (!crawledPages.length) {
    throw new Error('No pages could be crawled');
  }

  return crawledPages;
}
