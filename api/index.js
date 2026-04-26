import { createClient } from '@supabase/supabase-js';
import { crawlSinglePage, crawlBatchPages, normalizeUrl } from '../lib/crawl.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

// ========================================
// AUTH HELPERS - START
// ========================================

function getBearerToken(req) {
  const authHeader =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    '';

  if (!authHeader || typeof authHeader !== 'string') {
    return '';
  }

  if (!authHeader.startsWith('Bearer ')) {
    return '';
  }

  return authHeader.slice(7).trim();
}

async function getAuthenticatedUser(req) {
  const token = getBearerToken(req);

  if (!token) {
    return {
      user: null,
      error: 'Missing Authorization bearer token'
    };
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return {
        user: null,
        error: error?.message || 'Invalid or expired session'
      };
    }

    return {
      user: data.user,
      error: null
    };
  } catch (err) {
    return {
      user: null,
      error: err && err.message ? err.message : 'Authentication failed'
    };
  }
}

async function requireAuthenticatedUser(req, res) {
  const { user, error } = await getAuthenticatedUser(req);

  if (error || !user) {
    res.status(401).json({
      error: error || 'Unauthorized'
    });
    return null;
  }

  return user;
}

// ========================================
// AUTH HELPERS - END
// ========================================

// ========================================
// CREATE AGENT - START
// ========================================

async function handleCreateAgent(req, res, body) {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const agentName = String(body.agentName || body.agent_name || 'My Agent').trim();
  const welcomeMessage = String(body.welcomeMessage || body.welcome_message || 'Hi! How can I help?').trim();
  const themeColor = String(body.themeColor || body.theme_color || '#2563eb').trim();
  const siteDomain = String(body.siteDomain || body.site_domain || '').trim();

  if (!siteDomain) {
    return res.status(400).json({ error: 'Missing siteDomain' });
  }

  if (!process.env.SUPABASE_URL) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY' });
  }

  const agentId = 'agent_' + Math.random().toString(36).slice(2, 10);

  const { data, error } = await supabase
    .from('agents')
    .insert({
      user_id: user.id,
      agent_id: agentId,
      agent_name: agentName,
      welcome_message: welcomeMessage,
      theme_color: themeColor,
      site_domain: siteDomain
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    success: true,
    userId: data.user_id,
    agentId: data.agent_id,
    agentName: data.agent_name,
    welcomeMessage: data.welcome_message,
    themeColor: data.theme_color,
    siteDomain: data.site_domain
  });
}

// ========================================
// CREATE AGENT - END
// ========================================

// ========================================
// GET AGENTS - START
// ========================================

async function handleGetAgents(req, res, body) {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  if (!process.env.SUPABASE_URL) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY' });
  }

  const siteDomain = String(body.siteDomain || body.site_domain || '').trim();

  let query = supabase
    .from('agents')
    .select('agent_id, agent_name, welcome_message, theme_color, site_domain, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (siteDomain) {
    query = query.eq('site_domain', siteDomain);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    success: true,
    agents: data || []
  });
}

// ========================================
// GET AGENTS - END
// ========================================

// ========================================
// UPDATE AGENT - START
// ========================================

async function handleUpdateAgent(req, res, body) {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const agentId = String(body.agentId || body.agent_id || '').trim();

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }

  if (!process.env.SUPABASE_URL) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY' });
  }

  const { data: existingAgent, error: existingError } = await supabase
    .from('agents')
    .select('agent_id, user_id')
    .eq('agent_id', agentId)
    .eq('user_id', user.id)
    .single();

  if (existingError || !existingAgent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const updates = {};

  if (body.agentName !== undefined || body.agent_name !== undefined) {
    updates.agent_name = String(body.agentName || body.agent_name || '').trim();
  }

  if (body.welcomeMessage !== undefined || body.welcome_message !== undefined) {
    updates.welcome_message = String(body.welcomeMessage || body.welcome_message || '').trim();
  }

  if (body.themeColor !== undefined || body.theme_color !== undefined) {
    updates.theme_color = String(body.themeColor || body.theme_color || '').trim();
  }

  if (body.siteDomain !== undefined || body.site_domain !== undefined) {
    updates.site_domain = String(body.siteDomain || body.site_domain || '').trim();
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const { data, error } = await supabase
    .from('agents')
    .update(updates)
    .eq('agent_id', agentId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    success: true,
    agent: data
  });
}

// ========================================
// UPDATE AGENT - END
// ========================================

// ========================================
// DELETE AGENT - START
// ========================================

async function handleDeleteAgent(req, res, body) {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const agentId = String(body.agentId || body.agent_id || '').trim();

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }

  if (!process.env.SUPABASE_URL) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY' });
  }

  const { data: existingAgent, error: existingError } = await supabase
    .from('agents')
    .select('agent_id, user_id')
    .eq('agent_id', agentId)
    .eq('user_id', user.id)
    .single();

  if (existingError || !existingAgent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const deleteSiteContent = await supabase
    .from('site_content')
    .delete()
    .eq('agent_id', agentId);

  if (deleteSiteContent.error) {
    return res.status(500).json({ error: deleteSiteContent.error.message });
  }

  const deleteAgent = await supabase
    .from('agents')
    .delete()
    .eq('agent_id', agentId)
    .eq('user_id', user.id);

  if (deleteAgent.error) {
    return res.status(500).json({ error: deleteAgent.error.message });
  }

  return res.status(200).json({
    success: true,
    deletedAgentId: agentId
  });
}

// ========================================
// DELETE AGENT - END
// ========================================

// ========================================
// ANALYTICS HELPERS - START
// ========================================

function getClientIp(req) {
  const forwardedFor =
    req.headers?.['x-forwarded-for'] ||
    req.headers?.['X-Forwarded-For'] ||
    '';

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp =
    req.headers?.['x-real-ip'] ||
    req.headers?.['X-Real-IP'] ||
    '';

  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  return '';
}

function normalizeAnalyticsText(value, max = 500) {
  return cleanText(String(value || '')).slice(0, max);
}

async function ensureAgentExists(agentId) {
  if (!agentId) return false;

  const { data, error } = await supabase
    .from('agents')
    .select('agent_id')
    .eq('agent_id', agentId)
    .maybeSingle();

  if (error || !data) return false;
  return true;
}

async function insertAnalyticsEvent(eventType, payload) {
  const eventRow = {
    event_type: eventType,
    agent_id: payload.agent_id,
    page_url: payload.page_url || null,
    page_title: payload.page_title || null,
    referrer: payload.referrer || null,
    duration: Number.isFinite(payload.duration) ? payload.duration : null,
    metadata: payload.metadata || {}
  };

  const { error } = await supabase
    .from('analytics_events')
    .insert(eventRow);

  return error || null;
}

async function upsertAnalyticsSession(payload) {
  if (!payload.session_id) return null;

  const row = {
    session_id: payload.session_id,
    agent_id: payload.agent_id,
    entry_page_url: payload.entry_page_url || null,
    entry_page_title: payload.entry_page_title || null,
    started_at: payload.started_at || new Date().toISOString(),
    last_seen_at: payload.last_seen_at || new Date().toISOString(),
    country: payload.country || null,
    city: payload.city || null,
    user_agent: payload.user_agent || null
  };

  const { error } = await supabase
    .from('analytics_session')
    .upsert(row, { onConflict: 'session_id' });

  return error || null;
}

async function touchAnalyticsSession(sessionId, updates) {
  if (!sessionId) return null;

  const patch = {
    last_seen_at: updates.last_seen_at || new Date().toISOString()
  };

  if (updates.entry_page_url !== undefined) patch.entry_page_url = updates.entry_page_url || null;
  if (updates.entry_page_title !== undefined) patch.entry_page_title = updates.entry_page_title || null;
  if (updates.country !== undefined) patch.country = updates.country || null;
  if (updates.city !== undefined) patch.city = updates.city || null;
  if (updates.user_agent !== undefined) patch.user_agent = updates.user_agent || null;

  const { error } = await supabase
    .from('analytics_session')
    .update(patch)
    .eq('session_id', sessionId);

  return error || null;
}

async function handleTrackVisit(req, res, body) {
  const agentId = normalizeAnalyticsText(body.agentId || body.agent_id, 100);
  const pageUrl = normalizeAnalyticsText(body.pageUrl || body.page_url, 1500);
  const pageTitle = normalizeAnalyticsText(body.pageTitle || body.page_title || 'Untitled Page', 500);
  const referrer = normalizeAnalyticsText(body.referrer || '', 1500);
  const sessionId = normalizeAnalyticsText(body.sessionId || body.session_id, 120);
  const country = normalizeAnalyticsText(body.country || '', 120);
  const city = normalizeAnalyticsText(body.city || '', 120);
  const userAgent = normalizeAnalyticsText(req.headers?.['user-agent'] || body.userAgent || body.user_agent || '', 500);
  const ipAddress = normalizeAnalyticsText(getClientIp(req), 120);

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }

  const agentExists = await ensureAgentExists(agentId);
  if (!agentExists) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const nowIso = new Date().toISOString();

  try {
    const eventError = await insertAnalyticsEvent('visit', {
      agent_id: agentId,
      page_url: pageUrl || null,
      page_title: pageTitle || 'Untitled Page',
      referrer: referrer || null,
      duration: null,
      metadata: {
        session_id: sessionId || null,
        country: country || null,
        city: city || null,
        user_agent: userAgent || null,
        ip_address: ipAddress || null
      }
    });

    if (eventError) {
      return res.status(500).json({ error: eventError.message });
    }

    if (sessionId) {
      let sessionError = await upsertAnalyticsSession({
        session_id: sessionId,
        agent_id: agentId,
        entry_page_url: pageUrl || null,
        entry_page_title: pageTitle || 'Untitled Page',
        started_at: nowIso,
        last_seen_at: nowIso,
        country: country || null,
        city: city || null,
        user_agent: userAgent || null
      });

      if (sessionError) {
        const duplicate = String(sessionError.message || '').toLowerCase().includes('duplicate');
        if (duplicate) {
          sessionError = await touchAnalyticsSession(sessionId, {
            last_seen_at: nowIso,
            country: country || null,
            city: city || null,
            user_agent: userAgent || null
          });
        }
      }

      if (sessionError) {
        return res.status(500).json({ error: sessionError.message });
      }
    }

    return res.status(200).json({
      success: true,
      stored: true
    });
  } catch (err) {
    return res.status(500).json({
      error: err && err.message ? err.message : 'track_visit failed'
    });
  }
}

