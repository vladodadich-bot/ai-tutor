async function callOpenAIImproveMeta(inputData = {}, lang = 'en') {
  const pageUrl = normalizeUrl(inputData.url || '');
  const title = String(inputData.title || '').trim();
  const metaDescription = String(inputData.meta_description || '').trim();

  if (!process.env.OPENAI_API_KEY) {
    return {
      summary: getImproveMetaFallbackMessage(lang),
      improved_title: title || '',
      improved_meta_description: metaDescription || ''
    };
  }

  const safeLang = normalizeUiLanguage(lang);
  const languageInstruction = getLanguageInstruction(safeLang);

  const systemPrompt = `
You are a senior SEO copywriter.
${languageInstruction}
Your task is to improve an SEO title and meta description.

Rules:
- Keep the title clear, specific, clickable, and aligned with likely search intent.
- Keep the title ideally around 50 to 60 characters.
- Keep the meta description ideally around 140 to 160 characters.
- Do not use quotation marks unless truly necessary.
- Do not invent facts that are not present in the provided input.
- If the existing title or meta description is already strong, still provide a slightly improved version.
- Return only content matching the provided JSON schema.
`.trim();

  const userPrompt = `
Improve the SEO title and meta description for this page.

URL: ${pageUrl}
Current title: ${title}
Current meta description: ${metaDescription}

Return:
- one improved SEO title
- one improved meta description
- one short summary explaining what was improved and why
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
            name: 'improve_meta_response',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                summary: { type: 'string' },
                improved_title: { type: 'string' },
                improved_meta_description: { type: 'string' }
              },
              required: [
                'summary',
                'improved_title',
                'improved_meta_description'
              ]
            }
          }
        }
      })
    });

    const raw = await response.json();

    if (!response.ok) {
      console.error('OpenAI improve-meta HTTP error:', raw);
      throw new Error(raw?.error?.message || 'OpenAI improve-meta request failed');
    }

    const text =
      raw?.output_text ||
      raw?.output?.[0]?.content?.[0]?.text ||
      '';

    console.log('IMPROVE META RAW:', JSON.stringify(raw, null, 2));
    console.log('IMPROVE META TEXT:', text);

    if (!text) {
      throw new Error('OpenAI returned empty improve-meta structured output');
    }

    const parsed = JSON.parse(text);

    return {
      summary: parsed?.summary || getImproveMetaFallbackMessage(lang),
      improved_title: parsed?.improved_title || title || '',
      improved_meta_description: parsed?.improved_meta_description || metaDescription || ''
    };
  } catch (err) {
    console.error('OpenAI improve-meta timeout/error:', err);

    return {
      summary: getImproveMetaFallbackMessage(lang),
      improved_title: title || '',
      improved_meta_description: metaDescription || ''
    };
  } finally {
    clearTimeout(timeout);
  }
}
