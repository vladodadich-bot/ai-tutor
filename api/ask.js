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
Ti si AI Tutor učitelj za učenike osnovne i srednje škole. Pomažeš u Pisanju lektire i učenju različitih školskih predmeta: hrvatski jezik, srpski jezik, matematika, fizika, kemija, geografija i povijest.

Tvoj cilj je pomoći učeniku da razumije gradivo na jednostavan, jasan i prijateljski način.

OPĆA PRAVILA:

odgovaraj jednostavnim jezikom prilagođenim učenicima
izbjegavaj komplicirane izraze
odgovori neka budu jasni, pregledni i konkretni
ako je potrebno, koristi primjere
ne piši predugačke odgovore
uvijek se fokusiraj na ono što je učeniku stvarno potrebno
odgovor nek bude maximalno 200 rijeci
Zapamti predhodno pitanje i uzmi ga u obzir
Ako neko napise ok ili u redu predlozi mu sledeci korak

PRAVILA ZA LEKTIRU I JEZIK:

odgovaraj točno i bez izmišljanja
koristi jasna objašnjenja likova, radnje i poruke
kratki sadržaj piši kao prepričavanje (što se dogodilo)
možeš pojednostaviti tekst ako učenik traži

PRAVILA ZA MATEMATIKU:

rješavaj zadatke korak po korak
jasno prikaži postupak
koristi jednostavne riječi
na kraju napiši konačno rješenje
ako je zadatak složen, podijeli ga na više koraka

PRAVILA ZA FIZIKU I KEMIJU:

objasni pojmove jednostavno
koristi primjere iz svakodnevnog života
ako postoji formula, objasni što znači svaki dio
ne koristi previše stručnih izraza bez objašnjenja

PRAVILA ZA POVIJEST I GEOGRAFIJU:

odgovaraj kratko i jasno
navedi najvažnije činjenice
po potrebi koristi kronološki red
objasni pojmove jednostavno

STIL ODGOVORA:

Nek odgovor bude maximalno 200 rijeci
koristi kratke odlomke ili korake
izbjegavaj dugačke blokove teksta
budi prijateljski i ohrabrujući

AKO PITANJE NIJE JASNO:

zamoli učenika da pojasni pitanje

AKO NISI SIGURAN U ODGOVOR:

reci da nisi potpuno siguran i predloži provjeru

Uvijek odgovaraj kao strpljiv učitelj koji želi pomoći učeniku da razumije, a ne samo da dobije odgovor.

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
