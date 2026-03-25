(function () {
  var style = document.createElement("style");
style.innerHTML = `
@keyframes sitemindPulse {
  0% { box-shadow: 0 0 0 0 rgba(37,99,235,0.5); }
  70% { box-shadow: 0 0 0 12px rgba(37,99,235,0); }
  100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); }
}
`;
document.head.appendChild(style);
  if (window.SiteMindWidgetLoaded) return;
  window.SiteMindWidgetLoaded = true;

  var config = window.SiteMindConfig || {};
  var agentId = config.agentId || "demo-agent";
  var baseUrl = "https://ai-tutor-rouge-theta.vercel.app";

  var isOpen = false;

  function cleanText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function getMetaDescription() {
    var meta =
      document.querySelector('meta[name="description"]') ||
      document.querySelector('meta[property="og:description"]');

    return meta ? cleanText(meta.getAttribute("content") || "") : "";
  }

  function detectLanguage() {
    var htmlLang = document.documentElement.getAttribute("lang") || "";
    var ogLocaleMeta = document.querySelector('meta[property="og:locale"]');
    var ogLocale = ogLocaleMeta ? (ogLocaleMeta.getAttribute("content") || "") : "";
    var navLang = navigator.language || "";
    var raw = (htmlLang || ogLocale || navLang || "en").toLowerCase();

    if (raw.indexOf("hr") === 0 || raw.indexOf("bs") === 0 || raw.indexOf("sr") === 0) {
      return "hr";
    }

    if (raw.indexOf("de") === 0) {
      return "de";
    }

    return "en";
  }

  function pushIfUseful(parts, text, maxLen) {
    var cleaned = cleanText(text);
    if (!cleaned) return;
    if (cleaned.length > maxLen) {
      cleaned = cleaned.slice(0, maxLen);
    }
    parts.push(cleaned);
  }

  function extractSmartPageText() {
    var parts = [];

    var h1 = document.querySelector("h1");
    if (h1) pushIfUseful(parts, h1.innerText, 180);

    var h2s = document.querySelectorAll("h2");
    for (var i = 0; i < Math.min(h2s.length, 3); i++) {
      pushIfUseful(parts, h2s[i].innerText, 140);
    }

    var main =
      document.querySelector("main") ||
      document.querySelector("article") ||
      document.querySelector("[role='main']") ||
      document.querySelector(".post-body") ||
      document.querySelector(".entry-content") ||
      document.querySelector(".article-content") ||
      document.querySelector(".content") ||
      document.querySelector(".page-content") ||
      document.body;

    if (main) {
      var paragraphs = main.querySelectorAll("p, li");
      var count = 0;

      for (var j = 0; j < paragraphs.length; j++) {
        var txt = cleanText(paragraphs[j].innerText || "");
        if (txt.length < 35) continue;

        pushIfUseful(parts, txt, 280);
        count += 1;

        if (count >= 8) break;
      }
    }

    var faqCandidates = document.querySelectorAll(
      '[itemprop="name"], .faq-question, .faq-item, details summary'
    );

    for (var k = 0; k < Math.min(faqCandidates.length, 4); k++) {
      pushIfUseful(parts, faqCandidates[k].innerText, 180);
    }

    return cleanText(parts.join("\n")).slice(0, 1800);
  }

  function getPageContext() {
    return {
      pageUrl: window.location.href,
      pageTitle: document.title || "",
      pageDescription: getMetaDescription(),
      pageText: extractSmartPageText(),
      lang: detectLanguage()
    };
  }

  function sendPageContext() {
    if (!iframe.contentWindow) return;

    iframe.contentWindow.postMessage(
      {
        type: "sitemind_page_context",
        payload: getPageContext()
      },
      "*"
    );
  }

  var button = document.createElement("button");
  button.id = "sitemind-widget-button";
  button.innerHTML = "💬";

  button.style.position = "fixed";
  button.style.right = "20px";
  button.style.bottom = "20px";
  button.style.width = "64px";
  button.style.height = "64px";
  button.style.border = "none";
  button.style.borderRadius = "50%";
  button.style.background = "linear-gradient(135deg, #2563eb, #1d4ed8)";
button.style.color = "#fff";
button.style.fontSize = "26px";
button.style.cursor = "pointer";
button.style.zIndex = "999999";

/* 🔥 MODERNI STYLE */
button.style.boxShadow = "0 20px 40px rgba(37,99,235,0.45)";
button.style.backdropFilter = "blur(10px)";
button.style.border = "1px solid rgba(255,255,255,0.15)";
button.style.transition = "all 0.25s ease";
  var iframe = document.createElement("iframe");
  iframe.id = "sitemind-widget-frame";
  iframe.src = baseUrl + "/widget-frame.html?agentId=" + encodeURIComponent(agentId);

  iframe.style.position = "fixed";
  iframe.style.right = "20px";
  iframe.style.bottom = "96px";
  iframe.style.width = "380px";
  iframe.style.height = "600px";
  iframe.style.border = "none";
  iframe.style.borderRadius = "18px";
  iframe.style.background = "#fff";
  iframe.style.boxShadow = "0 20px 60px rgba(0,0,0,0.25)";
  iframe.style.zIndex = "999998";
  iframe.style.display = "none";

  function applyMobileStyles() {
    if (window.innerWidth < 520) {
      iframe.style.right = "10px";
      iframe.style.left = "10px";
      iframe.style.bottom = "84px";
      iframe.style.width = "calc(100vw - 20px)";
      iframe.style.height = "70vh";
    } else {
      iframe.style.left = "auto";
      iframe.style.right = "20px";
      iframe.style.bottom = "96px";
      iframe.style.width = "380px";
      iframe.style.height = "600px";
    }
  }

  function openWidget() {
    iframe.style.display = "block";
    button.innerHTML = "✕";
    isOpen = true;
    setTimeout(sendPageContext, 120);
  }

  function closeWidget() {
    iframe.style.display = "none";
    button.innerHTML = "💬";
    isOpen = false;
  }

  button.addEventListener("click", function () {
    if (isOpen) {
      closeWidget();
    } else {
      openWidget();
    }
  });
button.addEventListener("mouseenter", function () {
  button.style.transform = "scale(1.08)";
  button.style.boxShadow = "0 25px 50px rgba(37,99,235,0.6)";
});

button.addEventListener("mouseleave", function () {
  button.style.transform = "scale(1)";
  button.style.boxShadow = "0 20px 40px rgba(37,99,235,0.45)";
});
  button.style.animation = "sitemindPulse 3s infinite";
  iframe.addEventListener("load", function () {
    sendPageContext();
  });

  window.addEventListener("resize", applyMobileStyles);

  function appendWidget() {
    if (!document.getElementById("sitemind-widget-button")) {
      document.body.appendChild(button);
    }

    if (!document.getElementById("sitemind-widget-frame")) {
      document.body.appendChild(iframe);
    }

    applyMobileStyles();
  }

  if (document.body) {
    appendWidget();
  } else {
    document.addEventListener("DOMContentLoaded", appendWidget);
  }
})();
