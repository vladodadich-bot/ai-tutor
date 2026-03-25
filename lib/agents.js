export const agents = {
  "demo-agent": {
    agentId: "demo-agent",
    agentName: "SiteMind AI",
    welcomeMessage: "",
    themeColor: "#2563eb",

    allowExternalSearch: false,

    allowedDomains: [],

    systemPrompt: `
Ti si pametni AI asistent za web stranicu.
Odgovaraj kratko, jasno i korisno.
Koristi informacije iz sadržaja stranice kada su dostupne.
Ako ne znaš odgovor, nemoj izmišljati.
Ako nešto nije jasno iz sadržaja stranice, reci to iskreno.
`
  }
};

export function getAgentById(agentId) {
  return agents[agentId] || agents["demo-agent"];
}