async function handleTrackTime(req, res, body) {
  const agentId = normalizeAnalyticsText(body.agentId || body.agent_id, 100);
  const pageUrl = normalizeAnalyticsText(body.pageUrl || body.page_url, 1500);
  const pageTitle = normalizeAnalyticsText(body.pageTitle || body.page_title || '', 500);
  const referrer = normalizeAnalyticsText(body.referrer || '', 1500);
  const sessionId = normalizeAnalyticsText(body.sessionId || body.session_id, 120);
  const country = normalizeAnalyticsText(body.country || '', 120);
  const city = normalizeAnalyticsText(body.city || '', 120);
  const userAgent = normalizeAnalyticsText(req.headers?.['user-agent'] || body.userAgent || body.user_agent || '', 500);
  const duration = Number(body.duration || 0);

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }

  const safeDuration = Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : 0;

  const agentExists = await ensureAgentExists(agentId);
  if (!agentExists) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const nowIso = new Date().toISOString();

  try {
    const eventError = await insertAnalyticsEvent('time', {
      agent_id: agentId,
      page_url: pageUrl || null,
      page_title: pageTitle || null,
      referrer: referrer || null,
      duration: safeDuration,
      metadata: {
        session_id: sessionId || null,
        country: country || null,
        city: city || null,
        user_agent: userAgent || null
      }
    });

    if (eventError) {
      return res.status(500).json({ error: eventError.message });
    }

    if (sessionId) {
      const sessionError = await touchAnalyticsSession(sessionId, {
        last_seen_at: nowIso,
        country: country || null,
        city: city || null,
        user_agent: userAgent || null
      });

      if (sessionError) {
        return res.status(500).json({ error: sessionError.message });
      }
    }

    return res.status(200).json({
      success: true,
      stored: true
    });
  } catch (err) {
    return res.status(500).json({
      error: err && err.message ? err.message : 'track_time failed'
    });
  }
}


function getUtcDayStart(date) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ));
}

function getEventSessionId(row, fallbackIndex) {
  const direct = row && row.session_id ? String(row.session_id).trim() : '';
  if (direct) return direct;

  const metadata = row && row.metadata && typeof row.metadata === 'object'
    ? row.metadata
    : {};

  const nested = metadata.session_id || metadata.sessionId || '';
  const normalizedNested = String(nested || '').trim();
  if (normalizedNested) return normalizedNested;

  const pageUrl = row && row.page_url ? String(row.page_url).trim() : '';
  const createdAt = row && row.created_at ? String(row.created_at).trim() : '';
  return 'event-' + fallbackIndex + '-' + pageUrl + '-' + createdAt;
}

function normalizeReferrerSource(value) {
  const raw = String(value || '').trim();

  if (!raw) return 'Direct';

  let host = raw;

  try {
    const parsed = new URL(raw);
    host = parsed.hostname || raw;
  } catch (err) {
    host = raw
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .trim();
  }

  const lower = host.toLowerCase();

  if (!lower || lower === 'null' || lower === 'undefined') return 'Direct';
  if (lower.includes('google.')) return 'Google';
  if (lower.includes('chatgpt.com') || lower.includes('openai.com')) return 'ChatGPT';
  if (lower.includes('facebook.com') || lower.includes('fb.com')) return 'Facebook';
  if (lower.includes('instagram.com')) return 'Instagram';
  if (lower.includes('bing.com')) return 'Bing';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'YouTube';
  if (lower.includes('linkedin.com')) return 'LinkedIn';
  if (lower.includes('t.co') || lower.includes('twitter.com') || lower.includes('x.com')) return 'X / Twitter';
  if (lower.includes('pinterest.')) return 'Pinterest';
  if (lower.includes('duckduckgo.com')) return 'DuckDuckGo';
  if (lower.includes('yahoo.')) return 'Yahoo';

  return host.replace(/^www\./i, '') || 'Direct';
}

function countUniqueVisits(events, startDate, endDate) {
  const unique = new Set();

  (events || []).forEach((row, index) => {
    if (String(row && row.event_type || '').toLowerCase() !== 'visit') return;

    const createdAt = new Date(row.created_at || 0);
    if (Number.isNaN(createdAt.getTime())) return;
    if (startDate && createdAt < startDate) return;
    if (endDate && createdAt >= endDate) return;

    unique.add(getEventSessionId(row, index));
  });

  return unique.size;
}

function buildReferrerRows(events, startDate) {
  const groups = new Map();

  (events || []).forEach((row, index) => {
    if (String(row && row.event_type || '').toLowerCase() !== 'visit') return;

    const createdAt = new Date(row.created_at || 0);
    if (Number.isNaN(createdAt.getTime())) return;
    if (startDate && createdAt < startDate) return;

    const source = normalizeReferrerSource(row.referrer);
    const sessionId = getEventSessionId(row, index);

    if (!groups.has(source)) {
      groups.set(source, new Set());
    }

    groups.get(source).add(sessionId);
  });

  const total = Array.from(groups.values()).reduce((sum, set) => sum + set.size, 0);

  return Array.from(groups.entries())
    .map(([source, set]) => ({
      source,
      label: source,
      visitors: set.size,
      count: set.size,
      share: total ? Math.round((set.size / total) * 1000) / 10 : 0
    }))
    .sort((a, b) => Number(b.visitors || 0) - Number(a.visitors || 0))
    .slice(0, 25);
}

