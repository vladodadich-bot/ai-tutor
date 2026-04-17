import { createClient } from '@supabase/supabase-js';

// =========================
// CORS + SETUP START
// =========================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function applyCors(req, res) {
  const origin = req.headers.origin || '';

  const allowedOrigins = [
    'https://www.lektirko.com',
    'https://lektirko.com',
    'https://www.zusammenfassung24.de',
    'https://zusammenfassung24.de',
    'https://sitemindai.app',
    'https://www.sitemindai.app',
    'https://popustolovac.com',
    'https://www.popustolovac.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ];

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}
// =======================
// CORS + SETUP END
// =======================


// =========================
// ANALYTICS SUMMARY START
// =========================
async function getAnalyticsSummary(agentId) {
  const [
    activeNowResult,
    todayResult,
    yesterdayResult,
    last30DaysResult,
    avgTimeResult
  ] = await Promise.all([
    supabase
      .from('live_presence')
      .select('session_id', { count: 'exact', head: false })
      .eq('agent_id', agentId)
      .gte('last_seen_at', new Date(Date.now() - 60 * 1000).toISOString()),

    supabase
      .from('analytics_sessions')
      .select('visitor_id, started_at')
      .eq('agent_id', agentId)
      .gte('started_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),

    supabase
      .from('analytics_sessions')
      .select('visitor_id, started_at')
      .eq('agent_id', agentId)
      .gte(
        'started_at',
        new Date(
          new Date(new Date().setHours(0, 0, 0, 0)).getTime() - 24 * 60 * 60 * 1000
        ).toISOString()
      )
      .lt('started_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),

    supabase
      .from('analytics_sessions')
      .select('visitor_id, started_at')
      .eq('agent_id', agentId)
      .gte(
        'started_at',
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      ),

    supabase
      .from('analytics_sessions')
      .select('started_at, last_seen_at')
      .eq('agent_id', agentId)
      .gte(
        'started_at',
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      )
  ]);

  if (activeNowResult.error) throw activeNowResult.error;
  if (todayResult.error) throw todayResult.error;
  if (yesterdayResult.error) throw yesterdayResult.error;
  if (last30DaysResult.error) throw last30DaysResult.error;
  if (avgTimeResult.error) throw avgTimeResult.error;

  function countUniqueVisitors(rows) {
    const set = new Set();

    (rows || []).forEach((row) => {
      if (row && row.visitor_id) {
        set.add(row.visitor_id);
      }
    });

    return set.size;
  }

  function countUniqueSessions(rows) {
    const set = new Set();

    (rows || []).forEach((row) => {
      if (row && row.session_id) {
        set.add(row.session_id);
      }
    });

    return set.size;
  }

  function calculateAverageTimeSpentSeconds(rows) {
    if (!Array.isArray(rows) || !rows.length) return 0;

    let totalSeconds = 0;
    let validSessions = 0;

    rows.forEach((row) => {
      if (!row || !row.started_at || !row.last_seen_at) return;

      const started = new Date(row.started_at).getTime();
      const lastSeen = new Date(row.last_seen_at).getTime();

      if (isNaN(started) || isNaN(lastSeen) || lastSeen < started) return;

      const seconds = Math.round((lastSeen - started) / 1000);

      totalSeconds += seconds;
      validSessions += 1;
    });

    if (!validSessions) return 0;
    return Math.round(totalSeconds / validSessions);
  }

  return {
    active_now: countUniqueSessions(activeNowResult.data),
    visitors_today: countUniqueVisitors(todayResult.data),
    visitors_yesterday: countUniqueVisitors(yesterdayResult.data),
    visitors_last_30_days: countUniqueVisitors(last30DaysResult.data),
    avg_time_spent_seconds: calculateAverageTimeSpentSeconds(avgTimeResult.data)
  };
}
// =======================
// ANALYTICS SUMMARY END
// =======================


// =========================
// SESSION HEARTBEAT START
// =========================
export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const agentId = req.query.agentId || req.query.agent_id;

      if (!agentId) {
        return res.status(400).json({ error: 'Missing agentId' });
      }

      const summary = await getAnalyticsSummary(agentId);
      return res.status(200).json({ success: true, summary });
    } catch (err) {
      console.error('Analytics summary error:', err);
      return res.status(500).json({ error: 'Failed to load analytics summary' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      agent_id,
      visitor_id,
      session_id,
      entry_page_url,
      entry_page_title
    } = req.body || {};

    if (!agent_id || !visitor_id || !session_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from('analytics_sessions')
      .upsert(
        {
          agent_id,
          visitor_id,
          session_id,
          entry_page_url: entry_page_url || null,
          entry_page_title: entry_page_title || null,
          last_seen_at: now
        },
        {
          onConflict: 'agent_id,session_id'
        }
      );

    if (error) {
      console.error('Session analytics error:', error);
      return res.status(500).json({ error: 'Database error', details: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Session analytics crash:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
// =======================
// SESSION HEARTBEAT END
// =======================
