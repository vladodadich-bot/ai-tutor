import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function generateAgentId() {
  return "agent_" + Math.random().toString(36).slice(2, 10);
}

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
    const { agentName, welcomeMessage, themeColor, siteDomain } = req.body;

    if (!agentName || !siteDomain) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const agentId = generateAgentId();

    const { error } = await supabase.from("agents").insert([
      {
        agent_id: agentId,
        agent_name: agentName,
        welcome_message: welcomeMessage || "Bok! Kako vam mogu pomoći?",
        theme_color: themeColor || "#2563eb",
        site_domain: siteDomain,
        system_prompt: "Ti si SiteMind AI asistent.",
        allow_external_search: false
      }
    ]);

    if (error) {
      return res.status(500).json({
        error: "DB error",
        details: error.message
      });
    }

    return res.status(200).json({
      agentId,
      embedCode: `<script src="https://ai-tutor-rouge-theta.vercel.app/sitemind-embed.js" data-agent-id="${agentId}"><\/script>`
    });

  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
}
