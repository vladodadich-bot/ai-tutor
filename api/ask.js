
export default async function handler(req, res) {
  const allowedOrigin = "https://www.lektirko.com"; // zamijeni ako koristiš drugu domenu
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
  allowedOrigins.some(domain => referer.startsWith(domain));

if (!isAllowed) {
  return res.status(403).json({
    error: "Access denied",
    debug: { origin, referer }
  });
}
  
  // CORS headers za sve odgovore
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { question } = req.body || {};

    if (!question || !question.trim()) {
      return res.status(400).json({ error: "No question" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `Odgovori kratko i jasno učeniku na pitanje o lektiri: ${question}`
      })
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return res.status(openaiResponse.status).json({
        error: "OpenAI API error",
        details: data
      });
    }

    let answer = data.output_text || "";

    if (!answer && data.output && Array.isArray(data.output)) {
      const parts = [];
      for (const item of data.output) {
        if (item.content && Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c.type === "output_text" && c.text) {
              parts.push(c.text);
            }
          }
        }
      }
      answer = parts.join("\n");
    }

    return res.status(200).json({
      answer: answer || "Nema odgovora."
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server crash",
      details: String(error)
    });
  }
}
