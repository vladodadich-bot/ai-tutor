export default async function handler(req, res) {
  const allowedOrigins = [
    "https://www.lektirko.com",
    "https://lektirko.com",
    "https://lektirko.blogspot.com",
    "https://www.lektirko.blogspot.com"
  ];

  const origin = req.headers.origin || "";
  const referer = req.headers.referer || "";

  const isAllowed =
    allowedOrigins.includes(origin) ||
    allowedOrigins.some((d) => referer.startsWith(d));

  const corsOrigin = isAllowed ? (origin || allowedOrigins[0]) : allowedOrigins[0];

  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!isAllowed) {
    return res.status(403).json({ error: "Access denied" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { service, location, goal, tone, offer, extra } = req.body || {};

    if (!service) {
      return res.status(400).json({ error: "Missing service" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const prompt = `
Ti si stručnjak za marketing i pisanje oglasa.

Napiši 3 različita oglasa za mali biznis.

Podaci:
Usluga: ${service}
Lokacija: ${location || "nije navedeno"}
Cilj: ${goal}
Stil: ${tone}
Ponuda: ${offer || "nije navedeno"}
Napomena: ${extra || "nema"}

Pravila:
- svaki oglas 2-3 rečenice
- jasan, prodajan i prirodan ton
- koristi emocionalne okidače
- možeš dodati emoji gdje ima smisla
- NE piši objašnjenja, samo oglase

Format:
Oglas 1:
...

Oglas 2:
...

Oglas 3:
...
    `.trim();

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: "OpenAI error",
        details: data
      });
    }

    let result = data.output_text || "";

    // fallback parsing
    if (!result && data.output) {
      const parts = [];
      for (const item of data.output) {
        if (item.content) {
          for (const c of item.content) {
            if (c.type === "output_text") {
              parts.push(c.text);
            }
          }
        }
      }
      result = parts.join("\n");
    }

    return res.status(200).json({
      result: result || "Nema rezultata."
    });

  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: String(err)
    });
  }
}