async function handleAnalyticsSummary(req, res, body) {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const query = req.query || {};
  const agentId = normalizeAnalyticsText(body.agentId || body.agent_id || query.agentId || query.agent_id, 100);

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('agent_id, user_id')
    .eq('agent_id', agentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (agentError || !agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const now = new Date();
  const todayStart = getUtcDayStart(now);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const last7Start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const liveSince = new Date(now.getTime() - 60 * 1000).toISOString();

  const liveResult = await supabase
    .from('live_presence')
    .select('session_id')
    .eq('agent_id', agentId)
    .gte('last_seen_at', liveSince)
    .limit(1000);

  if (liveResult.error) {
    return res.status(500).json({ error: liveResult.error.message });
  }

  const activeSessions = new Set(
    (liveResult.data || [])
      .map((row, index) => String(row.session_id || 'live-' + index).trim())
      .filter(Boolean)
  );

  const eventsResult = await supabase
    .from('analytics_events')
    .select('id, created_at, event_type, page_url, referrer, duration, metadata')
    .eq('agent_id', agentId)
    .gte('created_at', last30Start.toISOString())
    .order('created_at', { ascending: false })
    .limit(5000);

  if (eventsResult.error) {
    return res.status(500).json({ error: eventsResult.error.message });
  }

  const events = Array.isArray(eventsResult.data) ? eventsResult.data : [];

  const sessionsResult = await supabase
    .from('analytics_session')
    .select('session_id, started_at, last_seen_at')
    .eq('agent_id', agentId)
    .gte('started_at', last30Start.toISOString())
    .limit(5000);

  if (sessionsResult.error) {
    return res.status(500).json({ error: sessionsResult.error.message });
  }

  const timeEvents = events.filter((row) => (
    String(row && row.event_type || '').toLowerCase() === 'time' &&
    Number(row && row.duration || 0) > 0
  ));

  const avgFromTimeEvents = timeEvents.length
    ? Math.round(timeEvents.reduce((sum, row) => sum + Number(row.duration || 0), 0) / timeEvents.length)
    : 0;

  const sessionDurations = (sessionsResult.data || [])
    .map((row) => {
      const startedAt = new Date(row && row.started_at ? row.started_at : 0);
      const lastSeenAt = new Date(row && row.last_seen_at ? row.last_seen_at : 0);

      if (Number.isNaN(startedAt.getTime()) || Number.isNaN(lastSeenAt.getTime())) return 0;

      const seconds = Math.round((lastSeenAt.getTime() - startedAt.getTime()) / 1000);
      return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    })
    .filter((seconds) => seconds > 0 && seconds <= 60 * 60 * 6);

  const avgFromSessions = sessionDurations.length
    ? Math.round(sessionDurations.reduce((sum, seconds) => sum + seconds, 0) / sessionDurations.length)
    : 0;

  const avgTime = avgFromTimeEvents || avgFromSessions || 0;

  const referrers = {
    today: buildReferrerRows(events, todayStart),
    last7: buildReferrerRows(events, last7Start),
    last30: buildReferrerRows(events, last30Start)
  };

  return res.status(200).json({
    success: true,
    summary: {
      active_now: activeSessions.size,
      visitors_today: countUniqueVisits(events, todayStart, null),
      visitors_yesterday: countUniqueVisits(events, yesterdayStart, todayStart),
      visitors_last_30_days: countUniqueVisits(events, last30Start, null),
      avg_time_spent_seconds: avgTime
    },
    referrers
  });
}

// ========================================
// ANALYTICS HELPERS - END
// ========================================

// ========================================
// CRAWL HELPERS - START
// ========================================

function normalizeUrlValue(value) {
  return String(value || '').trim();
}

function normalizeCrawlResultToRows(crawlResult, agentId) {
  let pages = [];

  if (Array.isArray(crawlResult)) {
    pages = crawlResult;
  } else if (Array.isArray(crawlResult?.pages)) {
    pages = crawlResult.pages;
  } else if (crawlResult && typeof crawlResult === 'object') {
    pages = [crawlResult];
  }

  const normalizedRows = pages
    .filter(Boolean)
    .map((page) => {
      const headings = Array.isArray(page?.headings) ? page.headings : [];
      const internalLinks = Array.isArray(page?.internal_links)
        ? page.internal_links
        : Array.isArray(page?.internalLinks)
          ? page.internalLinks
          : [];

      const safeHeadings = headings
        .map((item) => String(item || '').trim())
        .filter(Boolean);

      const safeInternalLinks = internalLinks
        .map((link) => ({
          text: String(link?.text || '').trim(),
          href: String(link?.href || '').trim()
        }))
        .filter((link) => link.href);

      return {
        agent_id: agentId,
        url: normalizeUrlValue(page?.url),
        content: String(page?.content || '').trim().slice(0, 25000),
        page_title: String(page?.page_title || page?.pageTitle || ''),
        meta_description: String(page?.meta_description || page?.metaDescription || ''),
        h1: String(page?.h1 || ''),
        headings: safeHeadings,
        internal_links: safeInternalLinks,
        text_preview: String(page?.text_preview || page?.textPreview || '')
      };
    })
    .filter((row) => row.url);

  return normalizedRows;
}
// ========================================
// CRAWL HELPERS - END
// ========================================

// ========================================
// CRAWL START - START
// ========================================

async function handleCrawlStart(req, res, body) {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const agentId = String(body.agentId || body.agent_id || '').trim();

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }

  const { data: existingAgent, error: existingError } = await supabase
    .from('agents')
    .select('agent_id, user_id, site_domain')
    .eq('agent_id', agentId)
    .eq('user_id', user.id)
    .single();

  if (existingError || !existingAgent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const startUrl = String(existingAgent.site_domain || '').trim();

  if (!startUrl) {
    return res.status(400).json({ error: 'Agent has no site_domain' });
  }

  const normalizedStartUrl = normalizeUrl(startUrl);

  if (!normalizedStartUrl) {
    return res.status(400).json({ error: 'Invalid start URL' });
  }

  const { data: job, error: jobError } = await supabase
    .from('crawl_jobs')
    .insert({
      agent_id: existingAgent.agent_id,
      site_domain: existingAgent.site_domain,
      start_url: normalizedStartUrl,
      status: 'pending',
      total_discovered: 1,
      total_crawled: 0,
      total_saved: 0,
      current_batch: 0
    })
    .select()
    .single();

  if (jobError || !job) {
    return res.status(500).json({
      error: 'Failed to create crawl job',
      details: jobError?.message || 'Unknown job insert error'
    });
  }

  const { error: queueError } = await supabase
    .from('crawl_queue')
    .insert({
      job_id: job.id,
      url: normalizedStartUrl,
      normalized_url: normalizedStartUrl,
      status: 'queued',
      depth: 0,
      priority: 100,
      discovered_from: null
    });

  if (queueError) {
    return res.status(500).json({
      error: 'Failed to seed crawl queue',
      details: queueError?.message || 'Unknown queue insert error'
    });
  }

  return res.status(200).json({
    success: true,
    jobId: job.id,
    status: job.status,
    startUrl: normalizedStartUrl
  });
}

// ========================================
// CRAWL START - END
// ========================================

// ========================================
// CRAWL RUN BATCH - START
// ========================================

async function handleCrawlRunBatch(req, res, body) {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const jobId = String(body.jobId || body.job_id || '').trim();
  const BATCH_SIZE = 8;
  const MAX_TOTAL_PAGES = 500;

  if (!jobId) {
    return res.status(400).json({ error: 'Missing jobId' });
  }

  const { data: job, error: jobError } = await supabase
    .from('crawl_jobs')
    .select('id, agent_id, site_domain, start_url, status, total_discovered, total_crawled, total_saved, current_batch')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return res.status(404).json({ error: 'Crawl job not found' });
  }

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('agent_id, user_id')
    .eq('agent_id', job.agent_id)
    .eq('user_id', user.id)
    .single();

  if (agentError || !agent) {
    return res.status(403).json({ error: 'Access denied for this crawl job' });
  }

  const currentTotalCrawled = Number(job.total_crawled || 0);
  const remainingSlots = Math.max(0, MAX_TOTAL_PAGES - currentTotalCrawled);

  if (remainingSlots <= 0) {
    await supabase
      .from('crawl_jobs')
      .update({
        status: 'completed',
        finished_at: new Date().toISOString()
      })
      .eq('id', jobId);

    await supabase
      .from('crawl_queue')
      .update({ status: 'skipped', last_error: 'Maximum crawl limit reached' })
      .eq('job_id', jobId)
      .eq('status', 'queued');

    return res.status(200).json({
      success: true,
      jobId,
      status: 'completed',
      message: 'Maximum crawl limit reached',
      totalCrawled: currentTotalCrawled,
      maxTotalPages: MAX_TOTAL_PAGES
    });
  }

  const effectiveBatchSize = Math.min(BATCH_SIZE, remainingSlots);

  const { data: queuedRows, error: queueFetchError } = await supabase
    .from('crawl_queue')
    .select('id, url, normalized_url, depth, priority')
    .eq('job_id', jobId)
    .eq('status', 'queued')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(effectiveBatchSize);

  if (queueFetchError) {
    return res.status(500).json({ error: queueFetchError.message });
  }

  if (!queuedRows || !queuedRows.length) {
    await supabase
      .from('crawl_jobs')
      .update({
        status: 'completed',
        finished_at: new Date().toISOString()
      })
      .eq('id', jobId);

    return res.status(200).json({
      success: true,
      jobId,
      status: 'completed',
      message: 'No more queued URLs',
      totalCrawled: currentTotalCrawled,
      maxTotalPages: MAX_TOTAL_PAGES
    });
  }

  const queueIds = queuedRows.map((row) => row.id);

  const markProcessing = await supabase
    .from('crawl_queue')
    .update({ status: 'processing' })
    .in('id', queueIds);

  if (markProcessing.error) {
    return res.status(500).json({ error: markProcessing.error.message });
  }

  await supabase
    .from('crawl_jobs')
    .update({
      status: 'running',
      current_batch: Number(job.current_batch || 0) + 1
    })
    .eq('id', jobId);

  const rootOrigin = new URL(job.start_url || job.site_domain).origin;
  const urlsToCrawl = queuedRows
    .map((row) => normalizeUrl(row.normalized_url || row.url))
    .filter(Boolean);

  const crawledPages = await crawlBatchPages(urlsToCrawl, rootOrigin, 6);

  const successPages = crawledPages.filter((page) => !page.error && page.url);
  const failedPages = crawledPages.filter((page) => page.error);

  const rowsToInsert = successPages
    .map((page) => ({
      agent_id: job.agent_id,
      url: String(page.url || '').trim(),
      content: String(page.content || '').trim().slice(0, 25000),
      page_title: String(page.page_title || '').trim(),
      meta_description: String(page.meta_description || '').trim(),
      h1: String(page.h1 || '').trim(),
      headings: Array.isArray(page.headings)
        ? page.headings.map((item) => String(item || '').trim()).filter(Boolean)
        : [],
      internal_links: Array.isArray(page.internal_links)
        ? page.internal_links
            .map((link) => ({
              text: String(link && link.text ? link.text : '').trim(),
              href: String(link && link.href ? link.href : '').trim(),
              priority: Number(link && link.priority ? link.priority : 0)
            }))
            .filter((link) => link.href)
        : [],
      text_preview: String(page.text_preview || '').trim()
    }))
    .filter((row) => row.url);

  if (rowsToInsert.length) {
    const upsertContent = await supabase
      .from('site_content')
      .upsert(rowsToInsert, {
        onConflict: 'agent_id,url'
      });

    if (upsertContent.error) {
      console.error('SITE_CONTENT UPSERT ERROR:', upsertContent.error);
      return res.status(500).json({ error: upsertContent.error.message });
    }
  }

  const discoveredQueueRows = [];
  const seenDiscovered = new Set();
  const queuedRowDepthMap = new Map(
    queuedRows.map((row) => [
      String(normalizeUrl(row.normalized_url || row.url) || '').trim(),
      Number(row.depth || 0)
    ])
  );

  for (const page of successPages) {
    const links = Array.isArray(page.internal_links) ? page.internal_links : [];
    const pageKey = String(normalizeUrl(page.requested_url || page.url) || normalizeUrl(page.url) || '').trim();
    const currentDepth = Number(queuedRowDepthMap.get(pageKey) || 0);

    for (const link of links) {
      const href = normalizeUrl(link && link.href ? link.href : '');
      if (!href) continue;

      const dedupeKey = jobId + '::' + href;
      if (seenDiscovered.has(dedupeKey)) continue;
      seenDiscovered.add(dedupeKey);

      discoveredQueueRows.push({
        job_id: jobId,
        url: href,
        normalized_url: href,
        status: 'queued',
        depth: currentDepth + 1,
        priority: Number(link && link.priority ? link.priority : 0),
        discovered_from: page.url || null,
        page_title: String(link && link.text ? link.text : '').trim()
      });
    }
  }

  let insertedQueueRowsCount = 0;
  const projectedTotalCrawled = currentTotalCrawled + queuedRows.length;
  const shouldInsertMoreQueueRows = projectedTotalCrawled < MAX_TOTAL_PAGES;

  if (discoveredQueueRows.length && shouldInsertMoreQueueRows) {
    const discoveredUrls = discoveredQueueRows
      .map((row) => row.normalized_url)
      .filter(Boolean);

    const { data: existingQueueRows, error: existingQueueError } = await supabase
      .from('crawl_queue')
      .select('normalized_url')
      .eq('job_id', jobId)
      .in('normalized_url', discoveredUrls);

    if (existingQueueError) {
      return res.status(500).json({ error: existingQueueError.message });
    }

    const existingQueueSet = new Set(
      (existingQueueRows || [])
        .map((row) => String(row.normalized_url || '').trim())
        .filter(Boolean)
    );

    const newQueueRows = discoveredQueueRows.filter(
      (row) => !existingQueueSet.has(row.normalized_url)
    );

    if (newQueueRows.length) {
      const insertQueue = await supabase
        .from('crawl_queue')
        .insert(newQueueRows);

      if (insertQueue.error) {
        return res.status(500).json({ error: insertQueue.error.message });
      }

      insertedQueueRowsCount = newQueueRows.length;
    }
  }

  if (successPages.length) {
    for (const page of successPages) {
      const pageQueueKey = normalizeUrl(page.requested_url || page.url) || normalizeUrl(page.url);
      if (!pageQueueKey) continue;

      await supabase
        .from('crawl_queue')
        .update({
          status: 'done',
          last_error: null
        })
        .eq('job_id', jobId)
        .eq('normalized_url', pageQueueKey);
    }
  }

  if (failedPages.length) {
    for (const page of failedPages) {
      const pageQueueKey = normalizeUrl(page.requested_url || page.url) || normalizeUrl(page.url);
      if (!pageQueueKey) continue;

      await supabase
        .from('crawl_queue')
        .update({
          status: 'failed',
          last_error: page.error || 'Failed to crawl page'
        })
        .eq('job_id', jobId)
        .eq('normalized_url', pageQueueKey);
    }
  }

  const newTotalCrawled = projectedTotalCrawled;
  const newTotalSaved = Number(job.total_saved || 0) + rowsToInsert.length;
  const newTotalDiscovered = Number(job.total_discovered || 0) + insertedQueueRowsCount;
  const reachedMaxLimit = newTotalCrawled >= MAX_TOTAL_PAGES;

  await supabase
    .from('crawl_jobs')
    .update({
      total_crawled: newTotalCrawled,
      total_saved: newTotalSaved,
      total_discovered: newTotalDiscovered,
      status: reachedMaxLimit ? 'completed' : 'running',
      finished_at: reachedMaxLimit ? new Date().toISOString() : null
    })
    .eq('id', jobId);

  if (reachedMaxLimit) {
    await supabase
      .from('crawl_queue')
      .update({ status: 'skipped', last_error: 'Maximum crawl limit reached' })
      .eq('job_id', jobId)
      .eq('status', 'queued');
  }

  return res.status(200).json({
    success: true,
    jobId,
    status: reachedMaxLimit ? 'completed' : 'running',
    message: reachedMaxLimit ? 'Maximum crawl limit reached' : undefined,
    batchSize: queuedRows.length,
    crawledNow: successPages.length,
    savedNow: rowsToInsert.length,
    failedNow: failedPages.length,
    discoveredNow: insertedQueueRowsCount,
    totalCrawled: newTotalCrawled,
    totalSaved: newTotalSaved,
    totalDiscovered: newTotalDiscovered,
    maxTotalPages: MAX_TOTAL_PAGES
  });
}

// ========================================
// CRAWL RUN BATCH - END
// ========================================

// ========================================
// CRAWL STATUS - START
// ========================================

async function handleCrawlStatus(req, res, body) {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const jobId = String(body.jobId || body.job_id || '').trim();

  if (!jobId) {
    return res.status(400).json({ error: 'Missing jobId' });
  }

  const { data: job, error: jobError } = await supabase
    .from('crawl_jobs')
    .select('id, agent_id, status, total_discovered, total_crawled, total_saved, current_batch, finished_at')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return res.status(404).json({ error: 'Crawl job not found' });
  }

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('agent_id, user_id')
    .eq('agent_id', job.agent_id)
    .eq('user_id', user.id)
    .single();

  if (agentError || !agent) {
    return res.status(403).json({ error: 'Access denied for this crawl job' });
  }

  const { count: queuedCount, error: queuedError } = await supabase
    .from('crawl_queue')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('status', 'queued');

  if (queuedError) {
    return res.status(500).json({ error: queuedError.message });
  }

  const { count: processingCount, error: processingError } = await supabase
    .from('crawl_queue')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('status', 'processing');

  if (processingError) {
    return res.status(500).json({ error: processingError.message });
  }

  const effectiveStatus =
    Number(queuedCount || 0) === 0 && Number(processingCount || 0) === 0
      ? 'completed'
      : String(job.status || 'running');

  return res.status(200).json({
    success: true,
    jobId: job.id,
    status: effectiveStatus,
    totalDiscovered: Number(job.total_discovered || 0),
    totalCrawled: Number(job.total_crawled || 0),
    totalSaved: Number(job.total_saved || 0),
    currentBatch: Number(job.current_batch || 0),
    remainingQueued: Number(queuedCount || 0),
    processingCount: Number(processingCount || 0),
    finishedAt: job.finished_at || null
  });
}

