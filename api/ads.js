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
    const {
      name,
      phone,
      service,
      location,
      goal,
      tone,
      offer,
      extra
    } = req.body || {};

    if (!service || !String(service).trim()) {
      return res.status(400).json({ error: "Missing service" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const cleanName = String(name || "").trim().slice(0, 120);
    const cleanPhone = String(phone || "").trim().slice(0, 80);
    const cleanService = String(service || "").trim().slice(0, 200);
    const cleanLocation = String(location || "").trim().slice(0, 120);
    const cleanGoal = String(goal || "").trim().slice(0, 120);
    const cleanTone = String(tone || "").trim().slice(0, 120);
    const cleanOffer = String(offer || "").trim().slice(0, 200);
    const cleanExtra = String(extra || "").trim().slice(0, 400);

    const prompt = `
Ti si stručnjak za marketing i pisanje oglasa za male biznise.

Tvoj zadatak je napisati 3 različite verzije oglasa koje su odmah spremne za objavu.

Podaci:
Naziv firme: ${cleanName || "nije navedeno"}
Kontakt: ${cleanPhone || "nije naveden"}
Usluga: ${cleanService}
Lokacija: ${cleanLocation || "nije navedeno"}
Cilj: ${cleanGoal || "nije navedeno"}
Stil: ${cleanTone || "nije navedeno"}
Ponuda: ${cleanOffer || "nije navedeno"}
Napomena: ${cleanExtra || "nema"}

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
- ako je naveden naziv firme, uključi ga prirodno u barem 1 ili 2 oglasa
- ako je naveden kontakt, uključi ga prirodno u barem 1 ili 2 oglasa, najbolje na kraju kao poziv na akciju
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
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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

    if (!result && data.output && Array.isArray(data.output)) {
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
