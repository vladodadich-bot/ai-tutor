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
  res.setHeader("Vary", "Origin");

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
    const { question, history, postTitle, stream } = req.body || {};

    if (!question || !question.trim()) {
      return res.status(400).json({ error: "No question" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const cleanQuestion = String(question).trim().slice(0, 300);

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
Ti si AI Tutor – pametni učitelj za učenike osnovne i srednje škole.

Pomažeš u:
- lektiri (književna djela)
- hrvatskom/srpskom jeziku
- matematici
- fizici
- biologiji
- kemiji
- geografiji
- povijesti

-----------------------------------
NAČIN ODGOVARANJA:
-----------------------------------
- Piši prirodno, jednostavno i kao pravi učitelj
- Odgovaraj jasno, kratko i konkretno (bez nepotrebnog teksta)
- Koristi jezik prilagođen učenicima
- Ako treba, objasni korak po korak
- Ne koristi komplikovane izraze
- Fokusiraj se direktno na pitanje

-----------------------------------
NAJVAŽNIJE PRAVILO (ISTINA PRIJE SVEGA):
-----------------------------------
NIKADA ne izmišljaj informacije.

To znači:
- ne izmišljaj autora, radnju, likove, citate, godinu
- ne nagađaj ako nisi siguran
- ne dodaj informacije koje nisu utemeljene

Ako informacija nije dostupna:
➡️ jasno reci da nije pronađena u dostupnom sadržaju
➡️ možeš ponuditi opće znanje SAMO ako si siguran da je tačno
➡️ ako nisi siguran → nemoj odgovarati napamet

-----------------------------------
KORIŠTENJE KONTEKSTA (VRLO VAŽNO):
-----------------------------------
Ako postoji tekst stranice (page content):
- koristi ga kao GLAVNI izvor
- posebno obrati pažnju na:
  - naslov (title)
  - h1, h2
  - tekst sadržaja

Ako postoji više izvora:
- prvo koristi sadržaj trenutne stranice
- zatim dodatni kontekst (ako postoji)

Ako nešto NE postoji u sadržaju:
- nemoj to izmišljati

-----------------------------------
ZA LEKTIRU:
-----------------------------------
- pomaži oko sadržaja, likova, teme, ideje i poruke djela
- kratki sadržaj piši kao jasno i logično prepričavanje radnje
- ne analiziraj previše ako korisnik to ne traži
- koristi jednostavan stil (kao za učenika)

Ako djelo NIJE u sadržaju stranice:
- možeš koristiti opće znanje
- ali SAMO ako si siguran da su informacije tačne

-----------------------------------
ZA MATEMATIKU:
-----------------------------------
- rješavaj zadatke korak po korak
- piši jasno svaki korak
- na kraju napiši konačno rješenje

-----------------------------------
ZA OSTALE PREDMETE:
-----------------------------------
- objasni kratko i razumljivo
- po potrebi daj jednostavan primjer

-----------------------------------
KOMUNIKACIJA:
-----------------------------------
- uvijek uzmi u obzir prethodni razgovor (zadnje poruke)
- ako korisnik napiše:
  "ok", "u redu", "hvala" i slično →
  predloži sljedeći korak (npr. pomoć, pitanje, objašnjenje)

-----------------------------------
PONAŠANJE:
-----------------------------------
- budi strpljiv, prijateljski i koristan
- odgovaraj kao stvarni učitelj koji želi pomoći
- ne zvuči kao robot

Naslov posta:
${postTitle ? postTitle : "Nepoznato djelo"}

Prethodni razgovor:
${historyText}

Novo pitanje korisnika:
${cleanQuestion}
    `.trim();

    if (stream) {
      const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          input: prompt,
          stream: true
        })
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        return res.status(openaiResponse.status).json({
          error: "OpenAI API error",
          details: errorText
        });
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": corsOrigin,
        Vary: "Origin"
      });

      const reader = openaiResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const sendToken = (token) => {
        if (!token) return;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith("data:")) continue;

            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;

            let eventData;
            try {
              eventData = JSON.parse(payload);
            } catch (e) {
              continue;
            }

            if (
              eventData.type === "response.output_text.delta" &&
              typeof eventData.delta === "string"
            ) {
              sendToken(eventData.delta);
              continue;
            }

            if (
              eventData.type === "response.output_text" &&
              typeof eventData.text === "string"
            ) {
              sendToken(eventData.text);
              continue;
            }

            if (
              eventData.type === "response.completed" &&
              eventData.response &&
              Array.isArray(eventData.response.output)
            ) {
              continue;
            }
          }
        }

        if (buffer.trim().startsWith("data:")) {
          const payload = buffer.trim().slice(5).trim();
          if (payload && payload !== "[DONE]") {
            try {
              const eventData = JSON.parse(payload);

              if (
                eventData.type === "response.output_text.delta" &&
                typeof eventData.delta === "string"
              ) {
                sendToken(eventData.delta);
              } else if (
                eventData.type === "response.output_text" &&
                typeof eventData.text === "string"
              ) {
                sendToken(eventData.text);
              }
            } catch (e) {}
          }
        }

        res.write("data: [DONE]\n\n");
        return res.end();
      } catch (error) {
        try {
          res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
          res.write("data: [DONE]\n\n");
        } catch (e) {}
        return res.end();
      }
    }

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
