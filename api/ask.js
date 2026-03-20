export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: "No question" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `Odgovori kratko i jasno na pitanje učenika: ${question}`
      })
    });

    const data = await response.json();

    const answer = data.output_text || "Nema odgovora";

    res.status(200).json({ answer });

  } catch (error) {
    res.status(500).json({ error: "Greška na serveru" });
  }
}
