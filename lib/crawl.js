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
      if (cleaned.length > 300) return cleaned;
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
  if (content) return limitWords(content, maxWords);

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

function isLikelyFilePath(pathname) {
  return /\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|rar|css|js|xml|json|mp4|mp3|avi|woff2?|ttf|eot|ico)$/i.test(pathname);
}

function isHardBlockedUrl(urlObj) {
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
    pathname.includes('/wp-admin') ||
    pathname.includes('/wp-login') ||
    pathname.includes('/cart') ||
    pathname.includes('/checkout') ||
    pathname.includes('/my-account') ||
    pathname.includes('/account') ||
    pathname.includes('/login') ||
    pathname.includes('/register')
  ) {
    return true;
  }

  if (
    search.includes('showcomment=') ||
    search.includes('comment=') ||
    search.includes('replytocom=') ||
    search.includes('fbclid=') ||
    search.includes('gclid=') ||
    search.includes('utm_') ||
    search.includes('sort=') ||
    search.includes('filter=') ||
    search.includes('orderby=') ||
    search.includes('add-to-cart=')
  ) {
    return true;
  }

  if (isLikelyFilePath(pathname)) return true;

  return false;
}

function isListingLikeUrl(urlObj) {
  const pathname = urlObj.pathname.toLowerCase();
  const search = urlObj.search.toLowerCase();

  return (
    pathname === '/' ||
    pathname === '/search' ||
    pathname.startsWith('/search/') ||
    pathname.includes('/tag/') ||
    pathname.includes('/category/') ||
    pathname.includes('/author/') ||
    pathname.includes('/label/') ||
    /\/page\/\d+\/?$/.test(pathname) ||
    search.includes('updated-max=') ||
    search.includes('max-results=') ||
    search.includes('page=')
  );
}

function looksLikeContentUrl(urlObj) {
  const href = urlObj.toString().toLowerCase();
  const pathname = urlObj.pathname.toLowerCase();

  if (/\/20\d{2}\//.test(href)) return true;
  if (href.includes('.html')) return true;
  if (href.includes('/p/')) return true;

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 2 && !isListingLikeUrl(urlObj)) return true;

  return false;
}

export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';

    const paramsToDelete = [];
    u.searchParams.forEach((_, key) => {
      const k = String(key || '').toLowerCase();
      if (
        k.startsWith('utm_') ||
        k === 'fbclid' ||
        k === 'gclid' ||
        k === 'm' ||
        k === 'replytocom'
      ) {
        paramsToDelete.push(key);
      }
    });

    for (const key of paramsToDelete) {
      u.searchParams.delete(key);
    }

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
  if (text.length > 12) score += 1;
  if (text.length > 30) score += 1;

  if (/\/20\d{2}\//.test(href)) score += 14;
  if (href.includes('.html')) score += 10;
  if (href.includes('/p/')) score += 9;

  if (/\/page\/\d+/.test(href)) score += 3;
  if (href.includes('/label/')) score += 2;
  if (href.includes('/category/')) score += 2;
  if (href.includes('updated-max=')) score += 4;
  if (href.includes('max-results=')) score += 3;

  if (
    text.includes('home') ||
    text.includes('start') ||
    text.includes('kontakt') ||
    text.includes('contact') ||
    text.includes('impressum') ||
    text.includes('datenschutz') ||
    text.includes('privacy') ||
    text.includes('terms')
  ) {
    score -= 3;
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

    if (!rawHref || rawHref.startsWith('#')) continue;

    const abs = makeAbsoluteUrl(rawHref, pageUrl);
    if (!abs) continue;

    let urlObj;
    try {
      urlObj = new URL(abs);
    } catch {
      continue;
    }

    if (urlObj.origin !== rootOrigin) continue;
    if (isHardBlockedUrl(urlObj)) continue;

    urlObj.hash = '';

    const normalized = normalizeUrl(urlObj.toString());
    if (!normalized) continue;

    results.push({
      text: rawText,
      href: normalized
    });
  }

  const deduped = [];
  const seen = new Set();

  for (const link of results) {
    if (!link.href || seen.has(link.href)) continue;
    seen.add(link.href);
    deduped.push(link);
  }

  const contentLinks = [];
  const listingLinks = [];

  for (const link of deduped) {
    try {
      const urlObj = new URL(link.href);
      if (looksLikeContentUrl(urlObj)) {
        contentLinks.push(link);
      } else {
        listingLinks.push(link);
      }
    } catch {
      continue;
    }
  }

  contentLinks.sort((a, b) => scoreInternalLink(b) - scoreInternalLink(a));
  listingLinks.sort((a, b) => scoreInternalLink(b) - scoreInternalLink(a));

  return [
    ...contentLinks.slice(0, 80),
    ...listingLinks.slice(0, 25)
  ];
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SiteMindAI/1.0'
      },
      signal: controller.signal,
      redirect: 'follow'
    });

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();

    if (!response.ok) {
      throw new Error('Failed to fetch website: ' + response.status);
    }

    if (!contentType.includes('text/html')) {
      throw new Error('Skipped non-HTML content');
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function detectPageKind(url) {
  try {
    const urlObj = new URL(url);
    return isListingLikeUrl(urlObj) ? 'listing' : 'content';
  } catch {
    return 'content';
  }
}

async function crawlPage(url, rootOrigin) {
  const normalizedUrl = normalizeUrl(url);
  const html = await fetchHtml(normalizedUrl);

  const title = extractTitle(html);
  const metaDescription = extractMetaDescription(html);
  const h1 = extractFirstTag(html, 'h1');
  const h2 = extractAllTags(html, 'h2');
  const textPreview = extractTextPreview(html, 70);
  const content = extractMainContent(html);
  const discoveredLinks = extractLinks(html, normalizedUrl, rootOrigin);
  const pageKind = detectPageKind(normalizedUrl);

  return {
    url: normalizedUrl,
    page_title: title,
    meta_description: metaDescription,
    h1,
    headings: h2,
    text_preview: textPreview,
    content,
    page_kind: pageKind,
    _discoveredLinks: discoveredLinks
  };
}

function scoreQueueUrl(url, startUrl) {
  const href = String(url || '').toLowerCase();
  const start = String(startUrl || '').toLowerCase();

  let score = 0;

  if (href === start) score += 100;
  if (/\/20\d{2}\//.test(href)) score += 18;
  if (href.includes('.html')) score += 12;
  if (href.includes('/p/')) score += 10;
  if (href.split('/').length >= 5) score += 4;

  if (/\/page\/\d+/.test(href)) score += 2;
  if (href.includes('/label/')) score += 1;
  if (href.includes('/category/')) score += 1;
  if (href.includes('updated-max=')) score += 4;
  if (href.includes('max-results=')) score += 3;

  if (
    href.endsWith('/impressum') ||
    href.endsWith('/datenschutz') ||
    href.endsWith('/kontakt') ||
    href.endsWith('/privacy') ||
    href.endsWith('/terms') ||
    href.endsWith('/register') ||
    href.endsWith('/login')
  ) {
    score -= 10;
  }

  return score;
}

function createQueueEntry(url, startUrl) {
  return {
    url,
    priority: scoreQueueUrl(url, startUrl)
  };
}

async function runWithConcurrency(items, worker, concurrency = 6) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];

  const safeConcurrency = Math.max(1, Math.min(Number(concurrency) || 1, 12));
  const results = new Array(list.length);
  let currentIndex = 0;

  async function runner() {
    while (true) {
      const index = currentIndex;
      currentIndex += 1;

      if (index >= list.length) return;
      results[index] = await worker(list[index], index);
    }
  }

  const runners = [];
  for (let i = 0; i < safeConcurrency; i += 1) {
    runners.push(runner());
  }

  await Promise.all(runners);
  return results;
}

