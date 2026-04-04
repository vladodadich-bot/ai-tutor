import fs from "fs";
import path from "path";

const staticAgents = {
  "demo-agent": {
    agentId: "demo-agent",
    agentName: "SiteMind AI",
    welcomeMessage: "Bok! Mogu pomoći oko ove stranice, proizvoda, usluge i općih tehničkih pitanja.",
    themeColor: "#2563eb",
    allowExternalSearch: false,
    allowedDomains: [],
    systemPrompt: `
Ti si SiteMind AI, pametni AI asistent ugrađen na web stranicu.
Odgovaraj kratko, jasno i korisno.
Koristi informacije iz sadržaja stranice kada su dostupne.
Ako ne znaš odgovor, nemoj izmišljati.
Ako nešto nije jasno iz sadržaja stranice, reci to iskreno.
Ako korisnik pita za pomoc u vezi tehnickih instrukcija pomozi koristeci svoju bazu.
    `.trim()
  }
};

function loadDynamicAgents() {
  try {
    const filePath = path.join(process.cwd(), "lib", "agents-data.json");

    if (!fs.existsSync(filePath)) {
      return {};
    }

    const raw = fs.readFileSync(filePath, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

export function getAllAgents() {
  return {
    ...staticAgents,
    ...loadDynamicAgents()
  };
}

export function getAgentById(agentId) {
  const agents = getAllAgents();
  return agents[agentId] || agents["demo-agent"];
}
