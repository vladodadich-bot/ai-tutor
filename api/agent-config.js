import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function cleanText(value, max = 200) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.SUPABASE_URL) {
      return res.status(500).json({ error: "Missing SUPABASE_URL" });
    }

    if (!process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: "Missing SUPABASE_ANON_KEY" });
    }

    const agentId = cleanText(req.query.agentId, 100);

    if (!agentId) {
      return res.status(400).json({ error: "Missing agentId" });
    }

    const { data: agent, error } = await supabase
      .from("agents")
      .select("agent_id, agent_name, welcome_message, theme_color, site_domain")
      .eq("agent_id", agentId)
      .limit(1)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        error: "Agent fetch failed",
        details: error.message
      });
    }

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    return res.status(200).json({
      agentId: agent.agent_id,
      agentName: agent.agent_name || "SiteMind AI",
      welcomeMessage: agent.welcome_message || "",
      themeColor: agent.theme_color || "#2563eb",
      siteDomain: agent.site_domain || ""
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: String(error && error.message ? error.message : error)
    });
  }
}
