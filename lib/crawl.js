// lib/crawl.js

export async function crawlSite(startUrl, maxPages = 10) {
  const visited = new Set();
  const queue = [normalizeUrl(startUrl)];
  const results = [];

  const startDomain = getHostname(startUrl);

  while (queue.length > 0 && results.length < maxPages) {
    const currentUrl = queue.shift();
    if (!currentUrl || visited.has(currentUrl)) continue;

    visited.add(currentUrl);

    try {
      const res = await fetch(currentUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SiteMindAI/1.0; +https://sitemindai.app)"
        }
      });

      if (!res.ok) continue;

      const html = await res.text();
      if (!html || html.length < 100) continue;

      const pageData = extractBasicPageData(html, currentUrl, startDomain);
      results.push(pageData);

      for (const link of pageData.internal_links) {
        if (!visited.has(link) && !queue.includes(link) && results.length + queue.length < maxPages * 3) {
          queue.push(link);
        }
      }
    } catch (err) {
      console.error("Crawl error:", currentUrl, err.message);
    }
  }

  return results;
}

function extractBasicPageData(html, pageUrl, startDomain) {
  const cleanHtml = String(html || "");

  const pageTitle = extractTitle(cleanHtml);
  const metaDescription = extractMetaDescription(cleanHtml);
  const h1 = extractFirstTagText(cleanHtml, "h1");
  const headings = extractHeadings(cleanHtml);
  const internalLinks = extractInternalLinks(cleanHtml, pageUrl, startDomain);

  return {
    url: pageUrl,
    page_title: pageTitle || "",
    meta_description: metaDescription || "",
    h1: h1 || "",
    headings,
    internal_links: internalLinks
  };
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cleanText(match?.[1] || "");
}

function extractMetaDescription(html) {
  const match =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i);

  return cleanText(match?.[1] || "");
}

function extractFirstTagText(html, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = html.match(regex);
  return cleanText(stripHtml(match?.[1] || ""));
}

function extractHeadings(html) {
  const matches = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];

  const headings = matches
    .map(match => cleanText(stripHtml(match[1] || "")))
    .filter(Boolean)
    .filter(isUsefulHeading)
    .slice(0, 250);

  return uniqueArray(headings);
}

function extractInternalLinks(html, pageUrl, startDomain) {
  const matches = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>/gi)];

  const links = matches
    .map(match => match[1])
    .map(href => toAbsoluteUrl(href, pageUrl))
    .filter(Boolean)
    .filter(link => isInternalLink(link, startDomain))
    .filter(isUsefulInternalLink)
    .slice(0, 30);

  return uniqueArray(links);
}

function isUsefulHeading(text) {
  if (!text) return false;

  const t = text.toLowerCase().trim();

  if (t.length < 2) return false;

  const blocked = [
    "noviji",
    "stariji",
    "početna",
    "home",
    "menu",
    "izbornik",
    "istaknuti post",
    "popular posts",
    "related posts"
  ];

  return !blocked.includes(t);
}

function isUsefulInternalLink(url) {
  if (!url) return false;

  const lower = url.toLowerCase();

  if (
    lower.includes("/search") ||
    lower.includes("/tag/") ||
    lower.includes("/labels/") ||
    lower.includes("/feeds/") ||
    lower.includes("/p/uvjeti") ||
    lower.includes("/p/privacy") ||
    lower.includes("/p/terms") ||
    lower.includes("/p/contact") ||
    lower.includes("/wp-admin") ||
    lower.includes("/login")
  ) {
    return false;
  }

  if (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".pdf") ||
    lower.endsWith(".xml")
  ) {
    return false;
  }

  return true;
}

function isInternalLink(url, startDomain) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === startDomain;
  } catch {
    return false;
  }
}

function toAbsoluteUrl(href, baseUrl) {
  try {
    return normalizeUrl(new URL(href, baseUrl).toString());
  } catch {
    return null;
  }
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";

    if (u.pathname !== "/" && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }

    return u.toString();
  } catch {
    return url;
  }
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(value) {
  return decodeHtmlEntities(
    String(value || "")
      .replace(/\s+/g, " ")
      .replace(/\u00a0/g, " ")
      .trim()
  );
}

function uniqueArray(arr) {
  return [...new Set(arr.filter(Boolean))];
}
