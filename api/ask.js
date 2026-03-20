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
    allowedOrigins.some((domain) => referer.startsWith(domain));

  const corsOrigin = isAllowed ? (origin || allowedOrigins[0]) : allowedOrigins[0];

  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!isAllowed) {
    return res.status(403).json({
      error: "Access denied"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { question, history, postTitle } = req.body || {};

    if (!question || !question.trim()) {
      return res.status(400).json({ error: "No question" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const cleanQuestion = question.trim().slice(0, 300);

    const safeHistory = Array.isArray(history)
      ? history
          .slice(-5)
          .map((item) => ({
            question: String(item.question || "").slice(0, 300),
            answer: String(item.answer || "").slice(0, 800)
          }))
      : [];

    const historyText = safeHistory.length
      ? safeHistory
          .map(
            (item, index) =>
              `Razgovor ${index + 1}:\nPitanje: ${item.question}\nOdgovor: ${item.answer}`
          )
          .join("\n\n")
      : "Nema prethodnih pitanja.";

    const prompt = `
Ti si AI tutor za školske lektire i pomoć u učenju.

Pravila:
- Odgovaraj samo na pitanja o književnim djelima, lektirama, likovima, temi, poruci djela i pomoći za test.
- Odgovori moraju biti kratki, jasni i razumljivi učeniku.
- Piši prirodno, bez nepotrebnog nabrajanja.
- Odgovor neka bude najviše oko 120 riječi.
- Ako pitanje nije vezano uz lektiru ili učenje, ljubazno odbij.
- Ako postoji prethodni razgovor, uzmi ga u obzir.

Naslov posta:
${postTitle ? postTitle : "Nepoznato djelo"}

Prethodni razgovor:
${historyText}

Novo pitanje korisnika:
${cleanQuestion}
    `.trim();

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt
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
