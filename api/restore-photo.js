// api/restore-photo.js
// Vercel serverless endpoint for the Restaurator photo restoration frontend.
// Required env variable in Vercel: OPENAI_API_KEY

export const config = {
  runtime: 'nodejs'
};

const MAX_DATA_URL_LENGTH = 20 * 1024 * 1024; // keep below OpenAI image_url max and Vercel payload limits

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString('utf8');

      if (body.length > MAX_DATA_URL_LENGTH + 2000) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function isAllowedImageDataUrl(value) {
  const text = String(value || '');
  return (
    text.startsWith('data:image/jpeg;base64,') ||
    text.startsWith('data:image/jpg;base64,') ||
    text.startsWith('data:image/png;base64,') ||
    text.startsWith('data:image/webp;base64,')
  );
}

function buildRestorationPrompt() {
  return [
    'Restore this old family photo carefully.',
    'Preserve the exact identity, facial structure, expression, age, and natural look of every person.',
    'Do not replace the face, do not beautify aggressively, do not invent new facial details.',
    'Remove scratches, dust, stains, cracks, fading, and visible damage where possible.',
    'Improve sharpness, contrast, exposure, and clarity naturally.',
    'Add only subtle realistic color if appropriate, mainly to clothing and background, while keeping faces natural.',
    'Keep the composition and important original details unchanged.',
    'The result should look like a realistic restored photograph, not a painting, cartoon, or modern fake portrait.'
  ].join(' ');
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Missing OPENAI_API_KEY environment variable.'
    });
  }

  try {
    const rawBody = await readRequestBody(req);
    const body = JSON.parse(rawBody || '{}');

    const imageDataUrl = String(body.imageDataUrl || body.image_data_url || '').trim();

    if (!imageDataUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing imageDataUrl.'
      });
    }

    if (!isAllowedImageDataUrl(imageDataUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported image format. Use JPG, PNG or WEBP.'
      });
    }

    if (imageDataUrl.length > MAX_DATA_URL_LENGTH) {
      return res.status(413).json({
        success: false,
        error: 'Image is too large. Please upload a smaller file.'
      });
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-image-1.5',
        images: [
          {
            image_url: imageDataUrl
          }
        ],
        prompt: buildRestorationPrompt(),
        input_fidelity: 'high',
        output_format: 'jpeg',
        quality: 'medium',
        size: '1024x1024',
        n: 1
      })
    });

    const resultText = await openaiResponse.text();
    let resultJson = {};

    try {
      resultJson = JSON.parse(resultText);
    } catch (parseError) {
      resultJson = {};
    }

    if (!openaiResponse.ok) {
      return res.status(openaiResponse.status).json({
        success: false,
        error:
          resultJson?.error?.message ||
          resultJson?.message ||
          'OpenAI image restoration failed.'
      });
    }

    const firstImage = Array.isArray(resultJson.data) ? resultJson.data[0] : null;
    const b64 = firstImage?.b64_json || '';
    const url = firstImage?.url || '';

    if (!b64 && !url) {
      return res.status(500).json({
        success: false,
        error: 'No restored image returned.'
      });
    }

    return res.status(200).json({
      success: true,
      restoredImageDataUrl: b64 ? `data:image/jpeg;base64,${b64}` : '',
      restoredImageUrl: url || '',
      watermarkRequired: true
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error && error.message ? error.message : 'Unexpected restore error.'
    });
  }
}
