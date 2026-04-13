// 🔥 SAMO OVA FUNKCIJA JE BITNO IZMIJENJENA
// (ostatak tvog koda ostaje ISTI)

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

  const systemPrompt = `
You are a senior SEO strategist.
${languageInstruction}
Return ONLY valid JSON.
Never return empty fields.
`.trim();

  const userPrompt = `
Improve SEO for this page.

Title: ${title}
Meta: ${meta}

Return better title and meta description.
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
          { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
          { role: 'user', content: [{ type: 'input_text', text: userPrompt }] }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'seo_ai_audit',
            strict: true,
            schema: {
              type: 'object',
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
      throw new Error(raw?.error?.message || 'OpenAI failed');
    }

    // 🔥 FIXED OUTPUT PARSING
    let text = raw?.output_text;

    if (!text) {
      try {
        text = raw?.output?.[0]?.content?.[0]?.text || '';
      } catch {
        text = '';
      }
    }

    console.log("🧠 AI TEXT:", text);

    if (!text) {
      throw new Error('Empty AI response');
    }

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error("❌ JSON PARSE ERROR:", err);
      console.error("TEXT WAS:", text);
      throw err;
    }

    return {
      summary: parsed.summary || '',
      issues: safeArray(parsed.issues),
      suggestions: safeArray(parsed.suggestions),
      quick_wins: safeArray(parsed.quick_wins),

      // 🔥 FALLBACK ako AI faila
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
      improved_title: title, // fallback
      improved_meta_description: meta // fallback
    };
  } finally {
    clearTimeout(timeout);
  }
}
