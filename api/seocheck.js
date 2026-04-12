import { createClient } from '@supabase/supabase-js';
import { crawlSinglePage } from '../lib/crawl.js';

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
  } catch (err) {
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

function stripHtml(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function scoreLength(value, min, max) {
  const len = String(value || '').trim().length;
  if (!len) return 0;
  if (len >= min && len <= max) return 100;

  const distance = len < min ? (min - len) : (len - max);
  return Math.max(0, 100 - distance * 5);
}

function buildRuleAudit(page) {
  const title = String(page.page_title || '').trim();
  const meta = String(page.meta_description || '').trim();
  const h1 = String(page.h1 || '').trim();
  const headings = safeArray(page.headings);
  const content =
    String(page.content || '').trim() ||
    String(page.text_preview || '').trim() ||
    '';

  const titleLen = title.length;
  const metaLen = meta.length;
  const h2Count = headings.filter((h) => /^h2[:\s-]/i.test(String(h))).length;
  const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;

  const checks = [];
  const issues = [];
  const quickFixes = [];

  const titleScore = scoreLength(title, 50, 60);
  checks.push({
    key: 'title_length',
    label: 'Title length',
    passed: titleLen >= 50 && titleLen <= 60,
    score: titleScore,
    value: titleLen
  });
  if (!title) {
    issues.push('Missing page title.');
    quickFixes.push('Add a clear SEO title of around 50 to 60 characters.');
  } else if (titleLen < 50) {
    issues.push('Title is too short.');
    quickFixes.push('Expand the title so it better describes the page topic.');
  } else if (titleLen > 60) {
    issues.push('Title is too long.');
    quickFixes.push('Shorten the title so it is less likely to be truncated.');
  }

  const metaScore = scoreLength(meta, 140, 160);
  checks.push({
    key: 'meta_length',
    label: 'Meta description length',
    passed: metaLen >= 140 && metaLen <= 160,
    score: metaScore,
    value: metaLen
  });
  if (!meta) {
    issues.push('Missing meta description.');
    quickFixes.push('Add a meta description around 140 to 160 characters.');
  } else if (metaLen < 140) {
    issues.push('Meta description is too short.');
    quickFixes.push('Expand the meta description with a clearer value proposition.');
  } else if (metaLen > 160) {
    issues.push('Meta description is too long.');
    quickFixes.push('Shorten the meta description to avoid truncation.');
  }

  checks.push({
    key: 'h1',
    label: 'Primary heading',
    passed: !!h1,
    score: h1 ? 100 : 0,
    value: h1 ? 1 : 0
  });
  if (!h1) {
    issues.push('Missing H1 heading.');
    quickFixes.push('Add one clear H1 that matches the main topic of the page.');
  }

  checks.push({
    key: 'h2_count',
    label: 'H2 structure',
    passed: h2Count >= 2,
    score: h2Count >= 2 ? 100 : h2Count === 1 ? 50 : 0,
    value: h2Count
  });
  if (h2Count === 0) {
    issues.push('No H2 headings found.');
    quickFixes.push('Break the content into sections with descriptive H2 headings.');
  } else if (h2Count === 1) {
    issues.push('Only one H2 heading found.');
    quickFixes.push('Add more structured sections using H2 headings.');
  }

  checks.push({
    key: 'content_length',
    label: 'Content depth',
    passed: wordCount >= 500,
    score: wordCount >= 800 ? 100 : wordCount >= 500 ? 75 : wordCount >= 250 ? 40 : 0,
    value: wordCount
  });
  if (wordCount < 250) {
    issues.push('Content is very thin.');
    quickFixes.push('Add more useful text content and topical detail.');
  } else if (wordCount < 500) {
    issues.push('Content could be more detailed.');
    quickFixes.push('Expand the page with more relevant, structured information.');
  }

  const totalScore = Math.round(
    checks.reduce((sum, item) => sum + item.score, 0) / checks.length
  );

  return {
    score: totalScore,
    checks,
    issues,
    quickFixes,
    metrics: {
      titleLength: titleLen,
      metaLength: metaLen,
      h2Count,
      wordCount
    }
  };
}

async function getUserSubscription(userId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, user_id, plan_id, status, is_active, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

function userHasProAccess(subscription) {
  if (!subscription) return false;
  if (!subscription.is_active) return false;
  if (String(subscription.status || '').toLowerCase() !== 'active') return false;

  return String(subscription.plan_id || '').toLowerCase() === 'pro';
}

async function callOpenAISeoAnalysis(page, ruleAudit) {
  const title = String(page.page_title || '').trim();
  const meta = String(page.meta_description || '').trim();
  const h1 = String(page.h1 || '').trim();
  const headings = safeArray(page.headings).slice(0, 12).join(' | ');
  const content =
    String(page.content || '').trim() ||
    String(page.text_preview || '').trim() ||
    '';

  const trimmedContent = content.slice(0, 5000);

  const systemPrompt = `
You are a practical SEO auditor.
Return only valid JSON.
Do not use markdown.
Keep suggestions concrete and useful.
`.trim();

  const userPrompt = `
Analyze this webpage for SEO.

Return JSON with this exact shape:
{
  "summary": "short summary",
  "issues": ["..."],
  "suggestions": ["..."],
  "improved_title": "...",
  "improved_meta_description": "..."
}

Context:
URL: ${page.url || ''}
Title: ${title}
Meta description: ${meta}
H1: ${h1}
Headings: ${headings}
Content: ${trimmedContent}

Rule audit score: ${ruleAudit.score}
Rule audit issues: ${ruleAudit.issues.join(' | ')}
Rule audit quick fixes: ${ruleAudit.quickFixes.join(' | ')}
`.trim();

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: userPrompt }]
        }
      ]
    })
  });

  const raw = await response.json();

  if (!response.ok) {
    throw new Error(raw?.error?.message || 'OpenAI SEO analysis failed');
  }

  const text =
    raw?.output_text ||
    raw?.output?.map((item) =>
      safeArray(item?.content).map((c) => c?.text || '').join('\n')
    ).join('\n') ||
    '';

  try {
    return JSON.parse(text);
  } catch {
    return {
      summary: 'AI analysis returned a non-JSON response.',
      issues: [],
      suggestions: [],
      improved_title: '',
      improved_meta_description: ''
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { user, error: authError } = await getAuthenticatedUser(req);

    if (authError || !user) {
      return sendJson(res, 401, { error: authError || 'Unauthorized' });
    }

    const subscription = await getUserSubscription(user.id);

    if (!userHasProAccess(subscription)) {
      return sendJson(res, 403, { error: 'PRO_REQUIRED' });
    }

    const pageUrl = normalizeUrl(req.body?.url || '');

    if (!pageUrl) {
      return sendJson(res, 400, { error: 'Missing or invalid URL' });
    }

    const crawlResult = await crawlSinglePage(pageUrl);

    if (!crawlResult) {
      return sendJson(res, 500, { error: 'Failed to crawl page' });
    }

    const page = {
      url: pageUrl,
      page_title: crawlResult.page_title || crawlResult.title || '',
      meta_description: crawlResult.meta_description || '',
      h1: crawlResult.h1 || '',
      headings: crawlResult.headings || [],
      text_preview: crawlResult.text_preview || '',
      content: stripHtml(crawlResult.content || crawlResult.text_preview || '')
    };

    const ruleAudit = buildRuleAudit(page);
    const aiAudit = await callOpenAISeoAnalysis(page, ruleAudit);

    return sendJson(res, 200, {
      ok: true,
      url: page.url,
      score: ruleAudit.score,
      rule_audit: ruleAudit,
      ai_audit: aiAudit
    });
  } catch (err) {
    console.error('seocheck.js error:', err);
    return sendJson(res, 500, {
      error: err?.message || 'SEO check failed'
    });
  }
}
