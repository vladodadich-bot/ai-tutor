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

  const trimmedContent = content.slice(0, OPENAI_CONTENT_LIMIT);

  const systemPrompt = `
You are a senior SEO strategist.
${languageInstruction}
Return ONLY valid JSON.
Never return empty fields.
`.trim();

  const userPrompt = `
Analyze this page and improve SEO.

Title: ${title}
Meta: ${meta}
H1: ${h1}
Headings: ${headings}
Content: ${trimmedContent}
`.trim();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
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
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'seo_ai_audit',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                summary: { type: 'string' },
                issues: { type: 'array', items: { type: 'string' } },
                suggestions: { type: 'array', items: { type: 'string' } },
                quick_wins: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string' }
                    },
                    required: ['title', 'description']
                  }
                },
                improved_title: { type: 'string' },
                improved_meta_description: { type: 'string' }
              },
              required: [
                'summary',
                'issues',
                'suggestions',
                'quick_wins',
                'improved_title',
                'improved_meta_description'
              ]
            }
          }
        }
      })
    });

    const raw = await response.json();

    console.log("🔍 RAW OPENAI:", raw);

    if (!response.ok) {
      throw new Error(raw?.error?.message || 'OpenAI request failed');
    }

    // ✅ SIGURNO ČITANJE OUTPUTA
    let text = '';

    try {
      if (raw?.output_text) {
        text = raw.output_text;
      } else if (Array.isArray(raw?.output)) {
        text = raw.output
          .map(item =>
            (item?.content || [])
              .map(c => c?.text || '')
              .join('')
          )
          .join('');
      }
    } catch (e) {
      console.error("TEXT EXTRACTION ERROR:", e);
      text = '';
    }

    console.log("🧠 AI TEXT:", text);

    // ✅ FALLBACK AKO PRAZNO
    if (!text) {
      console.error("EMPTY AI RESPONSE:", raw);

      return {
        summary: getAiFallbackMessage(lang),
        issues: [],
        suggestions: [],
        quick_wins: [],
        improved_title: title,
        improved_meta_description: meta
      };
    }

    // ✅ SIGURAN JSON PARSE
    let parsed = {};

    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error("JSON PARSE ERROR:", err);
      console.error("RAW TEXT:", text);

      return {
        summary: getAiFallbackMessage(lang),
        issues: [],
        suggestions: [],
        quick_wins: [],
        improved_title: title,
        improved_meta_description: meta
      };
    }

    // ✅ FINAL RETURN (NIKAD PRAZNO)
    return {
      summary: parsed.summary || '',
      issues: safeArray(parsed.issues),
      suggestions: safeArray(parsed.suggestions),
      quick_wins: safeArray(parsed.quick_wins),
      improved_title: parsed.improved_title || title,
      improved_meta_description: parsed.improved_meta_description || meta
    };

  } catch (err) {
    console.error('🚨 AI ERROR:', err);

    return {
      summary: getAiFallbackMessage(lang),
      issues: [],
      suggestions: [],
      quick_wins: [],
      improved_title: title,
      improved_meta_description: meta
    };
  } finally {
    clearTimeout(timeout);
  }
}