// ========================================
// CRAWL STATUS - END
// ========================================

// ========================================
// CRAWL SITE - START
// ========================================

async function handleCrawlSite(req, res, body) {
  const user = await requireAuthenticatedUser(req, res);
  if (!user) return;

  const agentId = String(body.agentId || body.agent_id || '').trim();
  const requestedUrl = String(body.url || body.siteUrl || body.site_url || '').trim();
  const requestedSiteDomain = String(body.siteDomain || body.site_domain || '').trim();

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }

  if (!process.env.SUPABASE_URL) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY' });
  }

  const { data: existingAgent, error: existingError } = await supabase
    .from('agents')
    .select('agent_id, user_id, site_domain')
    .eq('agent_id', agentId)
    .eq('user_id', user.id)
    .single();

  if (existingError || !existingAgent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const crawlUrl =
    requestedUrl ||
    requestedSiteDomain ||
    String(existingAgent.site_domain || '').trim();

  if (!crawlUrl) {
    return res.status(400).json({ error: 'Missing crawl url/siteDomain and agent has no saved site_domain' });
  }

  try {
    const crawlResult = await crawlSinglePage(crawlUrl);
    const rowsToInsert = normalizeCrawlResultToRows(crawlResult, agentId);

    if (!rowsToInsert.length) {
      console.error('CRAWL NORMALIZE ERROR: No valid rows produced from crawl result');
      return res.status(500).json({ error: 'Crawler returned no valid rows to insert' });
    }

    console.log('CRAWL ROWS TO INSERT:', rowsToInsert.length);
    console.log('CRAWL SAMPLE ROW:', rowsToInsert[0]);

    const deleteResult = await supabase
      .from('site_content')
      .delete()
      .eq('agent_id', agentId);

    if (deleteResult.error) {
      return res.status(500).json({ error: deleteResult.error.message });
    }

    const insertResult = await supabase
      .from('site_content')
      .insert(rowsToInsert);

    if (insertResult.error) {
      console.error('SITE_CONTENT INSERT ERROR:', insertResult.error);
      return res.status(500).json({ error: insertResult.error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Crawl saved',
      pagesCrawled: rowsToInsert.length
    });
  } catch (err) {
    console.error('CRAWL FAILED:', err);
    return res.status(500).json({
      error: err && err.message ? err.message : 'Crawl failed'
    });
  }
}

// ========================================
// CRAWL SITE - END
// ========================================

// ========================================
// AGENT CONFIG - START
// ========================================

async function handleAgentConfig(req, res, body) {
  const query = req.query || {};
  const agentId = String(body.agentId || body.agent_id || query.agentId || '').trim();

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }

  if (!process.env.SUPABASE_URL) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY' });
  }

  const { data, error } = await supabase
    .from('agents')
    .select('agent_id, agent_name, welcome_message, theme_color, site_domain')
    .eq('agent_id', agentId)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  return res.status(200).json({
    agentId: data.agent_id,
    agentName: data.agent_name,
    welcomeMessage: data.welcome_message,
    themeColor: data.theme_color,
    siteDomain: data.site_domain
  });
}

// ========================================
// AGENT CONFIG - END
// ========================================

// ========================================
// CHAT HELPERS - START
// ========================================

function cleanText(value) {
  return String(value || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function limitText(value, max) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  return text.slice(0, max);
}

function normalizeHistoryItems(history, maxItems = 8) {
  if (!Array.isArray(history)) return [];

  return history
    .map((item) => ({
      role: item && item.role === 'assistant' ? 'assistant' : 'user',
      content: limitText(item && item.content ? item.content : '', 1200)
    }))
    .filter((item) => item.content)
    .slice(-maxItems);
}

function getLanguageLabel(language) {
  const lang = String(language || '').toLowerCase();
  if (lang.startsWith('hr')) return 'Croatian';
  if (lang.startsWith('de')) return 'German';
  if (lang.startsWith('it')) return 'Italian';
  return 'English';
}

function buildAdaptiveSystemPrompt(languageLabel) {
  return `

Identitet: Ti si ljubazan i stručan asistent za web stranicu. Piši jednostavno, prirodno i prijateljski i ne haluciniraj.

PRIORITET IZVORA:
1. prvo koristi trenutnu otvorenu stranicu (Page URL, Page title, Main H1, Headings, Current page content)
2. zatim koristi relevantni crawl kontekst samo kao dopunu ili fallback
3. opće znanje koristi samo za bezopasna opća pitanja i samo ako nije u suprotnosti sa sadržajem stranice

PRAVILA:
- Stil odgovora prilagodi vrsti stranice: za prodajne i poslovne stranice budi praktičan i jasan; za edukativne stranice budi jednostavan i objašnjavaj bez suvišne teorije.
- Ako postoji link koji moze korisniku pomoci uvijek ponudi na kraju.
- Ako korisnik postavi kratko follow-up pitanje poput "ok", "može", "objasni", "nastavi", "tema", "likovi", "glavni likovi", "a sporedni", poveži ga sa prethodnim pitanjem i aktivnom temom.
- Ako Current page content postoji i odnosi se na otvoreni URL, nemoj ga ignorirati čak i ako crawl sadrži druge slične stranice.
- Ako je pitanje očito vezano uz trenutnu stranicu, nemoj odgovarati podacima sa druge stranice osim ako to jasno kažeš kao dopunu.
- Ako traženi podatak nije potvrđen u trenutnoj stranici ni u crawl podacima, jasno reci da ga nemaš potvrđenog. Ne izmišljaj.
- Piši kratke i jasne odgovore, idealno do 150 riječi.
- Za specifične informacije o ovoj stranici ili poslovanju koristi samo potvrđene podatke iz dostupnog sadržaja stranice i crawla.
- Ako postoji relevantna ili srodna stranica unutar sajta, možeš ponuditi 1 do 3 najrelevantnije poveznice sa kratkim objašnjenjem.
- Ne daj generičke savjete poput odlaska drugdje ili traženja po internetu osim ako to korisnik izričito zatraži.
- Odgovaraj na istom jeziku kojim se korisnik obraća.
- Ako korisnik ponovi isto pitanje, odgovori kratko i korisno bez nepotrebnog ponavljanja.
- Svaki odgovor završi blagim relevantnim CTA-om.
- Ograničenja: Ne odgovaraj na pitanja o programiranju, hakiranju ili tehničkim zloupotrebama.
- Ako je korisnička poruka uvredljiva, vulgarna, prijeteća, besmislena ili nije povezana sa sadržajem web stranice, odgovori samo jednom kratkom rečenicom:
  "Tu sam ako trebaš pomoć oko sadržaja ove stranice."
   Nemoj odgovarati na uvredu, nemoj se izvinjavati, nemoj objašnjavati i nemoj nastavljati razgovor van teme.

Answer in ${languageLabel}
`.trim();
}

function buildUserPrompt(payload) {
  const headingsText = Array.isArray(payload.headings) ? payload.headings.join(' | ') : '';
  const historyText = Array.isArray(payload.history) && payload.history.length
    ? payload.history
        .slice(-6)
        .map((item) => `${item.role}: ${item.content}`)
        .join('\n')
    : 'N/A';

  const currentPageContent = payload.includeCurrentPageContent
    ? (payload.pageText || payload.pageContext || 'N/A')
    : 'N/A';

  return `
User message:
${payload.message || 'N/A'}

Resolved query:
${payload.resolvedQuery || payload.message || 'N/A'}

Active topic:
${payload.activeTopic || 'N/A'}

Is short follow up:
${payload.isShortFollowUp ? 'yes' : 'no'}

Previous user message:
${payload.previousUserMessage || 'N/A'}

Previous assistant message:
${payload.previousAssistantMessage || 'N/A'}

Page language:
${payload.language || 'en'}

Page title:
${payload.pageTitle || 'N/A'}

Page description:
${payload.pageDescription || 'N/A'}

Headings:
${headingsText || 'N/A'}

Main H1:
${payload.h1 || 'N/A'}

Page URL:
${payload.pageUrl || 'N/A'}

Canonical URL:
${payload.canonicalUrl || 'N/A'}

Page type hint:
${payload.pageTypeHint || 'general'}

Current page context ready:
${payload.pageContextReady ? 'yes' : 'no'}

Current page text length:
${payload.pageTextLength || 0}

Current page preview:
${payload.pageTextPreview || 'N/A'}

Current page content:
${currentPageContent}

Matched current page in crawl:
${payload.currentPageMatched ? 'yes' : 'no'}

Suggested relevant link:
${payload.suggestedRelevantLink || 'N/A'}

Relevant crawled website context:
${payload.crawlContext || 'N/A'}

Recent conversation:
${historyText}
`.trim();
}

function buildLinkSuggestionReply(language, candidates) {
  const lang = String(language || 'en').toLowerCase();
  const items = (candidates || []).slice(0, 2);

  if (!items.length) return '';

  if (lang.startsWith('de')) {
    if (items.length === 1) {
      return `Ich habe hier keinen vollständigen Inhalt zu diesem Thema, aber es gibt auf der Website offenbar eine passende Seite: ${items[0].title} – ${items[0].url}`;
    }
    return `Ich habe hier keinen vollständigen Inhalt zu diesem Thema, aber auf der Website gibt es passende Seiten:\n- ${items[0].title} – ${items[0].url}\n- ${items[1].title} – ${items[1].url}`;
  }

  if (lang.startsWith('hr')) {
    if (items.length === 1) {
      return `Nemam ovdje puni sadržaj o toj temi, ali na stranici očito postoji relevantan članak: ${items[0].title} – ${items[0].url}`;
    }
    return `Nemam ovdje puni sadržaj o toj temi, ali na stranici postoje relevantne poveznice:\n- ${items[0].title} – ${items[0].url}\n- ${items[1].title} – ${items[1].url}`;
  }

  if (lang.startsWith('it')) {
    if (items.length === 1) {
      return `Qui non ho il contenuto completo su questo argomento, ma sul sito esiste una pagina pertinente: ${items[0].title} – ${items[0].url}`;
    }
    return `Qui non ho il contenuto completo su questo argomento, ma sul sito ci sono pagine pertinenti:\n- ${items[0].title} – ${items[0].url}\n- ${items[1].title} – ${items[1].url}`;
  }

  if (items.length === 1) {
    return `I do not have the full content for that topic here, but there is a relevant page on the website: ${items[0].title} – ${items[0].url}`;
  }

  return `I do not have the full content for that topic here, but there are relevant pages on the website:\n- ${items[0].title} – ${items[0].url}\n- ${items[1].title} – ${items[1].url}`;
}

// ========================================
// CHAT HELPERS - END
// ========================================

// ========================================
// CRAWL CHAT HELPERS - START
// ========================================

function safeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

const GENERIC_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'for', 'to', 'of', 'in', 'on', 'at', 'by', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'da', 'je', 'su', 'u', 'na', 'za', 'od', 'do', 'i', 'ili', 'ali', 'se', 'po', 'sa',
  'der', 'die', 'das', 'und', 'oder', 'aber', 'ein', 'eine', 'ist', 'im', 'in', 'am', 'zu', 'von', 'mit',
  'il', 'lo', 'la', 'gli', 'le', 'e', 'o', 'ma', 'di', 'da', 'in', 'su', 'per', 'con', 'un', 'una', 'è',
  'le', 'la', 'les', 'de', 'des', 'du', 'et', 'ou', 'mais', 'dans', 'sur', 'pour', 'avec', 'est', 'une', 'un'
]);

