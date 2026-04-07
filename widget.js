(function () {
  const API_URL = "https://ai-tutor-rouge-theta.vercel.app/api/ask";
  const MAX_QUESTIONS = 10;

  const STORAGE_USED = "aiTutorUsed";
  const STORAGE_HISTORY = "aiTutorHistory";

  const host = document.createElement("div");
  host.id = "ai-tutor-shadow-host";
  document.currentScript.parentNode.insertBefore(host, document.currentScript);

  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
      }

      .wrap, .wrap * {
        box-sizing: border-box;
        font-family: Arial, Helvetica, sans-serif;
      }

      .wrap {
        width: 100%;
        max-width: 760px;
        margin: 24px auto;
        display: block;
      }

      .box {
        width: 100%;
        background: #1D2739;
        border: 1px solid #dfe5ee;
        border-radius: 18px;
        padding: 18px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        color: #ffffff;
      }

      .header {
        margin-bottom: 14px;
      }

      .badge {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(255,255,255,0.08);
        color: #8ec5ff;
        font-size: 12px;
        font-weight: 700;
        margin-bottom: 10px;
        line-height: 1.2;
      }

      .title {
        margin: 0 0 8px 0;
        font-size: 24px;
        line-height: 1.3;
        font-weight: 700;
        color: #ffffff;
      }

      .desc {
        margin: 0;
        font-size: 15px;
        line-height: 1.6;
        color: #c9d4e5;
      }

      .status {
        margin-top: 12px;
        min-height: 20px;
        font-size: 14px;
        line-height: 1.5;
        color: #c9d4e5;
      }

      .answerBox {
        margin-top: 14px;
        padding: 14px;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 14px;
        background: rgba(255,255,255,0.04);
        color: #ffffff;
        display: none;
      }

      .answerTitle {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 700;
        color: #8ec5ff;
        line-height: 1.4;
      }

      .answer {
        margin: 0;
        font-size: 15px;
        line-height: 1.7;
        color: #edf4ff;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .inputWrap {
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid rgba(255,255,255,0.08);
      }

      .question {
        display: block;
        width: 100%;
        min-height: 84px;
        margin: 0;
        padding: 14px;
        border: 1px solid #31425f;
        border-radius: 14px;
        background: #0f1726;
        color: #ffffff;
        font-size: 15px;
        line-height: 1.5;
        resize: vertical;
        outline: none;
        -webkit-appearance: none;
        appearance: none;
      }

      .question:focus {
        border-color: #5aa9ff;
        box-shadow: 0 0 0 3px rgba(90,169,255,0.18);
      }

      .question::placeholder {
        color: #93a8c6;
        opacity: 1;
      }

      .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-top: 12px;
        flex-wrap: wrap;
      }

      .btn {
        display: inline-block;
        border: 0;
        border-radius: 12px;
        padding: 12px 18px;
        background: linear-gradient(135deg, #2d7ff9 0%, #1a5fd0 100%);
        color: #ffffff;
        font-size: 15px;
        font-weight: 700;
        line-height: 1.2;
        cursor: pointer;
      }

      .btn:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }

      .count {
        font-size: 14px;
        font-weight: 600;
        color: #c9d4e5;
        line-height: 1.4;
      }

      @media (max-width: 768px) {
        .wrap {
          margin: 18px auto;
          max-width: 100%;
        }

        .box {
          padding: 14px;
          border-radius: 16px;
        }

        .title {
          font-size: 20px;
        }

        .desc {
          font-size: 14px;
        }

        .question {
          min-height: 78px;
          font-size: 16px;
        }

        .row {
          flex-direction: column;
          align-items: stretch;
        }

        .btn {
          width: 100%;
          font-size: 16px;
        }

        .count {
          width: 100%;
          text-align: center;
        }
      }
    </style>

    <div class="wrap">
      <div class="box">
        <div class="header">
          <div class="badge">AI pomoć za lektiru</div>
          <div class="title">💬 Pitaj AI učitelja</div>
          <div class="desc">Ako ti nešto nije jasno u ovom djelu, postavi kratko pitanje i dobit ćeš brz odgovor.</div>
        </div>

        <div class="status"></div>

        <div class="answerBox">
          <div class="answerTitle">Odgovor</div>
          <div class="answer"></div>
        </div>

        <div class="inputWrap">
          <textarea
            class="question"
            placeholder="Npr. Tko je glavni lik i zašto je važan?"
            enterkeyhint="send"
            autocomplete="off"
            autocorrect="on"
            autocapitalize="sentences"
            spellcheck="true"
          ></textarea>

          <div class="row">
            <button class="btn" type="button">Pitaj</button>
            <div class="count">Preostalo: 5</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const q = shadow.querySelector(".question");
  const btn = shadow.querySelector(".btn");
  const ans = shadow.querySelector(".answer");
  const box = shadow.querySelector(".answerBox");
  const status = shadow.querySelector(".status");
  const count = shadow.querySelector(".count");

  const isMobile = window.matchMedia("(max-width: 768px)").matches;

  function getUsed() {
    return parseInt(sessionStorage.getItem(STORAGE_USED) || "0", 10);
  }

  function setUsed(v) {
    sessionStorage.setItem(STORAGE_USED, String(v));
    update();
  }

  function getHistory() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_HISTORY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function setHistory(h) {
    sessionStorage.setItem(STORAGE_HISTORY, JSON.stringify(h.slice(-5)));
  }

  function getTitle() {
    const h1 = document.querySelector("h1.post-title, h1.entry-title, .post h1, article h1, h1");
    return h1 ? h1.innerText.trim() : document.title;
  }

  function update() {
    const left = Math.max(0, MAX_QUESTIONS - getUsed());
    count.textContent = "Preostalo: " + left;

    if (left <= 0) {
      btn.disabled = true;
      status.textContent = "Limit pitanja dosegnut.";
    } else if (!status.dataset.locked) {
      btn.disabled = false;
    }
  }

  function lockUI() {
    btn.disabled = true;
    q.disabled = true;
    status.dataset.locked = "1";
  }

  function unlockUI() {
    q.disabled = false;
    status.dataset.locked = "";
    update();
  }

  function safeBlurInput() {
    try {
      q.blur();
      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }
    } catch (e) {}
  }

  function revealAnswerBox() {
    box.style.display = "block";
  }

  function appendStreamText(chunk) {
    ans.textContent += chunk;
    revealAnswerBox();
  }

  function setAnswerText(text) {
    ans.textContent = text || "Nema odgovora.";
    revealAnswerBox();
  }

  function tryParseJsonLine(line) {
    try {
      return JSON.parse(line);
    } catch (e) {
      return null;
    }
  }

  async function readStreamResponse(res) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    revealAnswerBox();
    ans.textContent = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        if (line.startsWith("data:")) {
          const payload = line.slice(5).trim();

          if (payload === "[DONE]") {
            continue;
          }

          const parsed = tryParseJsonLine(payload);

          if (parsed) {
            const token =
              parsed.token ||
              parsed.delta ||
              parsed.text ||
              parsed.answerPart ||
              "";

            if (token) {
              fullText += token;
              appendStreamText(token);
            }
          } else {
            fullText += payload;
            appendStreamText(payload);
          }

          continue;
        }

        const parsed = tryParseJsonLine(line);

        if (parsed) {
          const token =
            parsed.token ||
            parsed.delta ||
            parsed.text ||
            parsed.answerPart ||
            "";

          if (token) {
            fullText += token;
            appendStreamText(token);
          }
        } else {
          fullText += line;
          appendStreamText(line);
        }
      }
    }

    if (buffer.trim()) {
      const tail = buffer.trim();

      if (tail.startsWith("data:")) {
        const payload = tail.slice(5).trim();
        if (payload && payload !== "[DONE]") {
          const parsed = tryParseJsonLine(payload);
          if (parsed) {
            const token =
              parsed.token ||
              parsed.delta ||
              parsed.text ||
              parsed.answerPart ||
              "";
            if (token) {
              fullText += token;
              appendStreamText(token);
            }
          } else {
            fullText += payload;
            appendStreamText(payload);
          }
        }
      } else {
        const parsed = tryParseJsonLine(tail);
        if (parsed) {
          const token =
            parsed.token ||
            parsed.delta ||
            parsed.text ||
            parsed.answerPart ||
            "";
          if (token) {
            fullText += token;
            appendStreamText(token);
          }
        } else if (tail) {
          fullText += tail;
          appendStreamText(tail);
        }
      }
    }

    return fullText.trim();
  }

  async function ask() {
    const used = getUsed();
    if (used >= MAX_QUESTIONS) return;

    const question = q.value.trim();
    if (!question) {
      status.textContent = "Upiši pitanje.";
      return;
    }

    lockUI();
    status.textContent = "AI razmišlja...";
    box.style.display = "none";
    ans.textContent = "";

    if (isMobile) {
      safeBlurInput();
    }

    const history = getHistory();

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/plain, text/event-stream"
        },
        body: JSON.stringify({
          question,
          history,
          postTitle: getTitle(),
          stream: true
        })
      });

      if (!res.ok) {
        let errorText = "Greška.";
        try {
          const errData = await res.json();
          errorText = errData.error || errorText;
        } catch (e) {}
        status.textContent = errorText;
        unlockUI();
        return;
      }

      let answer = "";

      const contentType = (res.headers.get("content-type") || "").toLowerCase();

      if (
        res.body &&
        (
          contentType.includes("text/event-stream") ||
          contentType.includes("text/plain") ||
          contentType.includes("application/x-ndjson")
        )
      ) {
        answer = await readStreamResponse(res);
      } else {
        const data = await res.json();
        answer = data.answer || "Nema odgovora.";
        setAnswerText(answer);
      }

      if (!answer) {
        answer = "Nema odgovora.";
        setAnswerText(answer);
      }

      status.textContent = "Odgovor je spreman.";

      const newHistory = history.concat([{ question, answer }]);
      setHistory(newHistory);
      setUsed(used + 1);
      q.value = "";
    } catch (e) {
      status.textContent = "Greška povezivanja.";
    }

    if (isMobile) {
      safeBlurInput();
    }

    unlockUI();
  }

  btn.addEventListener("click", ask);

  q.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  });

  q.addEventListener("focus", function () {
    status.textContent = status.textContent === "Upiši pitanje." ? "" : status.textContent;
  });

  if (isMobile) {
    setTimeout(safeBlurInput, 50);
    window.addEventListener("resize", function () {
      if (document.activeElement !== q) return;
    });
  }

  update();
})();
