function cleanText(value) {
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

function makeAbsoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return '';
  }
}

function shouldSkipLink(urlObj) {
  const href = urlObj.toString().toLowerCase();

  if (href.startsWith('mailto:') || href.startsWith('tel:')) {
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
      href: urlObj.toString()
    });
  }

  const seen = new Set();

  return results.filter(link => {
    const key = link.href + '__' + link.text;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function crawlSinglePage(url) {
  const normalizedUrl = new URL(url).toString();
  const rootOrigin = new URL(normalizedUrl).origin;

  const response = await fetch(normalizedUrl, {
    headers: {
      'User-Agent': 'SiteMindAI/1.0'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch website: ' + response.status);
  }

  const html = await response.text();

  const title = extractTitle(html);
  const metaDescription = extractMetaDescription(html);
  const h1 = extractFirstTag(html, 'h1');
  const h2 = extractAllTags(html, 'h2');
  const links = extractLinks(html, normalizedUrl, rootOrigin);

  return {
    url: normalizedUrl,
    page_title: title,
    meta_description: metaDescription,
    h1: h1,
    headings: h2,
    internal_links: links,
    text_preview: JSON.stringify({
      title,
      meta_description: metaDescription,
      h1,
      h2,
      links: links.slice(0, 25)
    })
  };
}
