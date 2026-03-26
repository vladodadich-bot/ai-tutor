import fs from "fs";
import path from "path";

function generateAgentId() {
  return "agent_" + Math.random().toString(36).slice(2, 10);
}

function cleanText(value, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { agentName, welcomeMessage, themeColor, siteDomain } = req.body;

    if (!agentName) {
      return res.status(400).json({ error: "Missing agentName" });
    }

    if (!siteDomain) {
      return res.status(400).json({ error: "Missing siteDomain" });
    }

    const agentId = generateAgentId();

    const newAgent = {
      agentId,
      agentName: cleanText(agentName),
      welcomeMessage: cleanText(welcomeMessage) || "Bok! Kako vam mogu pomoći?",
      themeColor: themeColor || "#2563eb",
      allowedDomains: [cleanText(siteDomain)],
      systemPrompt: "Ti si AI asistent za web stranicu."
    };

    const filePath = path.join(process.cwd(), "lib", "agents-data.json");

    let data = {};

    if (fs.existsSync(filePath)) {
      data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }

    data[agentId] = newAgent;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    return res.status(200).json({
      agentId,
      embedCode: `<script src="https://tvojadomena.com/sitemind-embed.js" data-agent-id="${agentId}"><\/script>`
    });

  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
}
