export default async function handler(req, res) {
  const allowedOrigins = [
    "https://www.lektirko.com",
    "https://lektirko.com",
    "https://lektirko.blogspot.com",
    "https://www.lektirko.blogspot.com"
  ];

  const origin = req.headers.origin || "";
  const referer = req.headers.referer || "";

  function isAllowedRequest() {
    if (allowedOrigins.includes(origin)) return true;
    return allowedOrigins.some((d) => referer.startsWith(d));
  }

  function setCorsHeaders() {
    if (allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  setCorsHeaders();

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAllowedRequest()) {
    return res.status(403).json({ error: "Domain not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const text = (body.text || "").trim();
    const action = (body.action || "").trim();

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    if (text.length > 6000) {
      return res.status(400).json({ error: "Text is too long. Maximum is 6000 characters." });
    }

    const actionPrompts = {
      fix: [
        "Ispravi pravopis, gramatiku i tipfelere.",
        "Ne mijenjaj značenje teksta.",
        "Ne dodaj nove informacije.",
        "Vrati samo ispravljeni tekst, bez uvoda i bez objašnjenja."
      ].join(" "),

      improve: [
        "Preoblikuj tekst da zvuči prirodnije, ljepše i jasnije.",
        "Zadrži isto značenje i glavnu poruku.",
        "Ne dodaj izmišljene informacije.",
        "Vrati samo gotov tekst, bez uvoda i bez objašnjenja."
      ].join(" "),

      shorten: [
        "Skrati tekst, ali zadrži glavnu poruku i smisao.",
        "Ukloni višak riječi i ponavljanja.",
        "Ne dodaj nove informacije.",
        "Vrati samo skraćeni tekst, bez uvoda i bez objašnjenja."
      ].join(" "),

      formal: [
        "Pretvori tekst u formalniji, pristojniji i uredniji stil.",
        "Zadrži isto značenje.",
        "Ne dodaj nove informacije.",
        "Vrati samo gotov tekst, bez uvoda i bez objašnjenja."
      ].join(" ")
    };

    if (!actionPrompts[action]) {
      return res.status(400).json({ error: "Invalid action" });
    }

    const systemPrompt = [
      "Ti si AI alat za pisanje na stranici Lektirko.",
      "Odgovaraš isključivo gotovim preuređenim tekstom.",
      "Nikada ne piši uvod poput 'Naravno' ili 'Evo ispravljenog teksta'.",
      "Nikada ne objašnjavaj što si napravio.",
      "Ne koristi navodnike oko rezultata.",
      "Sačuvaj jezik korisnika. Ako je ulaz na hrvatskom, vrati hrvatski."
    ].join(" ");

    const userPrompt = [
      `Zadatak: ${actionPrompts[action]}`,
      "",
      "Tekst korisnika:",
      text
    ].join("\n");

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userPrompt }]
          }
        ]
      })
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error("OpenAI API error:", data);
      return res.status(500).json({
        error: "OpenAI request failed",
        details: data
      });
    }

    let outputText = "";

    if (typeof data.output_text === "string" && data.output_text.trim()) {
      outputText = data.output_text.trim();
    } else if (Array.isArray(data.output)) {
      for (const item of data.output) {
        if (Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part.type === "output_text" && part.text) {
              outputText += part.text;
            }
          }
        }
      }
      outputText = outputText.trim();
    }

    if (!outputText) {
      return res.status(500).json({ error: "No text returned from model" });
    }

    return res.status(200).json({
      result: outputText
    });
  } catch (error) {
    console.error("writer.js error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
