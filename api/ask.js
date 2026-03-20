export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { question } = req.body || {};

  if (!question || !question.trim()) {
    return res.status(400).json({ error: "No question" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
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

    const data = await response.json();

    let answer = "Nema odgovora.";
    if (data.output_text) {
      answer = data.output_text;
    } else if (data.output && Array.isArray(data.output)) {
      const parts = [];
      for (const item of data.output) {
        if (item.content && Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c.type === "output_text" && c.text) parts.push(c.text);
          }
        }
      }
      if (parts.length) answer = parts.join("\n");
    }

    return res.status(200).json({ answer });
  } catch (error) {
    return res.status(500).json({ error: "Greška na serveru" });
  }
}
