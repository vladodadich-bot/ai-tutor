(function () {
  if (window.SiteMindWidgetLoaded) return;
  window.SiteMindWidgetLoaded = true;

  var config = window.SiteMindConfig || {};
  var agentId = config.agentId || "demo-agent";
  var baseUrl = "https://ai-tutor-rouge-theta.vercel.app";

  var isOpen = false;

  function cleanText(text) {
    return (text || "")
      .replace(/\s+/g, " ")
      .replace(/\n+/g, " ")
      .trim();
  }

  function getMetaDescription() {
    var meta =
      document.querySelector('meta[name="description"]') ||
      document.querySelector('meta[property="og:description"]');

    return meta ? (meta.getAttribute("content") || "").trim() : "";
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

    if (raw.indexOf("en") === 0) {
      return "en";
    }

    return "en";
  }

  function getMainText() {
    var selectors = [
      "main",
      "article",
      "[role='main']",
      ".post-body",
      ".entry-content",
      ".article-content",
      ".content",
      ".page-content",
      ".product-description",
      ".post",
      ".container",
      "body"
    ];

    var bestText = "";

    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.innerText) {
        var text = cleanText(el.innerText);
        if (text.length > bestText.length) {
          bestText = text;
        }
      }
    }

    return bestText.slice(0, 6000);
  }

  function getPageContext() {
    return {
      pageUrl: window.location.href,
      pageTitle: document.title || "",
      pageDescription: getMetaDescription(),
      pageText: getMainText(),
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
  button.style.background = "linear-gradient(135deg, #0f172a, #2563eb)";
  button.style.color = "#fff";
  button.style.fontSize = "28px";
  button.style.cursor = "pointer";
  button.style.zIndex = "999999";
  button.style.boxShadow = "0 12px 30px rgba(0,0,0,0.20)";

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

    setTimeout(function () {
      sendPageContext();
    }, 250);
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

  document.addEventListener("DOMContentLoaded", appendWidget);

  if (document.body) {
    appendWidget();
  }
})();