export async function crawlSinglePage(url) {
  const startUrl = normalizeUrl(url);

  if (!startUrl) {
    throw new Error('Invalid crawl URL');
  }

  const rootOrigin = new URL(startUrl).origin;
  const MAX_PAGES = 250;
  const CONCURRENCY = 6;

  const crawledPages = [];
  const visited = new Set();
  const queued = new Set([startUrl]);
  let queue = [createQueueEntry(startUrl, startUrl)];

  while (queue.length > 0 && crawledPages.length < MAX_PAGES) {
    queue.sort((a, b) => b.priority - a.priority);

    const capacity = MAX_PAGES - crawledPages.length;
    const batchSize = Math.min(queue.length, CONCURRENCY, capacity);
    const batch = queue.splice(0, batchSize);

    const batchResults = await runWithConcurrency(
      batch,
      async (entry) => {
        const currentUrl = normalizeUrl(entry && entry.url ? entry.url : '');

        if (!currentUrl || visited.has(currentUrl)) return null;

        visited.add(currentUrl);

        try {
          const page = await crawlPage(currentUrl, rootOrigin);
          return { ok: true, page };
        } catch (err) {
          console.error('CRAWL PAGE ERROR:', currentUrl, err && err.message ? err.message : err);
          return { ok: false, url: currentUrl };
        }
      },
      CONCURRENCY
    );

    for (const item of batchResults) {
      if (!item || !item.ok || !item.page) continue;

      const page = item.page;

      crawledPages.push({
        url: page.url,
        page_title: page.page_title,
        meta_description: page.meta_description,
        h1: page.h1,
        headings: page.headings,
        text_preview: page.text_preview,
        content: page.content,
        page_kind: page.page_kind
      });

      const nextLinks = Array.isArray(page._discoveredLinks) ? page._discoveredLinks : [];

      for (const link of nextLinks) {
        const href = normalizeUrl(link && link.href ? link.href : '');
        if (!href) continue;
        if (visited.has(href)) continue;
        if (queued.has(href)) continue;

        queued.add(href);
        queue.push(createQueueEntry(href, startUrl));
      }

      if (crawledPages.length >= MAX_PAGES) break;
    }
  }

  if (!crawledPages.length) {
    throw new Error('No pages could be crawled');
  }

  return crawledPages;
}

export async function crawlBatchPages(urls, rootOrigin) {
  const safeUrls = Array.isArray(urls) ? urls : [];
  const normalizedUrls = [];
  const seen = new Set();

  for (const rawUrl of safeUrls) {
    const currentUrl = normalizeUrl(rawUrl);
    if (!currentUrl) continue;
    if (seen.has(currentUrl)) continue;
    seen.add(currentUrl);
    normalizedUrls.push(currentUrl);
  }

  const batchResults = await runWithConcurrency(
    normalizedUrls,
    async (currentUrl) => {
      try {
        const page = await crawlPage(currentUrl, rootOrigin);

        return {
          url: page.url,
          page_title: page.page_title,
          meta_description: page.meta_description,
          h1: page.h1,
          headings: page.headings,
          text_preview: page.text_preview,
          content: page.content,
          page_kind: page.page_kind,
          internal_links: Array.isArray(page._discoveredLinks) ? page._discoveredLinks : []
        };
      } catch (err) {
        return {
          url: currentUrl,
          error: err && err.message ? err.message : 'Failed to crawl page',
          internal_links: []
        };
      }
    },
    6
  );

  return Array.isArray(batchResults) ? batchResults.filter(Boolean) : [];
}
