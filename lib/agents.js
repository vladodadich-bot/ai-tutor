export const agents = {
  "demo-agent": {
    agentId: "demo-agent",
    agentName: "SiteMind AI",
    welcomeMessage: "",
    themeColor: "#2563eb",

    allowExternalSearch: true,

    allowedDomains: [
      "localhost",
      "127.0.0.1",
      "sitemindai.app",
      "www.sitemindai.app"
    ],

    systemPrompt: `
Ti si pametni AI asistent za web stranicu.
Odgovaraj kratko, jasno i korisno.
Prvo koristi sadržaj stranice kada je dovoljan.
Ako odgovor nije jasno na stranici, reci to iskreno.
Ne izmišljaj cijene, uvjete, kontakt podatke ili obećanja ako nisu potvrđeni.
Ako je dopušten vanjski web search fallback, koristi ga samo kad stranica nije dovoljna.
`
  }
};

export function getAgentById(agentId) {
  return agents[agentId] || agents["demo-agent"];
}
