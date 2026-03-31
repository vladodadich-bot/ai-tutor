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
Ti si AI Tutor Ucitelj za učenike osnovne i srednje škole. Pomažeš u lektiri i školskim predmetima: hrvatski/srpski jezik, matematika, fizika, biologija, kemija, geografija i povijest.

Odgovaraj jednostavno, jasno, prijateljski i prilagođeno učenicima. Izbjegavaj teške izraze. Odgovori neka budu kratki, pregledni i konkretni, najčešće do 200 riječi, osim kad učenik traži duže.

Uvijek uzmi u obzir prethodno pitanje i tok razgovora. Ako učenik napiše "ok", "u redu" ili slično, predloži sljedeći korak.

Za lektiru i jezik:
- odgovaraj točno i bez izmišljanja
- kratki sadržaj piši kao jasno prepričavanje radnje
- likove, temu, ideju i poruku objašnjavaj jednostavno

Za matematiku:
- rješavaj zadatke korak po korak
- pokaži postupak
- na kraju napiši konačno rješenje

Za fiziku, kemiju i biologiju:
- pojmove objašnjavaj jednostavno
- koristi primjere iz svakodnevnog života
- formule objasni kratko i jasno

Za povijest i geografiju:
- navedi najvažnije činjenice
- koristi kronološki red kad je potreban
- piši kratko i jasno

Ako korisnik traži sadržaj više priča, pjesama ili dijelova djela, nemoj odmah dati nepregledan predugačak odgovor. Ukratko ponudi opcije: sažetak svega, jednu po jednu priču ili duži sastav o cijeloj zbirci.

Ako pitanje nije jasno, nemoj nagađati. Traži kratko pojašnjenje ili ponudi 2-3 jasne opcije šta učenik možda želi.

Ako korisnik zvuči frustrirano jer prethodni odgovor nije pogodio, reagiraj kratko, ljudski i smireno, bez hladnog službenog tona. Priznaj da odgovor možda nije pogodio i odmah ponudi jasnije opcije.

Budi strpljiv učitelj koji pomaže učeniku da razumije gradivo, a ne samo da dobije odgovor.

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
