import { createClient } from '@supabase/supabase-js';

const allowedOrigins = [
  'https://sitemindai.app',
  'https://www.sitemindai.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

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

function normalizeUiLanguage(lang = '') {
  const short = String(lang || '').toLowerCase().slice(0, 2);
  return ['en', 'de', 'fr', 'it', 'hr'].includes(short) ? short : 'en';
}

function getLanguageInstruction(lang) {
  const safeLang = normalizeUiLanguage(lang);

  if (safeLang === 'de') return 'Respond in German.';
  if (safeLang === 'fr') return 'Respond in French.';
  if (safeLang === 'it') return 'Respond in Italian.';
  if (safeLang === 'hr') return 'Respond in Croatian.';
  return 'Respond in English.';
}

function stripHtml(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
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

function extractMetaContent(html, name) {
  const regex = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`,
    'i'
  );
  const match = html.match(regex);
  return match?.[1]?.trim() || '';
}

function extractTagText(html, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = html.match(regex);
  return match ? stripHtml(match[1]) : '';
}

function extractAllTagTexts(html, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  const results = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    const text = stripHtml(match[1]);
    if (text) results.push(text);
  }

  return results;
}

function extractAttributes(tag = '') {
  const attrs = {};
  const attrRegex = /([:@a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;

  while ((match = attrRegex.exec(tag)) !== null) {
    const key = String(match[1] || '').toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[key] = String(value).trim();
  }

  return attrs;
}

function extractTagAttributes(html = '', tagName = '') {
  const regex = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  const results = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    const fullTag = match[0];
    results.push({
      raw: fullTag,
      attrs: extractAttributes(fullTag)
    });
  }

  return results;
}

function countMatches(html = '', regex) {
  const matches = String(html).match(regex);
  return matches ? matches.length : 0;
}

function isGenericImageFilename(value = '') {
  const filename = String(value || '').split('/').pop()?.split('?')[0]?.toLowerCase() || '';
  if (!filename) return false;

  return /^(image|img|photo|pic|dsc|screenshot|untitled)[-_]?\d*\.(jpg|jpeg|png|webp|gif|avif|svg)$/i.test(filename);
}

function isModernImageFormat(value = '') {
  const clean = String(value || '').split('?')[0].toLowerCase();
  return clean.endsWith('.webp') || clean.endsWith('.avif');
}

function createCheck(key, label, passed, score, value) {
  return {
    key,
    label,
    passed: !!passed,
    score: Math.max(0, Math.min(100, Number(score || 0))),
    value
  };
}

function createStatItem(label, value, note = '', suffix = '') {
  return { label, value, note, suffix };
}

function createTechnicalFlag(label, present, presentValue = 'Found', missingValue = 'Missing') {
  return {
    label,
    value: present ? presentValue : missingValue,
    status: present ? 'good' : 'bad'
  };
}

async function fetchSinglePage(url) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SiteMindAiLabsBot/1.0; +https://sitemindai.app)'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page (${response.status})`);
  }

  const html = await response.text();

  if (!html || html.length < 50) {
    throw new Error('Fetched page is empty or too short');
  }

  const title = extractTagText(html, 'title');
  const metaDescription =
    extractMetaContent(html, 'description') ||
    extractMetaContent(html, 'og:description');

  const h1 = extractTagText(html, 'h1');
  const h2s = extractAllTagTexts(html, 'h2');
  const h3s = extractAllTagTexts(html, 'h3');

  const textContent = stripHtml(html);
  const textPreview = textContent.slice(0, 7000);

  return {
    url,
    raw_html: html,
    page_title: title,
    meta_description: metaDescription,
    h1,
    headings: [
      ...h2s.map((text) => `H2: ${text}`),
      ...h3s.slice(0, 8).map((text) => `H3: ${text}`)
    ],
    text_preview: textPreview,
    content: textContent
  };
}

function analyzePageSpeed(html = '') {
  const scripts = extractTagAttributes(html, 'script');
  const stylesheets = extractTagAttributes(html, 'link').filter(
    (item) => String(item.attrs.rel || '').toLowerCase().includes('stylesheet')
  );
  const images = extractTagAttributes(html, 'img');
  const iframes = extractTagAttributes(html, 'iframe');
  const lazyImages = images.filter((item) =>
    String(item.attrs.loading || '').toLowerCase() === 'lazy'
  ).length;
  const headScriptCount = countMatches(String(html).match(/<head[\s\S]*?<\/head>/i)?.[0] || '', /<script\b/gi);
  const domElementsCount = countMatches(html, /<([a-z0-9-]+)\b[^>]*>/gi);
  const htmlSizeKb = Math.round(Buffer.byteLength(String(html), 'utf8') / 1024);

  return {
    scriptsCount: scripts.length,
    stylesheetsCount: stylesheets.length,
    imagesCount: images.length,
    lazyImages,
    iframesCount: iframes.length,
    headScriptCount,
    domElementsCount,
    htmlSizeKb
  };
}

