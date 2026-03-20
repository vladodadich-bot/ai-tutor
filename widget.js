(function () {
  const API_URL = "https://ai-tutor-rouge-theta.vercel.app/api/ask";
  const MAX_QUESTIONS = 5;

  const STORAGE_USED = "aiTutorUsed";
  const STORAGE_HISTORY = "aiTutorHistory";

  const html = `
  <div id="ai-tutor-widget-wrap">
    <div id="ai-tutor-widget-box">
      <div id="ai-tutor-header">
        <div id="ai-tutor-badge">AI pomoć za lektiru</div>
        <h3 id="ai-tutor-title">💬 Pitaj AI učitelja</h3>
        <p id="ai-tutor-desc">Ako ti nešto nije jasno u ovom djelu, postavi kratko pitanje i dobit ćeš brz odgovor.</p>
      </div>

      <textarea id="ai-tutor-question" placeholder="Npr. Tko je glavni lik i zašto je važan?"></textarea>

      <div id="ai-tutor-row">
        <button id="ai-tutor-btn" type="button">Pitaj</button>
        <div id="ai-tutor-count">Preostalo: 5</div>
      </div>

      <div id="ai-tutor-status"></div>

      <div id="ai-tutor-answer-box" style="display:none;">
        <div id="ai-tutor-answer-title">Odgovor</div>
        <div id="ai-tutor-answer"></div>
      </div>
    </div>
  </div>

  <style>
    #ai-tutor-widget-wrap,
    #ai-tutor-widget-wrap * {
      box-sizing: border-box !important;
      font-family: Arial, Helvetica, sans-serif !important;
    }

    #ai-tutor-widget-wrap {
      width: 100% !important;
      max-width: 760px !important;
      margin: 24px auto !important;
      display: block !important;
      clear: both !important;
    }

    #ai-tutor-widget-box {
      display: block !important;
      width: 100% !important;
      background: #172133 !important;
      border: 1px solid #dfe5ee !important;
      border-radius: 18px !important;
      padding: 18px !important;
      box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important;
      color: #1f2d3d !important;
    }

    #ai-tutor-header {
      margin-bottom: 14px !important;
    }

    #ai-tutor-badge {
      display: inline-block !important;
      padding: 6px 10px !important;
      border-radius: 999px !important;
      background: #172133 !important;
      color: #1a5fd0 !important;
      font-size: 12px !important;
      font-weight: 700 !important;
      margin-bottom: 10px !important;
      line-height: 1.2 !important;
    }

    #ai-tutor-title {
      margin: 0 0 8px 0 !important;
      padding: 0 !important;
      font-size: 24px !important;
      line-height: 1.3 !important;
      font-weight: 700 !important;
      color: #1b2b44 !important;
      background: #172133 !important;
      border: 0 !important;
      text-shadow: none !important;
    }

    #ai-tutor-desc {
      margin: 0 !important;
      padding: 0 !important;
      font-size: 15px !important;
      line-height: 1.6 !important;
      color: #53627c !important;
      background: transparent !important;
      text-shadow: none !important;
    }

    #ai-tutor-question {
      display: block !important;
      width: 100% !important;
      min-height: 110px !important;
      margin: 0 !important;
      padding: 14px !important;
      border: 1px solid #ccd6e3 !important;
      border-radius: 14px !important;
      background: #fbfcff !important;
      color: #1f2d3d !important;
      font-size: 15px !important;
      line-height: 1.5 !important;
      resize: vertical !important;
      outline: none !important;
      box-shadow: none !important;
    }

    #ai-tutor-question::placeholder {
      color: #7a8799 !important;
      opacity: 1 !important;
    }

    #ai-tutor-row {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      gap: 12px !important;
      margin-top: 12px !important;
      flex-wrap: wrap !important;
    }

    #ai-tutor-btn {
      display: inline-block !important;
      border: 0 !important;
      border-radius: 12px !important;
      padding: 12px 18px !important;
      background: linear-gradient(135deg, #2d7ff9 0%, #1a5fd0 100%) !important;
      color: #ffffff !important;
      font-size: 15px !important;
      font-weight: 700 !important;
      line-height: 1.2 !important;
      cursor: pointer !important;
      text-shadow: none !important;
      box-shadow: none !important;
    }

    #ai-tutor-btn:disabled {
      opacity: 0.65 !important;
      cursor: not-allowed !important;
    }

    #ai-tutor-count {
      font-size: 14px !important;
      font-weight: 600 !important;
      color: #5c6c84 !important;
      line-height: 1.4 !important;
    }

    #ai-tutor-status {
      margin-top: 12px !important;
      min-height: 20px !important;
      font-size: 14px !important;
      line-height: 1.5 !important;
      color: #53627c !important;
    }

    #ai-tutor-answer-box {
      margin-top: 14px !important;
      padding: 14px !important;
      border: 1px solid #d8e5fb !important;
      border-radius: 14px !important;
      background: #f5f9ff !important;
      color: #1f2d3d !important;
    }

    #ai-tutor-answer-title {
      margin: 0 0 8px 0 !important;
      font-size: 14px !important;
      font-weight: 700 !important;
      color: #1b2b44 !important;
      line-height: 1.4 !important;
    }

    #ai-tutor-answer {
      margin: 0 !important;
      font-size: 15px !important;
      line-height: 1.65 !important;
      color: #26364a !important;
      white-space: pre-wrap !important;
      text-shadow: none !important;
    }

    @media (max-width: 768px) {
      #ai-tutor-widget-wrap {
        margin: 18px auto !important;
        max-width: 100% !important;
      }

      #ai-tutor-widget-box {
        padding: 14px !important;
        border-radius: 16px !important;
      }

      #ai-tutor-title {
        font-size: 20px !important;
      }

      #ai-tutor-desc {
        font-size: 14px !important;
      }

      #ai-tutor-question {
        min-height: 100px !important;
        font-size: 16px !important;
      }

      #ai-tutor-row {
        flex-direction: column !important;
        align-items: stretch !important;
      }

      #ai-tutor-btn {
        width: 100% !important;
        font-size: 16px !important;
      }

      #ai-tutor-count {
        width: 100% !important;
        text-align: center !important;
      }
    }
  </style>
  `;

  document.currentScript.insertAdjacentHTML("beforebegin", html);

  const q = document.getElementById("ai-tutor-question");
  const btn = document.getElementById("ai-tutor-btn");
  const ans = document.getElementById("ai-tutor-answer");
  const box = document.getElementById("ai-tutor-answer-box");
  const status = document.getElementById("ai-tutor-status");
  const count = document.getElementById("ai-tutor-count");

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
    count.innerText = "Preostalo: " + left;

    if (left <= 0) {
      btn.disabled = true;
      status.innerText = "Limit pitanja dosegnut.";
    } else {
      btn.disabled = false;
    }
  }

  async function ask() {
    const used = getUsed();
    if (used >= MAX_QUESTIONS) return;

    const question = q.value.trim();
    if (!question) {
      status.innerText = "Upiši pitanje.";
      return;
    }

    btn.disabled = true;
    status.innerText = "AI razmišlja...";
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
        status.innerText = data.error || "Greška.";
        btn.disabled = false;
        return;
      }

      const answer = data.answer || "Nema odgovora.";
      ans.innerText = answer;
      box.style.display = "block";
      status.innerText = "Odgovor je spreman.";

      const newHistory = history.concat([{ question, answer }]);
      setHistory(newHistory);
      setUsed(used + 1);
      q.value = "";
    } catch (e) {
      status.innerText = "Greška povezivanja.";
    }

    btn.disabled = false;
    update();
  }

  btn.addEventListener("click", ask);
  update();
})();
