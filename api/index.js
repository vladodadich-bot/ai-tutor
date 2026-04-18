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
        content: String(page?.content || ''),
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
  const BATCH_SIZE = 12;

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

  const { data: queuedRows, error: queueFetchError } = await supabase
    .from('crawl_queue')
    .select('id, url, normalized_url, depth, priority')
    .eq('job_id', jobId)
    .eq('status', 'queued')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

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
      message: 'No more queued URLs'
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
  const urlsToCrawl = queuedRows.map((row) => row.normalized_url || row.url).filter(Boolean);

  const crawledPages = await crawlBatchPages(urlsToCrawl, rootOrigin);

  const successPages = crawledPages.filter((page) => !page.error);
  const failedPages = crawledPages.filter((page) => page.error);

 const rowsToInsert = successPages.map((page) => ({
  agent_id: job.agent_id,
  url: String(page.url || '').trim(),
  content: '',
  page_title: String(page.page_title || '').trim(),
  meta_description: String(page.meta_description || '').trim(),
  h1: String(page.h1 || '').trim(),
  headings: Array.isArray(page.headings)
    ? page.headings.map((item) => String(item || '').trim()).filter(Boolean)
    : [],
  internal_links: [],
  text_preview: String(page.text_preview || '').trim()
})).filter((row) => row.url);
  
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

  for (const page of successPages) {
    const links = Array.isArray(page.internal_links) ? page.internal_links : [];

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
        depth: 1,
        priority: 0,
        discovered_from: page.url || null,
        page_title: String(link && link.text ? link.text : '').trim()
      });
    }
  }

  let insertedQueueRowsCount = 0;

  if (discoveredQueueRows.length) {
    const discoveredUrls = discoveredQueueRows.map((row) => row.normalized_url).filter(Boolean);

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

    const newQueueRows = discoveredQueueRows.filter((row) => !existingQueueSet.has(row.normalized_url));

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
      await supabase
        .from('crawl_queue')
        .update({
          status: 'done',
          last_error: null
        })
        .eq('job_id', jobId)
        .eq('normalized_url', page.url);
    }
  }

  if (failedPages.length) {
    for (const page of failedPages) {
      await supabase
        .from('crawl_queue')
        .update({
          status: 'failed',
          last_error: page.error || 'Failed to crawl page'
        })
        .eq('job_id', jobId)
        .eq('normalized_url', page.url);
    }
  }

  const newTotalCrawled = Number(job.total_crawled || 0) + queuedRows.length;
  const newTotalSaved = Number(job.total_saved || 0) + successPages.length;
  const newTotalDiscovered = Number(job.total_discovered || 0) + insertedQueueRowsCount;

  await supabase
    .from('crawl_jobs')
    .update({
      total_crawled: newTotalCrawled,
      total_saved: newTotalSaved,
      total_discovered: newTotalDiscovered,
      status: 'running'
    })
    .eq('id', jobId);

  return res.status(200).json({
    success: true,
    jobId,
    status: 'running',
    batchSize: queuedRows.length,
    crawledNow: successPages.length,
    failedNow: failedPages.length,
    discoveredNow: insertedQueueRowsCount,
    totalCrawled: newTotalCrawled,
    totalSaved: newTotalSaved,
    totalDiscovered: newTotalDiscovered
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
  
Ti si AI pametni web asistent za ovu stranicu i pomažeš korisnicima da brzo dođu do relevantnih i tacnih informacija na vedar i osjecajan nacin.

KORISTI:
- sadržaj stranice, linkove i naslove
- podatke iz crawla
- svoje opće znanje 

PRAVILA:
- Odgovaraj jednostavno, prirodno i korisno, u ljudskom stilu prijateljski, sa jasnim razmacima u tekstu.
- Piši kratke i jasne odgovore, idealno do 120 riječi, i po potrebi predloži smislen sljedeći korak.
- Za specifične informacije o ovoj stranici ili poslovanju (cijene, usluge, kontakt, pravila, radno vrijeme, proizvodi, uvjeti i slično) koristi samo potvrđene podatke iz dostupnog sadržaja stranice i crawla. Ne nagađaj i ne izmišljaj.
- Za opća pitanja, objašnjenja i sažetke možeš kombinirati dostupni sadržaj stranice i opće znanje, ali prvo koristi najrelevantniji sadržaj sa stranice i crawla.
- Ako traženi podatak nije potvrđen u dostupnim podacima sa stranice ili crawla, jasno reci da ga nemaš potvrđenog.
- Ako postoji relevantna ili srodna stranica unutar ovog web sajta, ponudi 1 do 3 najrelevantnije poveznice sa kratkim objašnjenjem.
- Ne izmišljaj informacije, linkove, tvrdnje, proizvode, pravila ni sadržaj koji nije potvrđen.
- Ne daj generičke savjete poput odlaska drugdje, traženja po internetu ili provjere u knjižnici, osim ako to korisnik izričito zatraži.
- Ako korisnik postavi kratko follow-up pitanje poput "ok", "može", "objasni", "nastavi" ili slično, poveži ga sa prethodnom temom razgovora i nastavi smisleno.
- Odgovaraj na istom jeziku kojim se korisnik obraća.
- Ako korisnik ponovi isto pitanje, ljubazno odgovori kratko i po mogućnosti usmjeri razgovor dalje bez nepotrebnog ponavljanja.
- Ako pitanje nije povezano sa sadržajem stranice, a ipak je opće i bezopasno, odgovori korisno i kratko.
- Ne odgovaraj na pitanja o programiranju, hakiranju ili tehničkim zloupotrebama.
- Preferiraj konkretna objašnjenja nad apstraktnim opisima.

- Answer in ${languageLabel}
`.trim();
}

function buildUserPrompt(payload) {
  const headingsText = Array.isArray(payload.headings) ? payload.headings.join(' | ') : '';
  const historyText = Array.isArray(payload.history) && payload.history.length
    ? payload.history
        .slice(-4)
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

Current page content:
${currentPageContent}

Relevant crawled website context:
${payload.crawlContext || 'N/A'}

Page URL:
${payload.pageUrl || 'N/A'}

Page type hint:
${payload.pageTypeHint || 'general'}

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
async function handleChat(req, res, body) {
  const agentId = String(body.agentId || body.agent_id || '').trim();
  const message = String(body.message || '').trim();

  const language = limitText(body.language || 'en', 20);
  const pageTypeHint = limitText(body.pageTypeHint || 'general', 50);

  const pageTitle = limitText(body.pageTitle || '', 300);
  const pageDescription = limitText(body.pageDescription || '', 500);
  const pageUrl = limitText(body.pageUrl || '', 500);
  const h1 = limitText(body.h1 || '', 300);

  const pageContext = limitText(body.pageContext || '', 5000);
  const pageText = limitText(body.pageText || body.pageContext || '', 7000);

  const headings = Array.isArray(body.headings)
    ? body.headings.map((item) => limitText(item, 200)).filter(Boolean).slice(0, 12)
    : [];

  const history = normalizeHistoryItems(body.history, 8);

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

  const rankedContext = pickRelevantCrawledPages(crawledRows, message, history, 3);
  const relevantPages = rankedContext.pages || [];
  const linkCandidateData = findRelevantLinkCandidates(crawledRows, message, history, 3);
  const linkCandidates = linkCandidateData.candidates || [];

  const hasStrongCurrentPageContent = pageText.length > 180 || pageContext.length > 180;
  const hasStrongRelevantContent = Array.isArray(relevantPages) && relevantPages.some((row) => {
    const content = String(row.content || row.text_preview || '');
    return content.trim().length > 180 && Number(row._score || 0) >= 20;
  });

  if (!hasStrongCurrentPageContent && !hasStrongRelevantContent && linkCandidates.length > 0) {
    return res.status(200).json({
      reply: buildLinkSuggestionReply(language, linkCandidates)
    });
  }

  let crawlContext = '';

  try {
    const rowsToUse = Array.isArray(relevantPages) && relevantPages.length
      ? relevantPages
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
          content: limitText(row.content || '', 2500)
        };
      });

      crawlContext = JSON.stringify(shortRows, null, 2);
    }
  } catch (e) {
    crawlContext = '';
  }

  const includeCurrentPageContent = !hasStrongRelevantContent;

  console.log('CHAT CONTEXT DEBUG:', {
    agentId,
    message,
    activeTopic: rankedContext.activeTopic,
    resolvedQuery: rankedContext.resolvedQuery,
    includeCurrentPageContent,
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
  resolvedQuery: rankedContext.resolvedQuery,
  activeTopic: rankedContext.activeTopic,
  language,
  pageTitle,
  pageDescription,
  headings,
  h1,
  pageContext,
  pageText,
  crawlContext,
  pageUrl,
  pageTypeHint,
  history,
  includeCurrentPageContent
});

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
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