function normalizeStringForTopic(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s/-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeTopic(value) {
  return normalizeStringForTopic(value)
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueItems(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function filterSignificantTokens(tokens) {
  return (tokens || []).filter((token) => {
    if (!token) return false;
    if (token.length <= 2) return false;
    if (GENERIC_STOP_WORDS.has(token)) return false;
    return true;
  });
}

function isShortFollowUpQuestion(message) {
  const text = normalizeStringForTopic(message);
  if (!text) return false;

  const genericFollowUps = new Set([
    'ok', 'okej', 'okey', 'da', 'ne', 'moze', 'može', 'hvala',
    'nastavi', 'continue', 'thanks', 'thank you', 'yes', 'no',
    'detaljnije', 'detail', 'details', 'more', 'mehr', 'grazie', 'danke'
  ]);

  if (genericFollowUps.has(text)) return true;

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (text.length <= 18) return true;
  if (wordCount <= 2) return true;

  if (/^(what|who|where|when|why|how)\b/.test(text)) return true;
  if (/^(sto|šta|sta|tko|ko|gdje|gde|kada|kad|zasto|zašto|kako)\b/.test(text)) return true;
  if (/^(was|wer|wo|wann|warum|wie)\b/.test(text)) return true;
  if (/^(che|chi|dove|quando|perche|perché|come)\b/.test(text)) return true;
  if (/^(quel|quale|quali)\b/.test(text)) return true;

  return false;
}

function extractTopicFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';

  const cleaned = raw
    .replace(/^[\s"'`„“”‘’]+|[\s"'`„“”‘’]+$/g, '')
    .replace(/^(please|pls|pls\.?|can you|could you|would you|tell me about)\s+/i, '')
    .replace(/^(molim|mozes li|možeš li|reci mi|objasni|napisi|napiši)\s+/i, '')
    .replace(/^(bitte|erklar|erklär|erklaere|erkläre|sag mir)\s+/i, '')
    .replace(/^(per favore|spiega|dimmi|parlami di)\s+/i, '')
    .replace(/^(what is|who is|where is|tell me about|explain)\s+/i, '')
    .replace(/^(tema|analiza|opis|details|detail|info|information|about)\s+/i, '')
    .replace(/\?+$/g, '')
    .trim();

  if (cleaned.length < 3) return '';
  if (isShortFollowUpQuestion(cleaned)) return '';

  return cleaned;
}

function getActiveTopicFromHistory(history, currentMessage) {
  const current = String(currentMessage || '').trim();
  const safeHistory = Array.isArray(history) ? history : [];

  if (!isShortFollowUpQuestion(current)) {
    const direct = extractTopicFromText(current);
    if (direct && direct.length > 3) return direct;
  }

  for (let i = safeHistory.length - 1; i >= 0; i -= 1) {
    const item = safeHistory[i];
    if (!item || item.role !== 'user') continue;
    const topic = extractTopicFromText(item.content || '');
    if (topic && topic.length > 3) return topic;
  }

  return extractTopicFromText(current);
}

function buildResolvedQuery(activeTopic, userMessage) {
  const topic = String(activeTopic || '').trim();
  const message = String(userMessage || '').trim();

  if (!topic) return message;
  if (!message) return topic;
  if (isShortFollowUpQuestion(message)) return topic + ' ' + message;
  return message;
}

function compactUrlPath(value) {
  return normalizeStringForTopic(String(value || '').replace(/^https?:\/\//i, '').replace(/^www\./i, ''));
}

function exactPhraseBoost(fieldValue, phrase, score) {
  const value = normalizeStringForTopic(fieldValue);
  const normalizedPhrase = normalizeStringForTopic(phrase);
  if (!value || !normalizedPhrase) return 0;
  return value.includes(normalizedPhrase) ? score : 0;
}

function tokenMatchScore(fieldValue, tokens, weight) {
  const value = normalizeStringForTopic(fieldValue);
  if (!value) return 0;

  let score = 0;
  for (const token of tokens) {
    if (value.includes(token)) score += weight;
  }
  return score;
}

function scoreHeadingIntent(headings, userMessage) {
  let score = 0;

  const msg = normalizeStringForTopic(userMessage);
  const joined = normalizeStringForTopic(
    Array.isArray(headings) ? headings.join(' | ') : (headings || '')
  );

  if (!joined || !msg) return 0;

  const wantsWho = /\b(who|tko|ko|wer|chi)\b/.test(msg);
  const wantsWhat = /\b(what|sto|sta|was|che)\b/.test(msg);
  const wantsWhere = /\b(where|gdje|gde|wo|dove)\b/.test(msg);
  const wantsWhen = /\b(when|kada|kad|wann|quando)\b/.test(msg);
  const wantsHow = /\b(how|kako|wie|come)\b/.test(msg);
  const wantsWhy = /\b(why|zasto|zašto|warum|perche|perché)\b/.test(msg);

  const wantsPrice = /\b(price|pricing|cost|cijena|cijene|kosten|preis|prezzo)\b/.test(msg);
  const wantsContact = /\b(contact|kontakt|kontakti|email|e-mail|phone|telefon|tel)\b/.test(msg);
  const wantsLocation = /\b(location|address|adresa|lokacija|standort|indirizzo)\b/.test(msg);
  const wantsTime = /\b(hours|opening|working hours|radno vrijeme|working time|arbeitszeit|orario)\b/.test(msg);
  const wantsAbout = /\b(about|overview|summary|sadrzaj|sazetak|sažetak|ubersicht|überblick|riassunto)\b/.test(msg);
  const wantsFeatures = /\b(features|services|service|usluge|funkcije|mogucnosti|mogućnosti|leistungen|servizi)\b/.test(msg);
  const wantsSteps = /\b(steps|process|how to|kako|procedure|postupak|koraci|schritte|passaggi)\b/.test(msg);
  const wantsFaq = /\b(faq|questions|pitanja|fragen|domande)\b/.test(msg);
  const wantsPolicy = /\b(policy|terms|privacy|refund|returns|uvjeti|pravila|politika|datenschutz|condizioni)\b/.test(msg);

  if (wantsPrice && /\b(price|pricing|cost|cijena|cijene|preis|kosten|prezzo)\b/.test(joined)) score += 34;
  if (wantsContact && /\b(contact|kontakt|email|e-mail|phone|telefon|tel)\b/.test(joined)) score += 34;
  if (wantsLocation && /\b(location|address|adresa|lokacija|standort|indirizzo)\b/.test(joined)) score += 34;
  if (wantsTime && /\b(hours|opening|working hours|radno vrijeme|arbeitszeit|orario)\b/.test(joined)) score += 34;
  if (wantsAbout && /\b(about|overview|summary|sadrzaj|sa[žz]etak|uberblick|überblick|riassunto)\b/.test(joined)) score += 28;
  if (wantsFeatures && /\b(features|services|service|usluge|funkcije|mogucnosti|mogućnosti|leistungen|servizi)\b/.test(joined)) score += 30;
  if (wantsSteps && /\b(steps|process|how to|kako|procedure|postupak|koraci|schritte|passaggi)\b/.test(joined)) score += 28;
  if (wantsFaq && /\b(faq|questions|pitanja|fragen|domande)\b/.test(joined)) score += 22;
  if (wantsPolicy && /\b(policy|terms|privacy|refund|returns|uvjeti|pravila|politika|datenschutz|condizioni)\b/.test(joined)) score += 30;

  if (wantsWho && /\b(team|author|about us|o nama|tim|kontakt|writer|creator|founder|osnivac|osnivač)\b/.test(joined)) score += 18;
  if (wantsWhat && /\b(overview|about|summary|opis|description|about us|o nama)\b/.test(joined)) score += 14;
  if (wantsWhere && /\b(location|address|adresa|lokacija|standort|indirizzo)\b/.test(joined)) score += 18;
  if (wantsWhen && /\b(hours|opening|schedule|vrijeme|datum|date|termin|orario)\b/.test(joined)) score += 18;
  if (wantsHow && /\b(process|steps|how to|kako|guide|upute|instructions|schritte|passaggi)\b/.test(joined)) score += 18;
  if (wantsWhy && /\b(about|benefits|advantages|zasto|zašto|warum|perche|perché)\b/.test(joined)) score += 14;

  return score;
}

function rankSiteContentRows(rows, activeTopic, resolvedQuery, userMessage) {
  if (!Array.isArray(rows)) return [];

  const topic = normalizeStringForTopic(activeTopic || '');
  const resolved = normalizeStringForTopic(resolvedQuery || '');
  const topicTokens = filterSignificantTokens(uniqueItems(tokenizeTopic(activeTopic || '')));
  const resolvedTokens = filterSignificantTokens(uniqueItems(tokenizeTopic(resolvedQuery || '')));

  return rows
    .map((row) => {
      let score = 0;

      const urlValue = compactUrlPath(row.url || '');
      const titleValue = normalizeStringForTopic(row.page_title || '');
      const h1Value = normalizeStringForTopic(row.h1 || '');
      const headingsValue = normalizeStringForTopic(Array.isArray(row.headings) ? row.headings.join(' | ') : row.headings || '');
      const previewValue = normalizeStringForTopic(row.text_preview || '');

      if (topic) {
        score += exactPhraseBoost(urlValue, topic, 220);
        score += exactPhraseBoost(titleValue, topic, 180);
        score += exactPhraseBoost(headingsValue, topic, 170);
        score += exactPhraseBoost(h1Value, topic, 120);
        score += exactPhraseBoost(previewValue, topic, 50);
      }

      if (resolved && resolved !== topic) {
        score += exactPhraseBoost(urlValue, resolved, 70);
        score += exactPhraseBoost(titleValue, resolved, 60);
        score += exactPhraseBoost(headingsValue, resolved, 55);
        score += exactPhraseBoost(h1Value, resolved, 40);
      }

      score += tokenMatchScore(urlValue, topicTokens, 34);
      score += tokenMatchScore(titleValue, topicTokens, 28);
      score += tokenMatchScore(headingsValue, topicTokens, 22);
      score += tokenMatchScore(h1Value, topicTokens, 14);
      score += tokenMatchScore(previewValue, topicTokens, 8);

      score += tokenMatchScore(urlValue, resolvedTokens, 10);
      score += tokenMatchScore(titleValue, resolvedTokens, 8);
      score += tokenMatchScore(headingsValue, resolvedTokens, 7);
      score += tokenMatchScore(h1Value, resolvedTokens, 4);
      score += tokenMatchScore(previewValue, resolvedTokens, 3);

      score += scoreHeadingIntent(row.headings, userMessage);

      return {
        ...row,
        _score: Math.round(score)
      };
    })
    .sort((a, b) => b._score - a._score);
}

function pickRelevantCrawledPages(rows, message, history, limit = 3) {
  const activeTopic = getActiveTopicFromHistory(history, message);
  const resolvedQuery = buildResolvedQuery(activeTopic, message);
  const ranked = rankSiteContentRows(rows, activeTopic, resolvedQuery, message);
  const useful = ranked.filter((row) => row._score > 0).slice(0, limit);

  return {
    activeTopic,
    resolvedQuery,
    pages: useful.length ? useful : ranked.slice(0, limit)
  };
}

function findRelevantLinkCandidates(rows, message, history, limit = 3) {
  const rankedData = pickRelevantCrawledPages(rows, message, history, Math.max(limit, 5));
  const scored = (rankedData.pages || [])
    .map((row) => ({
      title: String(row.page_title || row.h1 || row.url || '').trim(),
      url: String(row.url || '').trim(),
      score: Number(row._score || 0)
    }))
    .filter((item) => item.url && item.score > 0)
    .sort((a, b) => b.score - a.score);

  const deduped = [];
  const seen = new Set();

  for (const item of scored) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    deduped.push(item);
    if (deduped.length >= limit) break;
  }

  return {
    activeTopic: rankedData.activeTopic,
    resolvedQuery: rankedData.resolvedQuery,
    candidates: deduped
  };
}

function createUtf8StreamWriter(res) {
  let headersSent = false;
  let ended = false;

  function ensureHeaders() {
    if (headersSent) return;
    headersSent = true;

    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
  }

  return {
    write(chunk) {
      if (ended) return;
      if (!chunk) return;
      ensureHeaders();
      res.write(chunk);
    },

    end() {
      if (ended) return;
      ensureHeaders();
      ended = true;
      res.end();
    },

    get ended() {
      return ended;
    },

    get headersSent() {
      return headersSent || res.headersSent;
    }
  };
}

async function streamOpenAIResponseToNodeResponse(openaiRes, res) {
  if (!openaiRes.body) {
    throw new Error('OpenAI stream body is missing');
  }

  const writer = createUtf8StreamWriter(res);
  const reader = openaiRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const eventBlock of events) {
      const lines = eventBlock.split('\n');
      let payload = '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          payload += trimmed.slice(5).trim();
        }
      }

      if (!payload || payload === '[DONE]') {
        continue;
      }

      try {
        const parsed = JSON.parse(payload);

        if (parsed.type === 'response.output_text.delta' && parsed.delta) {
          writer.write(parsed.delta);
        }

        if (parsed.type === 'response.completed') {
          writer.end();
          return;
        }

        if (parsed.type === 'response.failed') {
          console.error('OPENAI STREAM FAILED:', parsed);
          writer.end();
          return;
        }
      } catch (err) {
        // ignore partial or malformed event block
      }
    }
  }

  if (buffer.trim()) {
    const lines = buffer.split('\n');
    let payload = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) {
        payload += trimmed.slice(5).trim();
      }
    }

    if (payload && payload !== '[DONE]') {
      try {
        const parsed = JSON.parse(payload);

        if (parsed.type === 'response.output_text.delta' && parsed.delta) {
          writer.write(parsed.delta);
        }
      } catch (err) {
        // ignore trailing partial event
      }
    }
  }

  writer.end();
}

