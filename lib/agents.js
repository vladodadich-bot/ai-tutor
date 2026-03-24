export const agents = {
  "demo-agent": {
    agentId: "demo-agent",
    agentName: "SiteMind AI",
    welcomeMessage: "Bok! Kako vam mogu pomoći?",
    themeColor: "#2563eb",

    // domene gdje widget smije raditi
    allowedDomains: [
      "localhost",
      "127.0.0.1",
      "sitemindai.app",
      "www.sitemindai.app"
    ],

    // osnovni AI prompt (možeš kasnije širiti)
    systemPrompt: `
Ti si pametni AI asistent za web stranicu.
Odgovaraj kratko, jasno i korisno.
Ako ne znaš odgovor, nemoj izmišljati.
`
  }
};
