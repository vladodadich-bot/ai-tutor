import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.SUPABASE_URL) {
      return res.status(500).json({
        error: "Missing SUPABASE_URL"
      });
    }

    if (!process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({
        error: "Missing SUPABASE_ANON_KEY"
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { agentName, welcomeMessage, themeColor, siteDomain } = req.body || {};

    if (!agentName || !siteDomain) {
      return res.status(400).json({
        error: "Missing fields"
      });
    }

    const agentId = "agent_" + Math.random().toString(36).slice(2, 10);

    const payload = {
      agent_id: String(agentId),
      agent_name: String(agentName).trim(),
      welcome_message: String(welcomeMessage || "Bok! Kako vam mogu pomoći?").trim(),
      theme_color: String(themeColor || "#2563eb").trim(),
      site_domain: String(siteDomain).trim(),
      system_prompt: "Ti si SiteMind AI asistent za web stranicu.",
      allow_external_search: false
    };

    const { data, error } = await supabase
      .from("agents")
      .insert([payload])
      .select();

    if (error) {
      return res.status(500).json({
        error: "DB error",
        details: error.message
      });
    }

    return res.status(200).json({
      success: true,
      agentId,
      row: data,
      embedCode: `<script src="https://ai-tutor-rouge-theta.vercel.app/sitemind-embed.js" data-agent-id="${agentId}"><\/script>`
    });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: String(err && err.message ? err.message : err)
    });
  }
}