// ========================================
// CRAWL CHAT HELPERS - END
// ========================================

// ========================================
// CHAT - START
// ========================================

async function getAgentWithAccess(agentId) {
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('agent_id, user_id, agent_name, welcome_message, theme_color, site_domain')
    .eq('agent_id', agentId)
    .maybeSingle();

  if (agentError || !agent) {
    return {
      agent: null,
      accessAllowed: false,
      reason: 'AGENT_NOT_FOUND'
    };
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select('status, is_active, current_period_end, created_at')
    .eq('user_id', agent.user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionError || !subscription) {
    return {
      agent,
      accessAllowed: false,
      reason: 'NO_SUBSCRIPTION'
    };
  }

  const isActive = subscription.is_active === true;
  const status = String(subscription.status || '').toLowerCase().trim();
  const periodEndRaw = subscription.current_period_end || null;

  if (!isActive) {
    return {
      agent,
      accessAllowed: false,
      reason: 'INACTIVE_SUBSCRIPTION'
    };
  }

  if (!periodEndRaw) {
    return {
      agent,
      accessAllowed: false,
      reason: 'MISSING_PERIOD_END'
    };
  }

  const now = new Date();
  const periodEnd = new Date(periodEndRaw);

  if (Number.isNaN(periodEnd.getTime()) || periodEnd < now) {
    return {
      agent,
      accessAllowed: false,
      reason: 'TRIAL_EXPIRED'
    };
  }

  if (!['trial', 'active', 'paid'].includes(status)) {
    return {
      agent,
      accessAllowed: false,
      reason: 'INVALID_STATUS'
    };
  }

  return {
    agent,
    accessAllowed: true,
    reason: null
  };
}

function normalizeComparableUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    const pathname = (url.pathname || '/').replace(/\/+$/, '') || '/';
    return (url.origin + pathname).toLowerCase();
  } catch (err) {
    return raw
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  }
}

function findCurrentPageRow(rows, pageUrl, pageTitle, h1) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const normalizedPageUrl = normalizeComparableUrl(pageUrl);
  const normalizedTitle = normalizeStringForTopic(pageTitle);
  const normalizedH1 = normalizeStringForTopic(h1);

  let bestRow = null;
  let bestScore = -1;

  for (const row of safeRows) {
    let score = 0;
    const rowUrl = normalizeComparableUrl(row && row.url ? row.url : '');
    const rowTitle = normalizeStringForTopic(row && row.page_title ? row.page_title : '');
    const rowH1 = normalizeStringForTopic(row && row.h1 ? row.h1 : '');

    if (normalizedPageUrl && rowUrl) {
      if (rowUrl === normalizedPageUrl) score += 1000;
      else if (rowUrl.includes(normalizedPageUrl) || normalizedPageUrl.includes(rowUrl)) score += 320;
    }

    if (normalizedTitle && rowTitle) {
      if (rowTitle === normalizedTitle) score += 220;
      else if (rowTitle.includes(normalizedTitle) || normalizedTitle.includes(rowTitle)) score += 120;
    }

    if (normalizedH1 && rowH1) {
      if (rowH1 === normalizedH1) score += 180;
      else if (rowH1.includes(normalizedH1) || normalizedH1.includes(rowH1)) score += 90;
    }

    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    }
  }

  if (bestScore < 120) return null;
  return { row: bestRow, score: bestScore };
}

