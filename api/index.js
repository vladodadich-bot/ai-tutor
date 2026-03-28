async function handleAgentConfig(req, res, body) {
  const query = req.query || {};
  const agentId = String(body.agentId || body.agent_id || query.agentId || '').trim();

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }

  return res.status(200).json({
    agentId: agentId,
    agentName: 'Test Agent',
    welcomeMessage: 'Hello from config',
    themeColor: '#2563eb',
    siteDomain: 'https://example.com'
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const query = req.query || {};
    const body = req.body || {};
    const action = String(body.action || query.action || '').trim();

    if (req.method === 'GET' && query.ping === '1') {
      return res.status(200).json({ ok: true, message: 'index alive' });
    }

    if (action === 'agent-config') {
      return await handleAgentConfig(req, res, body);
    }

    return res.status(400).json({ error: 'Unknown or missing action' });
  } catch (err) {
    console.error('INDEX ERROR:', err);
    return res.status(500).json({
      error: err && err.message ? err.message : 'Unknown server error',
      details: err && err.stack ? String(err.stack).slice(0, 2000) : ''
    });
  }
}
async function handleAgentConfig(req, res, body) {
  const query = req.query || {};
  const agentId = String(body.agentId || body.agent_id || query.agentId || '').trim();

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }

  return res.status(200).json({
    agentId: agentId,
    agentName: 'Test Agent',
    welcomeMessage: 'Hello from config',
    themeColor: '#2563eb',
    siteDomain: 'https://example.com'
  });
}
if (action === 'agent-config') {
  return await handleAgentConfig(req, res, body);
}
async function handleChat(req, res, body) {
  const agentId = String(body.agentId || body.agent_id || '').trim();
  const message = String(body.message || '').trim();

  if (!agentId || !message) {
    return res.status(400).json({ error: 'Missing agentId or message' });
  }

  return res.status(200).json({
    reply: 'Chat handler radi: ' + message
  });
}
if (action === 'chat') {
  return await handleChat(req, res, body);
}
