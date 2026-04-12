import { createClient } from '@supabase/supabase-js';

const allowedOrigins = [
  'https://sitemindai.app',
  'https://www.sitemindai.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const PAGE_FETCH_TIMEOUT_MS = 12000;
const OPENAI_TIMEOUT_MS = 15000;
const OPENAI_CONTENT_LIMIT = 3500;

function applyCors(req, res) {
  const origin = req.headers.origin || '';
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function getBearerToken(req) {
  const authHeader =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    '';

  if (!authHeader || typeof authHeader !== 'string') return '';
  if (!authHeader.startsWith('Bearer ')) return '';

  return authHeader.slice(7).trim();
}

async function getAuthenticatedUser(req) {
  const token = getBearerToken(req);

  if (!token) {
    return { user: null, error: 'Missing Authorization bearer token' };
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return { user: null, error: 'Invalid or expired token' };
    }

    return { user: data.user, error: null };
  } catch {
    return { user: null, error: 'Failed to authenticate user' };
  }
}

function normalizeUrl(value = '') {
  try {
    const url = new URL(String(value).trim());
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function normalizeUiLanguage(lang = '') {
  const short = String(lang || '').toLowerCase().slice(0, 2);
  return ['en', 'de', 'fr', 'it', 'hr'].includes(short) ? short : 'en';
}

function stripHtml(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTagText(html, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? stripHtml(match[1]) : '';
}

function extractMeta(html, name) {
  const match = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'));
  return match?.[1] || '';
}

async function fetchSinglePage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) throw new Error(`Fetch failed ${res.status}`);

    const html = await res.text();

    return {
      url,
      raw_html: html,
      page_title: extractTagText(html, 'title'),
      meta_description: extractMeta(html, 'description'),
      h1: extractTagText(html, 'h1'),
      content: stripHtml(html)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildRuleAudit(page) {
  const titleLen = page.page_title.length;
  const metaLen = page.meta_description.length;

  return {
    score: Math.round((titleLen + metaLen) / 4),
    issues: [],
    quickFixes: [],
    page_speed: {},
    image_seo: {},
    technical_seo: {}
  };
}

async function callOpenAISeoAnalysis(page, ruleAudit, lang) {
  if (!process.env.OPENAI_API_KEY) return {};

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: `Analyze SEO for: ${page.page_title}`
      })
    });

    clearTimeout(timeout);

    const data = await res.json();

    return {
      summary: data.output_text || ''
    };

  } catch {
    return {
      summary: 'AI fallback active'
    };
  }
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { user } = await getAuthenticatedUser(req);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

    const pageUrl = normalizeUrl(req.body?.url);
    if (!pageUrl) return sendJson(res, 400, { error: 'Invalid URL' });

    const page = await fetchSinglePage(pageUrl);
    const ruleAudit = buildRuleAudit(page);

    let aiAudit = { summary: 'AI fallback' };

    try {
      aiAudit = await callOpenAISeoAnalysis(page, ruleAudit);
    } catch {}

    return sendJson(res, 200, {
      ok: true,
      score: ruleAudit.score,
      rule_audit: ruleAudit,
      ai_audit: aiAudit,
      page: {
        title: page.page_title,
        meta_description: page.meta_description
      }
    });

  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}