function mergeCurrentPageIntoRelevantPages(relevantPages, currentPageMatch) {
  const rows = Array.isArray(relevantPages) ? relevantPages.slice() : [];

  if (!currentPageMatch || !currentPageMatch.row) {
    return rows;
  }

  const matchedUrl = String(currentPageMatch.row.url || '').trim();
  const exists = rows.some((row) => String(row && row.url ? row.url : '').trim() === matchedUrl);

  const boostedRow = {
    ...currentPageMatch.row,
    _score: Math.max(Number(currentPageMatch.row._score || 0), Number(currentPageMatch.score || 0))
  };

  if (exists) {
    return rows
      .map((row) => (
        String(row && row.url ? row.url : '').trim() === matchedUrl
          ? { ...row, _score: Math.max(Number(row._score || 0), boostedRow._score) }
          : row
      ))
      .sort((a, b) => Number(b._score || 0) - Number(a._score || 0));
  }

  return [boostedRow].concat(rows).sort((a, b) => Number(b._score || 0) - Number(a._score || 0));
}

function getPreviousHistoryMessages(history) {
  const safeHistory = Array.isArray(history) ? history : [];
  let previousUserMessage = '';
  let previousAssistantMessage = '';

  for (let i = safeHistory.length - 1; i >= 0; i -= 1) {
    const item = safeHistory[i];
    if (!previousAssistantMessage && item && item.role === 'assistant' && item.content) {
      previousAssistantMessage = item.content;
    }
    if (!previousUserMessage && item && item.role === 'user' && item.content) {
      previousUserMessage = item.content;
    }
    if (previousUserMessage && previousAssistantMessage) break;
  }

  return {
    previousUserMessage: limitText(previousUserMessage, 600),
    previousAssistantMessage: limitText(previousAssistantMessage, 600)
  };
}


function looksLikeCurrentPageQuestion(message, pageTitle, h1, headings) {
  const msg = normalizeStringForTopic(message || '');
  if (!msg) return false;

  if (isShortFollowUpQuestion(msg)) return true;

  const pageSignals = [
    normalizeStringForTopic(pageTitle || ''),
    normalizeStringForTopic(h1 || ''),
    normalizeStringForTopic(Array.isArray(headings) ? headings.join(' | ') : '')
  ].filter(Boolean);

  const intentHints = [
    'who', 'what', 'where', 'when', 'why', 'how',
    'tko', 'ko', 'sto', 'šta', 'sta', 'gdje', 'gde', 'kada', 'kad', 'zasto', 'zašto', 'kako',
    'wer', 'was', 'wo', 'wann', 'warum', 'wie',
    'chi', 'che', 'dove', 'quando', 'perche', 'perché', 'come',
    'summary', 'overview', 'details', 'about', 'faq',
    'price', 'pricing', 'cost', 'contact', 'hours', 'location', 'address',
    'services', 'features', 'process', 'steps', 'policy', 'terms', 'returns', 'refund',
    'likovi', 'glavni likovi', 'sporedni likovi', 'tema', 'pouka', 'analiza',
    'radnja', 'sadržaj', 'sadrzaj', 'redoslijed', 'opis', 'karakteristike',
    'opis proizvoda', 'opis usluge', 'informacije', 'info'
  ];

  if (intentHints.some((hint) => msg.includes(hint))) {
    return true;
  }

  const msgTokens = filterSignificantTokens(tokenizeTopic(msg));
  if (!msgTokens.length) return false;

  return pageSignals.some((field) =>
    msgTokens.some((token) => field.includes(token))
  );
}

function detectCrossPageIntent(message, pageTitle, h1, headings) {
  const msg = normalizeStringForTopic(message || '');
  if (!msg) return false;

  const currentSignals = [
    normalizeStringForTopic(pageTitle || ''),
    normalizeStringForTopic(h1 || ''),
    normalizeStringForTopic(Array.isArray(headings) ? headings.join(' | ') : (headings || ''))
  ].filter(Boolean);

  const currentTokens = new Set(
    filterSignificantTokens(
      uniqueItems(
        currentSignals.flatMap((value) => tokenizeTopic(value))
      )
    )
  );

  const messageTokens = filterSignificantTokens(uniqueItems(tokenizeTopic(msg)));
  if (!messageTokens.length || !currentTokens.size) return false;

  const foreignTokens = messageTokens.filter((token) => !currentTokens.has(token));
  const overlapTokens = messageTokens.filter((token) => currentTokens.has(token));

  const quotedOrNamedEntityPattern = /["“”'„][^"“”'„]{3,}["“”'„]|([A-ZČĆŽŠĐ][\p{L}\-]+(?:\s+[A-ZČĆŽŠĐ][\p{L}\-]+){1,6})/u;
  const hasNamedEntitySignal = quotedOrNamedEntityPattern.test(String(message || ''));
  const mentionsCurrentTitleDirectly = currentSignals.some((signal) => signal && msg.includes(signal));

  if (mentionsCurrentTitleDirectly) return false;

  if (foreignTokens.length >= 3 && overlapTokens.length <= 1) return true;
  if (foreignTokens.length >= 2 && overlapTokens.length === 0) return true;
  if (hasNamedEntitySignal && foreignTokens.length >= 2) return true;

  return false;
}

function shouldUseOnlyCurrentPageMode(params) {
  const hasStrongCurrentPageContent =
    !!params.pageContextReady &&
    (
      String(params.pageText || '').trim().length > 1200 ||
      String(params.pageContext || '').trim().length > 1200 ||
      String(params.pageTextPreview || '').trim().length > 220 ||
      Number(params.pageTextLength || 0) > 1200
    );

  const hasMatchedCurrentPage = !!(params.currentPageMatch && params.currentPageMatch.row);

  const questionLooksLocal = looksLikeCurrentPageQuestion(
    params.message,
    params.pageTitle,
    params.h1,
    params.headings
  );

  const crossPageIntent = detectCrossPageIntent(
    params.message,
    params.pageTitle,
    params.h1,
    params.headings
  );

  if (crossPageIntent) return false;

  return hasStrongCurrentPageContent && hasMatchedCurrentPage && questionLooksLocal;
}


function deriveActiveTopic(message, history, pageTitle, h1, headings) {
  const rawMessage = cleanText(message || '');
  if (!rawMessage) return '';

  const directTopic = extractTopicFromText(rawMessage);
  const explicitCrossPage = detectCrossPageIntent(rawMessage, pageTitle, h1, headings);
  const shortFollowUp = isShortFollowUpQuestion(rawMessage);
  const significantTokens = filterSignificantTokens(uniqueItems(tokenizeTopic(rawMessage)));

  if (explicitCrossPage) {
    return limitText(directTopic || rawMessage, 200);
  }

  if (!shortFollowUp && significantTokens.length >= 3) {
    return limitText(directTopic || rawMessage, 200);
  }

  const topicFromHistory = getActiveTopicFromHistory(history, rawMessage);
  return limitText(topicFromHistory || directTopic || rawMessage, 200);
}

function deriveResolvedQuery(activeTopic, message, isShortFollowUp) {
  const topic = cleanText(activeTopic || '');
  const msg = cleanText(message || '');

  if (!msg) return topic;
  if (!topic) return limitText(msg, 300);
  if (isShortFollowUp) return limitText(topic + ' -> ' + msg, 300);
  return limitText(msg, 300);
}

function deriveIsShortFollowUp(message, pageTitle, h1, headings) {
  const rawMessage = cleanText(message || '');
  if (!rawMessage) return false;

  if (detectCrossPageIntent(rawMessage, pageTitle, h1, headings)) {
    return false;
  }

  const directTopic = extractTopicFromText(rawMessage);
  const significantTokens = filterSignificantTokens(uniqueItems(tokenizeTopic(directTopic || rawMessage)));

  if (directTopic && significantTokens.length >= 2) {
    return false;
  }

  return isShortFollowUpQuestion(rawMessage);
}

function buildSuggestedRelevantLinkEntry(rows, currentPageMatch, explicitCrossPageIntent) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) return null;

  const currentUrl = normalizeComparableUrl(currentPageMatch && currentPageMatch.row ? currentPageMatch.row.url : '');

  for (const row of safeRows) {
    const rowUrl = normalizeComparableUrl(row && row.url ? row.url : '');
    if (!rowUrl) continue;
    if (currentUrl && rowUrl == currentUrl) {
      if (explicitCrossPageIntent) continue;
      continue;
    }

    return {
      title: String(row.page_title || row.h1 || row.url || '').trim(),
      url: String(row.url || '').trim()
    };
  }

  return null;
}

