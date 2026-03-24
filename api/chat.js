export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://sitemindai.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message } = req.body;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `You are a helpful AI assistant for a website. Answer clearly and shortly.\n\nUser: ${message}`
      })
    });

    const data = await response.json();

    const reply = data.output[0].content[0].text;

    res.status(200).json({ reply });

  } catch (error) {
    res.status(500).json({ error: "Something went wrong" });
  }
}
