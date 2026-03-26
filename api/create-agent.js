import fs from "fs";
import path from "path";

function generateAgentId() {
  return "agent_" + Math.random().toString(36).slice(2, 10);
}

function cleanText(value, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeDomain(value) {
  let v = cleanText(value, 300);
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) {
    v = "https://" + v;
  }
  return v;
}

function isValidHexColor(value) {
  return /^#[0-9A-Fa-f]{6}$/.test(String(value || ""));
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
    const { agentName, welcomeMessage, themeColor, siteDomain } = req.body || {};

    const safeAgentName = cleanText(agentName, 100);
    const safeWelcomeMessage = cleanText(welcomeMessage, 300) || "Bok! Kako vam mogu pomoći?";
    const safeThemeColor = isValidHexColor(themeColor) ? themeColor : "#2563eb";
    const safeDomain = normalizeDomain(siteDomain);

    if (!safeAgentName) {
      return res.status(400).json({ error: "Missing agentName" });
    }

    if (!safeDomain) {
      return res.status(400).json({ error: "Missing siteDomain" });
    }

    const agentId = generateAgentId();

    const newAgent = {
      agentId,
      agentName: safeAgentName,
      welcomeMessage: safeWelcomeMessage,
      themeColor: safeThemeColor,
      allowExternalSearch: false,
      allowedDomains: [safeDomain],
      systemPrompt: `
Ti si SiteMind AI, pametni AI asistent ugrađen na web stranicu.

Tvoj glavni zadatak je pomoći posjetitelju na temelju sadržaja stranice na kojoj se chat nalazi.
Ako korisnik pita nešto vezano za ovu stranicu, proizvod, uslugu ili sadržaj stranice, to uvijek ima prioritet.

PRAVILA:
- odgovaraj kratko, jasno i korisno
- ne izmišljaj informacije
- koristi sadržaj stranice kada je dostupan
- ako odgovor nije jasan iz sadržaja stranice, reci to iskreno
- možeš pomoći i kod općih tehničkih pitanja kratko i konkretno
- uzmi u obzir prethodni razgovor
      `.trim()
    };

    const agentsFilePath = path.join(process.cwd(), "lib", "agents-data.json");

    let existingAgents = {};

    if (fs.existsSync(agentsFilePath)) {
      try {
        const raw = fs.readFileSync(agentsFilePath, "utf8");
        existingAgents = raw ? JSON.parse(raw) : {};
      } catch (err) {
        existingAgents = {};
      }
    }

    existingAgents[agentId] = newAgent;

    fs.writeFileSync(
      agentsFilePath,
      JSON.stringify(existingAgents, null, 2),
      "utf8"
    );

    return res.status(200).json({
      success: true,
      agentId,
      embedCode: `<script src="https://ai-tutor-rouge-theta.vercel.app/sitemind-embed.js" data-agent-id="${agentId}"><\/script>`
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: String(error && error.message ? error.message : error)
    });
  }
}
