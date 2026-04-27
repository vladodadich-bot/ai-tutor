// api/restore-photo.js
// Stable backend for Restaurator.
// Required Vercel Environment Variable: OPENAI_API_KEY

export const config = {
  runtime: 'nodejs'
};

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

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

      if (body.length > 20 * 1024 * 1024) {
        reject(new Error('Request body is too large. Please upload a smaller image.'));
        req.destroy();
      }
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);

  if (!match) {
    throw new Error('Unsupported image format. Please use JPG, PNG or WEBP.');
  }

  const mimeType = match[1].toLowerCase().replace('image/jpg', 'image/jpeg');
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');

  if (!buffer.length) {
    throw new Error('Empty image file.');
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large. Please upload a smaller image.');
  }

  const extension =
    mimeType === 'image/png' ? 'png' :
    mimeType === 'image/webp' ? 'webp' :
    'jpg';

  return {
    buffer,
    mimeType,
    filename: `restore-input.${extension}`
  };
}

function buildRestorationPrompt() {
  return [
    'Carefully restore this old family photograph.',
    'Preserve the exact identity, facial structure, expression, age, hairstyle shape, pose, and natural look of every person.',
    'Do not replace faces. Do not beautify aggressively. Do not create a different person.',
    'Remove scratches, dust, stains, cracks, fading, and visible damage where possible.',
    'Improve sharpness, exposure, contrast, and clarity naturally.',
    'Preserve the full original framing and aspect ratio as much as possible.',
    'Do not crop the left, right, top, or bottom edges.',
    'Keep the complete photo visible, including the outer areas near the borders.',
    'Keep the original composition, clothing, background, and important details unchanged.',
    'If adding color, use only subtle realistic color. Keep skin tones natural and conservative.',
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
      error: 'Missing OPENAI_API_KEY in Vercel Environment Variables.'
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

    const parsed = parseDataUrl(imageDataUrl);

    const form = new FormData();
    const blob = new Blob([parsed.buffer], { type: parsed.mimeType });

    form.append('model', 'gpt-image-1.5');
    form.append('image', blob, parsed.filename);
    form.append('prompt', buildRestorationPrompt());
    form.append('input_fidelity', 'high');
    form.append('output_format', 'jpeg');
    form.append('quality', 'medium');
    form.append('size', 'auto');
    form.append('n', '1');

    const openaiResponse = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: form
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
          resultText ||
          'OpenAI image restoration failed.'
      });
    }

    const firstImage = Array.isArray(resultJson.data) ? resultJson.data[0] : null;
    const b64 = firstImage?.b64_json || '';

    if (!b64) {
      return res.status(500).json({
        success: false,
        error: 'No restored image returned from OpenAI.'
      });
    }

    return res.status(200).json({
      success: true,
      restoredImageDataUrl: `data:image/jpeg;base64,${b64}`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error && error.message ? error.message : 'Unexpected restore error.'
    });
  }
}