async function handleChat(req, res, body) {
  const agentId = String(body.agentId || body.agent_id || '').trim();
  const message = String(body.message || '').trim();

  const language = limitText(body.language || 'en', 20);
  const pageTypeHint = limitText(body.pageTypeHint || 'general', 50);

  const pageTitle = limitText(body.pageTitle || '', 300);
  const pageDescription = limitText(body.pageDescription || '', 500);
  const pageUrl = limitText(body.pageUrl || '', 500);
  const canonicalUrl = limitText(body.canonicalUrl || pageUrl || '', 500);
  const h1 = limitText(body.h1 || '', 300);

  const pageContext = limitText(body.pageContext || '', 5000);
  const pageText = limitText(body.pageText || body.pageContext || '', 7000);
  const pageTextPreview = limitText(body.pageTextPreview || pageText || pageContext || '', 1200);
  const pageTextLength = Number(body.pageTextLength || pageText.length || pageContext.length || 0);
  const pageContextReady = body.pageContextReady === true || body.pageContextReady === 'true' || pageTextLength > 180;

  const headings = Array.isArray(body.headings)
    ? body.headings.map((item) => limitText(item, 200)).filter(Boolean).slice(0, 12)
    : [];

  const history = normalizeHistoryItems(body.history, 8);
  const providedResolvedQuery = limitText(body.resolvedQuery || '', 300);
  const providedActiveTopic = limitText(body.activeTopic || '', 200);
  const providedPreviousUserMessage = limitText(body.previousUserMessage || '', 600);
  const providedPreviousAssistantMessage = limitText(body.previousAssistantMessage || '', 600);
  const providedIsShortFollowUp = body.isShortFollowUp === true || body.isShortFollowUp === 'true';

  if (!agentId || !message) {
    return res.status(400).json({ error: 'Missing agentId or message' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
  }

  const accessCheck = await getAgentWithAccess(agentId);

  if (!accessCheck.agent) {
    return res.status(404).json({
      error: 'Agent not found'
    });
  }

  if (!accessCheck.accessAllowed) {
    return res.status(403).json({
      error: 'TRIAL_EXPIRED',
      code: accessCheck.reason || 'ACCESS_DENIED',
      message: 'Subscription expired.'
    });
  }

  let crawledRows = [];

  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('url, page_title, meta_description, h1, headings, text_preview, content')
      .eq('agent_id', agentId);

    if (!error && Array.isArray(data)) {
      crawledRows = data;
    }
  } catch (e) {
    crawledRows = [];
  }

  const explicitCrossPageIntent = detectCrossPageIntent(message, pageTitle, h1, headings);
  const computedIsShortFollowUp = providedIsShortFollowUp === true
    ? true
    : deriveIsShortFollowUp(message, pageTitle, h1, headings);
  const computedActiveTopic = deriveActiveTopic(message, history, pageTitle, h1, headings);
  const computedResolvedQuery = providedResolvedQuery && computedIsShortFollowUp && !explicitCrossPageIntent
    ? limitText(providedResolvedQuery, 300)
    : deriveResolvedQuery(computedActiveTopic, message, computedIsShortFollowUp);
  const previousMessages = getPreviousHistoryMessages(history);
  const previousUserMessage = providedPreviousUserMessage || previousMessages.previousUserMessage;
  const previousAssistantMessage = providedPreviousAssistantMessage || previousMessages.previousAssistantMessage;

  const rankedContext = pickRelevantCrawledPages(crawledRows, computedResolvedQuery || message, explicitCrossPageIntent ? [] : history, 3);
  let relevantPages = Array.isArray(rankedContext.pages) ? rankedContext.pages : [];

  const currentPageMatch =
    findCurrentPageRow(crawledRows, canonicalUrl || pageUrl, pageTitle, h1) ||
    findCurrentPageRow(crawledRows, pageUrl, pageTitle, h1);

  if (!explicitCrossPageIntent) {
    relevantPages = mergeCurrentPageIntoRelevantPages(relevantPages, currentPageMatch);
  }

  const hasStrongCurrentPageContent =
    pageContextReady &&
    (
      pageText.length > 180 ||
      pageContext.length > 180 ||
      pageTextPreview.length > 180 ||
      pageTextLength > 180
    );

  const currentPageRowContent = currentPageMatch && currentPageMatch.row
    ? String(currentPageMatch.row.content || currentPageMatch.row.text_preview || '')
    : '';

  const hasStrongMatchedCurrentPage = !!(currentPageMatch && currentPageRowContent.trim().length > 180);

  const currentPageOnlyMode = shouldUseOnlyCurrentPageMode({
    message,
    pageTitle,
    h1,
    headings,
    pageContext,
    pageText,
    pageTextPreview,
    pageTextLength,
    pageContextReady,
    currentPageMatch
  });

  const nonCurrentRelevantPages = explicitCrossPageIntent && currentPageMatch && currentPageMatch.row
    ? relevantPages.filter((row) => normalizeComparableUrl(row && row.url ? row.url : '') !== normalizeComparableUrl(currentPageMatch.row.url || ''))
    : relevantPages;

  const pagesForPrompt = currentPageOnlyMode
    ? (currentPageMatch && currentPageMatch.row ? [
        {
          ...currentPageMatch.row,
          _score: Math.max(Number(currentPageMatch.row._score || 0), Number(currentPageMatch.score || 0))
        }
      ] : [])
    : (Array.isArray(nonCurrentRelevantPages) && nonCurrentRelevantPages.length ? nonCurrentRelevantPages.slice(0, 3) : (Array.isArray(relevantPages) && relevantPages.length ? relevantPages.slice(0, 3) : crawledRows.slice(0, 3)));

  const hasStrongRelevantContent = Array.isArray(pagesForPrompt) && pagesForPrompt.some((row) => {
    const content = String(row.content || row.text_preview || '');
    return content.trim().length > 180 && Number(row._score || 0) >= 20;
  });

  const linkCandidateData = currentPageOnlyMode
    ? { activeTopic: computedActiveTopic, resolvedQuery: computedResolvedQuery, candidates: [] }
    : findRelevantLinkCandidates(crawledRows, computedResolvedQuery || message, explicitCrossPageIntent ? [] : history, 3);

  const linkCandidates = linkCandidateData.candidates || [];

  if (!hasStrongCurrentPageContent && !hasStrongMatchedCurrentPage && !hasStrongRelevantContent && linkCandidates.length > 0) {
    return res.status(200).json({
      reply: buildLinkSuggestionReply(language, linkCandidates)
    });
  }

  const suggestedRelevantLinkEntry = buildSuggestedRelevantLinkEntry(pagesForPrompt, currentPageMatch, explicitCrossPageIntent);
  const suggestedRelevantLink = suggestedRelevantLinkEntry
    ? (suggestedRelevantLinkEntry.title + ' – ' + suggestedRelevantLinkEntry.url)
    : 'N/A';

  let crawlContext = '';

  try {
    if (!currentPageOnlyMode) {
      const rowsToUse = Array.isArray(pagesForPrompt) && pagesForPrompt.length
        ? pagesForPrompt.slice(0, 3)
        : crawledRows.slice(0, 3);

      if (rowsToUse.length > 0) {
        const shortRows = rowsToUse.map((row) => {
          const headingsValue = safeJsonArray(row.headings);

          return {
            url: row.url || '',
            page_title: row.page_title || '',
            meta_description: row.meta_description || '',
            h1: row.h1 || '',
            headings: headingsValue.slice(0, 8),
            text_preview: limitText(row.text_preview || '', 1000),
            content: limitText(row.content || '', 2500),
            score: Number(row._score || 0)
          };
        });

        crawlContext = JSON.stringify(shortRows, null, 2);
      }
    }
  } catch (e) {
    crawlContext = '';
  }

  const includeCurrentPageContent = hasStrongCurrentPageContent || currentPageOnlyMode || !!currentPageMatch;

  console.log('CHAT CONTEXT DEBUG:', {
    agentId,
    message,
    activeTopic: computedActiveTopic,
    resolvedQuery: computedResolvedQuery,
    isShortFollowUp: computedIsShortFollowUp,
    includeCurrentPageContent,
    currentPageOnlyMode,
    crossPageIntent: explicitCrossPageIntent,
    suggestedRelevantLink,
    pageContextReady,
    pageTextLength,
    currentPageMatch: currentPageMatch ? {
      score: currentPageMatch.score,
      url: currentPageMatch.row && currentPageMatch.row.url ? currentPageMatch.row.url : '',
      title: currentPageMatch.row && currentPageMatch.row.page_title ? currentPageMatch.row.page_title : '',
      h1: currentPageMatch.row && currentPageMatch.row.h1 ? currentPageMatch.row.h1 : ''
    } : null,
    crawlRowsUsed: currentPageOnlyMode ? 0 : (Array.isArray(pagesForPrompt) ? pagesForPrompt.length : 0),
    topMatches: relevantPages.slice(0, 3).map((row) => ({
      score: row._score || 0,
      url: row.url || '',
      h1: row.h1 || '',
      title: row.page_title || ''
    }))
  });

  const languageLabel = getLanguageLabel(language);
  const systemPrompt = buildAdaptiveSystemPrompt(languageLabel);

  const userPrompt = buildUserPrompt({
    message,
    resolvedQuery: computedResolvedQuery,
    activeTopic: computedActiveTopic,
    isShortFollowUp: computedIsShortFollowUp,
    previousUserMessage,
    previousAssistantMessage,
    language,
    pageTitle,
    pageDescription,
    headings,
    h1,
    pageContext,
    pageText,
    pageTextPreview,
    pageTextLength,
    pageContextReady,
    crawlContext,
    pageUrl,
    canonicalUrl,
    pageTypeHint,
    history,
    includeCurrentPageContent,
    currentPageMatched: !!currentPageMatch,
    suggestedRelevantLink
  });

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        stream: true,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: systemPrompt
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: userPrompt
              }
            ]
          }
        ]
      })
    });

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text();
      return res.status(500).json({
        error: 'OpenAI streaming request failed',
        details: errorText.slice(0, 1000)
      });
    }

    await streamOpenAIResponseToNodeResponse(openaiRes, res);
    return;
  } catch (err) {
    console.error('CHAT STREAM ERROR:', err);

    if (!res.headersSent) {
      return res.status(500).json({
        error: err && err.message ? err.message : 'Chat stream failed'
      });
    }

    try {
      res.end();
    } catch (e) {
      // ignore
    }

    return;
  }
}

// ========================================
// CHAT - END
// ========================================

// ========================================
// MAIN HANDLER - START
// ========================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

    if (req.method === 'GET' && query.testCrawl === '1') {
      return await handleCrawlSite(req, res, {
        url: 'https://njemacki2.blogspot.com/',
        agentId: 'agent_ji9hsuvk'
      });
    }

    if (action === 'create-agent') {
      return await handleCreateAgent(req, res, body);
    }

    if (action === 'get-agents') {
      return await handleGetAgents(req, res, body);
    }

    if (action === 'update-agent') {
      return await handleUpdateAgent(req, res, body);
    }

    if (action === 'delete-agent') {
      return await handleDeleteAgent(req, res, body);
    }

    if (action === 'track_visit') {
      return await handleTrackVisit(req, res, body);
    }

    if (action === 'track_time') {
      return await handleTrackTime(req, res, body);
    }

    if (action === 'analytics-summary') {
      return await handleAnalyticsSummary(req, res, body);
    }

    if (action === 'crawl-start') {
     return await handleCrawlStart(req, res, body);
    }
    
    if (action === 'crawl-run-batch') {
     return await handleCrawlRunBatch(req, res, body);
    }

    if (action === 'crawl-status') {
     return await handleCrawlStatus(req, res, body);
    }

    if (action === 'crawl-site') {
      return await handleCrawlSite(req, res, body);
    }

    if (action === 'agent-config') {
      return await handleAgentConfig(req, res, body);
    }

    if (action === 'chat') {
      return await handleChat(req, res, body);
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

// ========================================
// MAIN HANDLER - END
// ========================================