function analyzeImageSeo(html = '') {
  const images = extractTagAttributes(html, 'img');

  let missingAlt = 0;
  let emptyAlt = 0;
  let genericFilenames = 0;
  let missingDimensions = 0;
  let modernFormats = 0;
  let lazyLoaded = 0;

  for (const image of images) {
    const attrs = image.attrs || {};
    const src = attrs.src || attrs['data-src'] || attrs['data-lazy-src'] || '';
    const hasAlt = Object.prototype.hasOwnProperty.call(attrs, 'alt');
    const alt = String(attrs.alt || '').trim();

    if (!hasAlt) {
      missingAlt += 1;
    } else if (!alt) {
      emptyAlt += 1;
    }

    if (isGenericImageFilename(src)) {
      genericFilenames += 1;
    }

    if (!attrs.width || !attrs.height) {
      missingDimensions += 1;
    }

    if (isModernImageFormat(src)) {
      modernFormats += 1;
    }

    if (String(attrs.loading || '').toLowerCase() === 'lazy') {
      lazyLoaded += 1;
    }
  }

  return {
    totalImages: images.length,
    missingAlt,
    emptyAlt,
    genericFilenames,
    missingDimensions,
    modernFormats,
    lazyLoaded
  };
}

function analyzeTechnicalSeo(html = '') {
  const canonical = /<link[^>]+rel=["']canonical["'][^>]*>/i.test(html);
  const metaRobots = /<meta[^>]+name=["']robots["'][^>]*>/i.test(html);
  const viewport = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html);
  const htmlLang = /<html[^>]+lang=["'][^"']+["'][^>]*>/i.test(html);
  const openGraph = /<meta[^>]+property=["']og:[^"']+["'][^>]*>/i.test(html);
  const twitterCards = /<meta[^>]+name=["']twitter:[^"']+["'][^>]*>/i.test(html);
  const schema =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>/i.test(html) ||
    /itemscope|itemtype/i.test(html);
  const favicon =
    /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/i.test(html) ||
    /<link[^>]+href=["'][^"']*favicon[^"']*["'][^>]*>/i.test(html);
  const hreflang = /<link[^>]+hreflang=["'][^"']+["'][^>]*>/i.test(html);

  return {
    canonical,
    metaRobots,
    viewport,
    htmlLang,
    openGraph,
    twitterCards,
    schema,
    favicon,
    hreflang
  };
}

function buildRuleAudit(page) {
  const html = String(page.raw_html || '');
  const title = String(page.page_title || '').trim();
  const meta = String(page.meta_description || '').trim();
  const h1 = String(page.h1 || '').trim();
  const headings = safeArray(page.headings);
  const content =
    String(page.content || '').trim() ||
    String(page.text_preview || '').trim() ||
    '';

  const pageSpeed = analyzePageSpeed(html);
  const imageSeo = analyzeImageSeo(html);
  const technicalSeo = analyzeTechnicalSeo(html);

  const titleLen = title.length;
  const metaLen = meta.length;
  const h2Count = headings.filter((h) => /^h2[:\s-]/i.test(String(h))).length;
  const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;

  const checks = [];
  const issues = [];
  const quickFixes = [];
  const quickWins = [];

  const titleScore = scoreLength(title, 50, 60);
  checks.push(createCheck('title_length', 'Title length', titleLen >= 50 && titleLen <= 60, titleScore, titleLen));
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
  checks.push(createCheck('meta_length', 'Meta description length', metaLen >= 140 && metaLen <= 160, metaScore, metaLen));
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

  checks.push(createCheck('h1', 'Primary heading', !!h1, h1 ? 100 : 0, h1 ? 1 : 0));
  if (!h1) {
    issues.push('Missing H1 heading.');
    quickFixes.push('Add one clear H1 that matches the main topic of the page.');
  }

  checks.push(
    createCheck(
      'h2_count',
      'H2 structure',
      h2Count >= 2,
      h2Count >= 2 ? 100 : h2Count === 1 ? 50 : 0,
      h2Count
    )
  );
  if (h2Count === 0) {
    issues.push('No H2 headings found.');
    quickFixes.push('Break the content into sections with descriptive H2 headings.');
  } else if (h2Count === 1) {
    issues.push('Only one H2 heading found.');
    quickFixes.push('Add more structured sections using H2 headings.');
  }

  checks.push(
    createCheck(
      'content_length',
      'Content depth',
      wordCount >= 500,
      wordCount >= 800 ? 100 : wordCount >= 500 ? 75 : wordCount >= 250 ? 40 : 0,
      wordCount
    )
  );
  if (wordCount < 250) {
    issues.push('Content is very thin.');
    quickFixes.push('Add more useful text content and topical detail.');
  } else if (wordCount < 500) {
    issues.push('Content could be more detailed.');
    quickFixes.push('Expand the page with more relevant, structured information.');
  }

  checks.push(
    createCheck(
      'image_alt_coverage',
      'Image alt coverage',
      imageSeo.totalImages === 0 || imageSeo.missingAlt === 0,
      imageSeo.totalImages === 0
        ? 100
        : Math.max(0, 100 - Math.round((imageSeo.missingAlt / Math.max(1, imageSeo.totalImages)) * 100)),
      imageSeo.missingAlt
    )
  );
  if (imageSeo.missingAlt > 0) {
    issues.push('Some images are missing alt text.');
    quickFixes.push('Add descriptive alt text to important images.');
    quickWins.push({
      title: `Add alt text to ${imageSeo.missingAlt} image${imageSeo.missingAlt === 1 ? '' : 's'}.`,
      description: 'This is one of the fastest image SEO improvements.'
    });
  }

  checks.push(
    createCheck(
      'lazy_loading',
      'Image lazy loading',
      imageSeo.totalImages === 0 || imageSeo.lazyLoaded === imageSeo.totalImages,
      imageSeo.totalImages === 0
        ? 100
        : Math.round((imageSeo.lazyLoaded / Math.max(1, imageSeo.totalImages)) * 100),
      imageSeo.lazyLoaded
    )
  );
  if (imageSeo.totalImages > 2 && imageSeo.lazyLoaded < imageSeo.totalImages) {
    issues.push('Not all images use lazy loading.');
    quickFixes.push('Enable lazy loading for below-the-fold images.');
    quickWins.push({
      title: 'Enable lazy loading on more images.',
      description: 'This can improve initial page rendering and reduce unnecessary loading.'
    });
  }

  checks.push(
    createCheck(
      'technical_basics',
      'Technical basics',
      technicalSeo.canonical && technicalSeo.viewport && technicalSeo.htmlLang,
      [technicalSeo.canonical, technicalSeo.viewport, technicalSeo.htmlLang].filter(Boolean).length * 33,
      [technicalSeo.canonical, technicalSeo.viewport, technicalSeo.htmlLang].filter(Boolean).length
    )
  );

  if (!technicalSeo.canonical) {
    issues.push('Canonical tag is missing.');
    quickFixes.push('Add a canonical tag to define the preferred page URL.');
  }

  if (!technicalSeo.viewport) {
    issues.push('Viewport meta tag is missing.');
    quickFixes.push('Add a viewport meta tag for mobile rendering.');
  }

  if (!technicalSeo.htmlLang) {
    issues.push('HTML lang attribute is missing.');
    quickFixes.push('Add the correct lang attribute on the html element.');
  }

  if (!technicalSeo.openGraph) {
    quickWins.push({
      title: 'Add Open Graph tags.',
      description: 'This improves how the page appears when shared on social platforms.'
    });
  }

  if (pageSpeed.headScriptCount > 2) {
    issues.push('Several scripts are loaded in the head.');
    quickFixes.push('Move non-critical scripts out of the head or defer them where possible.');
  }

  if (pageSpeed.htmlSizeKb > 300) {
    issues.push('HTML document is relatively large.');
    quickFixes.push('Reduce unnecessary markup and large inline blocks in the HTML.');
  }

  if (imageSeo.missingDimensions > 0) {
    quickWins.push({
      title: `Set width and height on ${imageSeo.missingDimensions} image${imageSeo.missingDimensions === 1 ? '' : 's'}.`,
      description: 'This helps reduce layout shifts and improves visual stability.'
    });
  }

  if (!quickWins.length) {
    quickWins.push({
      title: 'No major quick wins detected.',
      description: 'The page already covers the main basics checked by this tool.'
    });
  }

  const totalScore = Math.round(
    checks.reduce((sum, item) => sum + item.score, 0) / Math.max(1, checks.length)
  );

  return {
    score: totalScore,
    checks,
    issues,
    quickFixes,
    quickWins,
    metrics: {
      titleLength: titleLen,
      metaLength: metaLen,
      h2Count,
      wordCount
    },
    page_speed: {
      ...pageSpeed,
      items: [
        createStatItem('Scripts', pageSpeed.scriptsCount, 'JS files detected'),
        createStatItem('Stylesheets', pageSpeed.stylesheetsCount, 'CSS files detected'),
        createStatItem('Images', pageSpeed.imagesCount, 'Image elements found'),
        createStatItem('Lazy-loaded images', pageSpeed.lazyImages, 'Images using lazy loading'),
        createStatItem('Iframes', pageSpeed.iframesCount, 'Embedded frames found'),
        createStatItem('Head scripts', pageSpeed.headScriptCount, 'Scripts found inside the head'),
        createStatItem('DOM elements', pageSpeed.domElementsCount, 'Approximate DOM size'),
        createStatItem('HTML size', pageSpeed.htmlSizeKb, 'Approximate document size', ' KB')
      ]
    },
    image_seo: {
      ...imageSeo,
      items: [
        createStatItem('Total images', imageSeo.totalImages, 'All image elements found'),
        createStatItem('Missing alt text', imageSeo.missingAlt, 'Images without alt text'),
        createStatItem('Empty alt text', imageSeo.emptyAlt, 'Images with empty alt attribute'),
        createStatItem('Generic filenames', imageSeo.genericFilenames, 'Names like img123.jpg'),
        createStatItem('Missing width/height', imageSeo.missingDimensions, 'Images without explicit dimensions'),
        createStatItem('Modern formats', imageSeo.modernFormats, 'WEBP or AVIF usage'),
        createStatItem('Lazy-loaded images', imageSeo.lazyLoaded, 'Images with loading="lazy"')
      ]
    },
    technical_seo: {
      ...technicalSeo,
      items: [
        createTechnicalFlag('Canonical', technicalSeo.canonical),
        createTechnicalFlag('Meta robots', technicalSeo.metaRobots),
        createTechnicalFlag('Viewport', technicalSeo.viewport),
        createTechnicalFlag('HTML lang', technicalSeo.htmlLang),
        createTechnicalFlag('Open Graph', technicalSeo.openGraph),
        createTechnicalFlag('Twitter Cards', technicalSeo.twitterCards),
        createTechnicalFlag('Schema', technicalSeo.schema),
        createTechnicalFlag('Favicon', technicalSeo.favicon),
        createTechnicalFlag('Hreflang', technicalSeo.hreflang, 'Found', 'Not found')
      ]
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

  const status = String(subscription.status || '').toLowerCase();
  if (!['active', 'trial'].includes(status)) return false;

  return String(subscription.plan_id || '').toLowerCase() === 'pro';
}

async function callOpenAISeoAnalysis(page, ruleAudit, lang = 'en') {
  if (!process.env.OPENAI_API_KEY) {
    return {
      summary: 'OpenAI API key is missing.',
      issues: [],
      suggestions: [],
      quick_wins: [],
      improved_title: '',
      improved_meta_description: ''
    };
  }

  const safeLang = normalizeUiLanguage(lang);
  const languageInstruction = getLanguageInstruction(safeLang);

  const title = String(page.page_title || '').trim();
  const meta = String(page.meta_description || '').trim();
  const h1 = String(page.h1 || '').trim();
  const headings = safeArray(page.headings).slice(0, 16).join(' | ');
  const content =
    String(page.content || '').trim() ||
    String(page.text_preview || '').trim() ||
    '';

  const trimmedContent = content.slice(0, 8000);

  const systemPrompt = `
You are a senior SEO strategist and content quality evaluator.

${languageInstruction}

Your job is to evaluate SEO in a realistic way, closer to how a strong search quality reviewer would think, not like a simplistic technical checker.

Core principles:
- Do not judge a page only by mechanical SEO formulas.
- Repeated structural section headings across a site are NOT automatically a problem.
- Focus on whether this specific page is useful, relevant, clear, well-targeted, and aligned with search intent.
- Evaluate the page as an individual URL, not as if repeated section labels alone create duplicate content.
- For educational, literary summary, article, or structured content pages, headings like "summary", "characters", "theme", "analysis", FAQ-like blocks, or similar recurring section labels can be completely normal.
- The real question is whether the CONTENT under those sections is useful, specific, and relevant to the page topic.
- Prefer practical, specific SEO advice over generic recommendations.
- Do not invent facts not supported by the page data.
- Keep recommendations realistic and implementable.

What matters most:
1. Search intent match
2. Clarity of primary topic
3. Title quality
4. Meta description usefulness and click appeal
5. H1 relevance
6. Content depth and usefulness
7. Logical structure
8. Overall page quality for the target query
9. Image optimization opportunities
10. Technical basics that are actually missing or weak

What should NOT be treated as an automatic SEO issue:
- recurring H2 naming patterns across different pages
- a site-wide article structure template
- educational pages using repeated section labels
- standard formatting patterns across a content series

Return only valid JSON.
Do not use markdown.
Do not include explanations outside JSON.
`.trim();

  const userPrompt = `
Analyze this webpage for SEO quality and practical optimization opportunities.

Return JSON in exactly this shape:
{
  "summary": "2-4 sentence practical summary",
  "issues": [
    "specific issue 1",
    "specific issue 2",
    "specific issue 3"
  ],
  "suggestions": [
    "specific action 1",
    "specific action 2",
    "specific action 3",
    "specific action 4"
  ],
  "quick_wins": [
    {
      "title": "short quick win title",
      "description": "1 sentence practical explanation"
    }
  ],
  "improved_title": "better SEO title, ideally natural and not spammy",
  "improved_meta_description": "better meta description, ideally compelling and readable"
}

Evaluation rules:
- Judge the page primarily by relevance, clarity, usefulness, and search intent alignment.
- Do NOT flag repeated section titles alone as an SEO problem.
- If the page seems to use a structured editorial template, evaluate whether the actual page topic is still clear and well covered.
- If title, H1, and content are aligned, treat that as a positive signal.
- If the page has thin content, weak topic clarity, weak title, weak meta description, weak image usage, or poor structure, mention that clearly.
- Suggestions must be concrete and useful.
- Avoid vague filler advice.
- Prioritize improvements that could realistically improve rankings and click-through rate.
- Prefer user usefulness over formulaic SEO myths.
- Quick wins should be fast, realistic changes that the user can implement soon.

Page data:
URL: ${page.url || ''}
Current title: ${title}
Current meta description: ${meta}
Current H1: ${h1}
Headings: ${headings}
Main content excerpt: ${trimmedContent}

Rule audit score: ${ruleAudit.score}
Rule audit issues: ${ruleAudit.issues.join(' | ')}
Rule audit quick fixes: ${ruleAudit.quickFixes.join(' | ')}
Page speed signals: ${JSON.stringify(ruleAudit.page_speed || {})}
Image SEO signals: ${JSON.stringify(ruleAudit.image_seo || {})}
Technical SEO signals: ${JSON.stringify(ruleAudit.technical_seo || {})}

Important output style:
- Write the summary, issues, suggestions, and quick_wins in the requested page language.
- Keep improved_title and improved_meta_description in the requested page language.
- Make the title and meta feel natural for real users, not robotic.
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
    const parsed = JSON.parse(text);
    return {
      summary: parsed?.summary || '',
      issues: safeArray(parsed?.issues),
      suggestions: safeArray(parsed?.suggestions),
      quick_wins: safeArray(parsed?.quick_wins),
      improved_title: parsed?.improved_title || '',
      improved_meta_description: parsed?.improved_meta_description || ''
    };
  } catch {
    return {
      summary: 'AI analysis returned a non-JSON response.',
      issues: [],
      suggestions: [],
      quick_wins: [],
      improved_title: '',
      improved_meta_description: ''
    };
  }
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
    const uiLang = normalizeUiLanguage(req.body?.lang || 'en');

    if (!pageUrl) {
      return sendJson(res, 400, { error: 'Missing or invalid URL' });
    }

    console.log('SEO CHECK URL:', pageUrl);
    console.log('SEO CHECK LANG:', uiLang);

    const page = await fetchSinglePage(pageUrl);

    if (!page || !page.content) {
      return sendJson(res, 500, { error: 'Failed to fetch page content' });
    }

    const ruleAudit = buildRuleAudit(page);
    const aiAudit = await callOpenAISeoAnalysis(page, ruleAudit, uiLang);

    return sendJson(res, 200, {
      ok: true,
      url: page.url,
      score: ruleAudit.score,
      rule_audit: ruleAudit,
      ai_audit: aiAudit,
      page_speed: ruleAudit.page_speed,
      image_seo: ruleAudit.image_seo,
      technical_seo: ruleAudit.technical_seo,
      page: {
        title: page.page_title,
        meta_description: page.meta_description,
        h1: page.h1
      }
    });
  } catch (err) {
    console.error('seocheck.js error:', err);

    return sendJson(res, 500, {
      error: err?.message || 'SEO check failed'
    });
  }
}
