import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { url } = req.body || {};

    if (!url) {
      return res.status(400).json({ ok: false, error: "Missing url" });
    }

    let startUrl;
    try {
      startUrl = new URL(url);
    } catch (e) {
      return res.status(400).json({ ok: false, error: "Invalid url" });
    }

    const origin = startUrl.origin;
    const visited = new Set();
    const pages = [];

    function normalizeUrl(raw, base) {
      try {
        const u = new URL(raw, base);

        if (u.protocol !== "http:" && u.protocol !== "https:") return null;
        if (u.origin !== origin) return null;

        u.hash = "";

        return u.toString();
      } catch (e) {
        return null;
      }
    }

    function extractTitle(html) {
      const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (!match) return "";
      return cleanText(match[1]).slice(0, 200);
    }

    function removeBlocks(html) {
      return html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
    }

    function decodeEntities(text) {
      return text
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">");
    }

    function cleanText(html) {
      const noBlocks = removeBlocks(html);
      const noTags = noBlocks.replace(/<[^>]+>/g, " ");
      const decoded = decodeEntities(noTags);
      return decoded.replace(/\s+/g, " ").trim();
    }

    function extractInternalLinks(html, baseUrl) {
      const links = [];
      const seen = new Set();
      const regex = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
      let match;

      while ((match = regex.exec(html)) !== null) {
        const href = (match[1] || "").trim();

        if (!href) continue;
        if (href.startsWith("mailto:")) continue;
        if (href.startsWith("tel:")) continue;
        if (href.startsWith("javascript:")) continue;

        const full = normalizeUrl(href, baseUrl);
        if (!full) continue;
        if (seen.has(full)) continue;

        seen.add(full);
        links.push(full);

        if (links.length >= 5) break;
      }

      return links;
    }

    async function fetchHtml(targetUrl) {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "SiteMindAI-Crawler/1.0"
        }
      });

      if (!response.ok) {
        throw new Error("Fetch failed: " + response.status);
      }

      return await response.text();
    }

    async function readPage(targetUrl) {
      if (visited.has(targetUrl)) return;
      visited.add(targetUrl);

      try {
        const html = await fetchHtml(targetUrl);
        const title = extractTitle(html) || targetUrl;
        const preview = cleanText(html).slice(0, 800);

        pages.push({
          url: targetUrl,
          title,
          preview
        });

        return html;
      } catch (e) {
        pages.push({
          url: targetUrl,
          title: targetUrl,
          preview: ""
        });

        return "";
      }
    }

    const homepageUrl = normalizeUrl(startUrl.toString(), origin);
    const homepageHtml = await readPage(homepageUrl);

    const internalLinks = extractInternalLinks(homepageHtml || "", homepageUrl);

    for (const link of internalLinks) {
      await readPage(link);
    }

    return res.status(200).json({
      ok: true,
      site: origin,
      pages
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Server error"
    });
  }
}
