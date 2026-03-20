(function () {
  const API_URL = "https://ai-tutor-rouge-theta.vercel.app/api/ask";

  const html = `
  <div id="ai-tutor-widget">
    <div class="ai-tutor-card">
      <h3>💬 Pitaj AI</h3>
      <textarea id="ai-question" placeholder="Postavi pitanje..."></textarea>
      <button id="ai-ask-btn">Pitaj</button>
      <div id="ai-answer"></div>
    </div>
  </div>

  <style>
    #ai-tutor-widget {
      margin:20px 0;
      font-family:Arial;
    }

    .ai-tutor-card {
      border:1px solid #ddd;
      padding:15px;
      border-radius:10px;
      background:#fff;
    }

    #ai-question {
      width:100%;
      min-height:80px;
      margin-bottom:10px;
    }

    #ai-ask-btn {
      background:#1a73e8;
      color:white;
      border:none;
      padding:10px;
      cursor:pointer;
    }

    #ai-answer {
      margin-top:10px;
    }
  </style>
  `;

  document.currentScript.insertAdjacentHTML("beforebegin", html);

  const btn = document.getElementById("ai-ask-btn");
  const questionEl = document.getElementById("ai-question");
  const answerEl = document.getElementById("ai-answer");

  btn.addEventListener("click", async () => {
    const question = questionEl.value.trim();
    if (!question) return;

    answerEl.innerText = "Razmišljam...";

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ question })
    });

    const data = await res.json();
    answerEl.innerText = data.answer || "Greška";
  });
})();
