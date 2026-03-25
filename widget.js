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
        color: #1f2d3d;
      }

      .header {
        margin-bottom: 14px;
      }

      .badge {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        background: #1D2739;
        color: #1a5fd0;
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
        color: #1b2b44;
      }

      .desc {
        margin: 0;
        font-size: 15px;
        line-height: 1.6;
        color: #53627c;
      }

      .question {
        display: block;
        width: 100%;
        min-height: 110px;
        margin: 0;
        padding: 14px;
        border: 1px solid #ccd6e3;
        border-radius: 14px;
        background: #fbfcff;
        color: #1f2d3d;
        font-size: 15px;
        line-height: 1.5;
        resize: vertical;
        outline: none;
      }

      .question::placeholder {
        color: #1D2739;
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
        color: #1D2739;
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
        color: #5c6c84;
        line-height: 1.4;
      }

      .status {
        margin-top: 12px;
        min-height: 20px;
        font-size: 14px;
        line-height: 1.5;
        color: #53627c;
      }

      .answerBox {
        margin-top: 14px;
        padding: 14px;
        border: 1px solid #d8e5fb;
        border-radius: 14px;
        background: #1D2739;
        color: #1f2d3d;
        display: none;
      }

      .answerTitle {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 700;
        color: #1b2b44;
        line-height: 1.4;
      }

      .answer {
        margin: 0;
        font-size: 15px;
        line-height: 1.65;
        color: #26364a;
        white-space: pre-wrap;
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
          min-height: 100px;
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

        <textarea class="question" placeholder="Npr. Tko je glavni lik i zašto je važan?"></textarea>

        <div class="row">
          <button class="btn" type="button">Pitaj</button>
          <div class="count">Preostalo: 5</div>
        </div>

        <div class="status"></div>

        <div class="answerBox">
          <div class="answerTitle">Odgovor</div>
          <div class="answer"></div>
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
    } else {
      btn.disabled = false;
    }
  }

  async function ask() {
    const used = getUsed();
    if (used >= MAX_QUESTIONS) return;

    const question = q.value.trim();
    if (!question) {
      status.textContent = "Upiši pitanje.";
      return;
    }

    btn.disabled = true;
    status.textContent = "AI razmišlja...";
    box.style.display = "none";

    const history = getHistory();

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question,
          history,
          postTitle: getTitle()
        })
      });

      const data = await res.json();

      if (!res.ok) {
        status.textContent = data.error || "Greška.";
        btn.disabled = false;
        return;
      }

      const answer = data.answer || "Nema odgovora.";
      ans.textContent = answer;
      box.style.display = "block";
      status.textContent = "Odgovor je spreman.";

      const newHistory = history.concat([{ question, answer }]);
      setHistory(newHistory);
      setUsed(used + 1);
      q.value = "";
    } catch (e) {
      status.textContent = "Greška povezivanja.";
    }

    btn.disabled = false;
    update();
  }

  btn.addEventListener("click", ask);
  update();
})();
