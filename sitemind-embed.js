(function () {
  if (window.SiteMindWidgetLoaded) return;
  window.SiteMindWidgetLoaded = true;

  var style = document.createElement("style");
  style.innerHTML = `
@keyframes sitemindPulse {
  0% { box-shadow: 0 0 0 0 rgba(45,127,249,0.22); }
  70% { box-shadow: 0 0 0 14px rgba(45,127,249,0); }
  100% { box-shadow: 0 0 0 0 rgba(45,127,249,0); }
}

@keyframes sitemindFloat {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-2px); }
  100% { transform: translateY(0px); }
}
`;
  (document.head || document.documentElement).appendChild(style);

  var config = window.SiteMindConfig || {};
  var agentId = config.agentId || "demo-agent";
  var baseUrl = (config.baseUrl || "https://ai-tutor-rouge-theta.vercel.app").replace(/\/$/, "");
  var isOpen = false;

  function cleanText(text) {
    return (text || "")
      .replace(/\s+/g, " ")
      .replace(/\u00A0/g, " ")
      .trim();
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

  function extractSmartPageText() {
    var parts = [];

    var h1 = document.querySelector("h1");
    if (h1 && cleanText(h1.innerText)) {
      parts.push(cleanText(h1.innerText).slice(0, 180));
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
      document.querySelector(".main-content") ||
      document.querySelector("#content") ||
      document.body;

    if (main) {
      var text = cleanText(main.innerText || "");
      if (text) {
        parts.push(text.slice(0, 1800));
      }
    }

    return cleanText(parts.join("\n")).slice(0, 1800);
  }

  function getPageContext() {
    return {
      pageUrl: window.location.href,
      pageTitle: cleanText(document.title || "").slice(0, 180),
      pageDescription: getMetaDescription().slice(0, 280),
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
  button.type = "button";
  button.setAttribute("aria-label", "Open chat");

  button.style.position = "fixed";
  button.style.right = "20px";
  button.style.bottom = "20px";
  button.style.width = "74px";
  button.style.height = "74px";
  button.style.padding = "0";
  button.style.border = "1px solid rgba(223,229,238,0.16)";
  button.style.borderRadius = "22px";
  button.style.background = "linear-gradient(135deg, #1D2739 0%, #24324A 55%, #2d7ff9 100%)";
  button.style.color = "#ffffff";
  button.style.cursor = "pointer";
  button.style.zIndex = "999999";
  button.style.boxShadow = "0 14px 34px rgba(0,0,0,0.24)";
  button.style.backdropFilter = "blur(10px)";
  button.style.transition = "all 0.28s ease";
  button.style.animation = "sitemindPulse 3.2s infinite, sitemindFloat 4s ease-in-out infinite";
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.overflow = "hidden";

  var inner = document.createElement("div");
  inner.style.position = "relative";
  inner.style.width = "100%";
  inner.style.height = "100%";
  inner.style.display = "flex";
  inner.style.alignItems = "center";
  inner.style.justifyContent = "center";

  var icon = document.createElement("div");
  icon.textContent = "💬";
  icon.style.fontSize = "28px";
  icon.style.lineHeight = "1";
  icon.style.transform = "translateY(-1px)";

  var label = document.createElement("div");
  label.textContent = "AI";
  label.style.position = "absolute";
  label.style.top = "7px";
  label.style.right = "7px";
  label.style.minWidth = "24px";
  label.style.height = "24px";
  label.style.padding = "0 7px";
  label.style.borderRadius = "999px";
  label.style.background = "rgba(255,255,255,0.12)";
  label.style.border = "1px solid rgba(255,255,255,0.14)";
  label.style.display = "flex";
  label.style.alignItems = "center";
  label.style.justifyContent = "center";
  label.style.fontSize = "10px";
  label.style.fontWeight = "700";
  label.style.color = "#ffffff";
  label.style.letterSpacing = "0.3px";

  inner.appendChild(icon);
  inner.appendChild(label);
  button.appendChild(inner);

  var iframe = document.createElement("iframe");
  iframe.id = "sitemind-widget-frame";
  iframe.src =
    baseUrl +
    "/widget-frame.html?agentId=" +
    encodeURIComponent(agentId) +
    "&baseUrl=" +
    encodeURIComponent(baseUrl);

  iframe.style.position = "fixed";
  iframe.style.right = "20px";
  iframe.style.bottom = "106px";
  iframe.style.width = "380px";
  iframe.style.height = "600px";
  iframe.style.border = "1px solid rgba(223,229,238,0.10)";
  iframe.style.borderRadius = "22px";
  iframe.style.background = "#1D2739";
  iframe.style.boxShadow = "0 24px 70px rgba(0,0,0,0.35)";
  iframe.style.zIndex = "999998";
  iframe.style.display = "none";
  iframe.style.overflow = "hidden";

  function applyMobileStyles() {
    if (window.innerWidth < 520) {
      button.style.right = "14px";
      button.style.bottom = "14px";
      button.style.width = "68px";
      button.style.height = "68px";
      button.style.borderRadius = "20px";
      icon.style.fontSize = "25px";

      iframe.style.right = "10px";
      iframe.style.left = "10px";
      iframe.style.bottom = "92px";
      iframe.style.width = "calc(100vw - 20px)";
      iframe.style.height = "72vh";
    } else {
      button.style.right = "20px";
      button.style.bottom = "20px";
      button.style.width = "74px";
      button.style.height = "74px";
      button.style.borderRadius = "22px";
      icon.style.fontSize = "28px";

      iframe.style.left = "auto";
      iframe.style.right = "20px";
      iframe.style.bottom = "106px";
      iframe.style.width = "380px";
      iframe.style.height = "600px";
    }
  }

  function setClosedVisual() {
    icon.textContent = "💬";
    label.style.display = "flex";
    button.style.background = "linear-gradient(135deg, #1D2739 0%, #24324A 55%, #2d7ff9 100%)";
    button.style.boxShadow = "0 14px 34px rgba(0,0,0,0.24)";
  }

  function setOpenVisual() {
    icon.textContent = "✕";
    label.style.display = "none";
    button.style.background = "linear-gradient(135deg, #1D2739 0%, #1D2739 100%)";
    button.style.boxShadow = "0 14px 34px rgba(0,0,0,0.30)";
  }

  function openWidget() {
    iframe.style.display = "block";
    setOpenVisual();
    isOpen = true;
    setTimeout(sendPageContext, 80);
  }

  function closeWidget() {
    iframe.style.display = "none";
    setClosedVisual();
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
    button.style.transform = "translateY(-2px) scale(1.05)";
    button.style.boxShadow = "0 18px 42px rgba(0,0,0,0.30)";
  });

  button.addEventListener("mouseleave", function () {
    button.style.transform = "translateY(0) scale(1)";
    if (isOpen) {
      button.style.boxShadow = "0 14px 34px rgba(0,0,0,0.30)";
    } else {
      button.style.boxShadow = "0 14px 34px rgba(0,0,0,0.24)";
    }
  });

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
    setClosedVisual();
  }

  if (document.body) {
    appendWidget();
  } else {
    document.addEventListener("DOMContentLoaded", appendWidget);
  }
})();
