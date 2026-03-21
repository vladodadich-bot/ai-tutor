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
Ti si stručnjak za marketing i pisanje oglasa za male biznise.

Tvoj zadatak je napisati 3 različite verzije oglasa koje su odmah spremne za objavu.

Podaci:
Usluga: ${service}
Lokacija: ${location || "nije navedeno"}
Cilj: ${goal}
Stil: ${tone}
Ponuda: ${offer || "nije navedeno"}
Napomena: ${extra || "nema"}

Pravila:
- piši na hrvatskom jeziku
- oglasi moraju zvučati prirodno, jasno i profesionalno
- nemoj izmišljati informacije koje korisnik nije dao
- ne spominji stručnjake, iskustvo, broj klijenata, kvalitetu ili lokalnu popularnost ako to nije navedeno
- nemoj dodavati promo kod, broj godina iskustva, garancije ili posebne tvrdnje ako nisu unesene
- izbjegavaj generičke fraze poput "savršen izgled svaki put", "lokalci nas biraju" i slično
- nemoj pretjerivati s uskličnicima i emoji-jima
- emoji koristi samo ako baš prirodno odgovara, najviše 1 po oglasu
- svaki oglas neka ima 2 do 4 kratke rečenice
- fokus neka bude na koristi za kupca
- neka svaki oglas ima jasan poziv na akciju
- ako je lokacija poznata, uključi je prirodno u tekst
- ako postoji posebna ponuda, istakni je jasno i prirodno
- stil neka bude upotrebljiv za stvarnu objavu malog biznisa

Vrste oglasa koje trebaš napisati:
1. Kratki oglas – sažet i direktan
2. Prodajni oglas – jači fokus na korist i poziv na akciju
3. Lokalni oglas – naglasak na lokaciju i ponudu

Vrati odgovor točno u ovom formatu:

Oglas 1 – Kratki:
...

Oglas 2 – Prodajni:
...

Oglas 3 – Lokalni:
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
