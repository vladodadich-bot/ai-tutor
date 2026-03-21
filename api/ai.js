export default async function handler(req, res) {
  const allowedHosts = ["lektirko.com", "www.lektirko.com"];

  const origin = req.headers.origin || "";
  const referer = req.headers.referer || "";

  let originHost = "";
  let refererHost = "";

  try {
    if (origin) originHost = new URL(origin).hostname;
  } catch (e) {}

  try {
    if (referer) refererHost = new URL(referer).hostname;
  } catch (e) {}

  const allowed =
    allowedHosts.includes(originHost) ||
    allowedHosts.includes(refererHost);

  if (!allowed) {
    return res.status(403).json({ error: "Pristup nije dopušten." });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: "Prompt je obavezan." });
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
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
        error: data?.error?.message || "Greška pri pozivu OpenAI API-ja."
      });
    }

    const text =
      data.output?.[0]?.content?.[0]?.text ||
      "Nema odgovora.";

    return res.status(200).json({ result: text });

  } catch (error) {
    return res.status(500).json({
      error: "Server error"
    });
  }
}
