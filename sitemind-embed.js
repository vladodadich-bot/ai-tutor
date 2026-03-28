(function () {
  "use strict";

  if (window.__sitemindWidgetLoaded) return;
  window.__sitemindWidgetLoaded = true;

  var CURRENT_SCRIPT = document.currentScript || (function () {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1] || null;
  })();

  var SCRIPT_SRC = CURRENT_SCRIPT ? CURRENT_SCRIPT.src : "";
  var SCRIPT_URL;

  try {
    SCRIPT_URL = new URL(SCRIPT_SRC, window.location.href);
  } catch (e) {
    return;
  }

  var BASE_URL = SCRIPT_URL.origin;

  var agentId =
    (CURRENT_SCRIPT && CURRENT_SCRIPT.getAttribute("data-agent-id")) ||
    "demo-agent";

  var bubbleText =
    (CURRENT_SCRIPT && CURRENT_SCRIPT.getAttribute("data-bubble-text")) ||
    "💬 Trebaš pomoć?<br>Pitaj AI web asistenta";

  var position =
    (CURRENT_SCRIPT && CURRENT_SCRIPT.getAttribute("data-position")) ||
    "bottom-right";

  var themeColor =
    (CURRENT_SCRIPT && CURRENT_SCRIPT.getAttribute("data-color")) ||
    "#2563eb";

  var iframe = null;
  var bubble = null;
  var panel = null;
  var isOpen = false;

  function getPageTitle() {
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) return ogTitle.content.trim();

    var h1 = document.querySelector("h1");
    if (h1 && h1.textContent) return h1.textContent.trim();

    return document.title || "";
  }

  function getPageDescription() {
    var meta =
      document.querySelector('meta[name="description"]') ||
      document.querySelector('meta[property="og:description"]');

    return meta && meta.content ? meta.content.trim() : "";
  }

  function cleanText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .replace(/\u00A0/g, " ")
      .trim();
  }

  function getMainContentText() {
    var selectors = [
      "article",
      "main",
      ".post-body",
      ".entry-content",
      ".post",
      ".content",
      "#content",
      ".article-content"
    ];

    var root = null;

    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) {
        root = el;
        break;
      }
    }

    if (!root) root = document.body;

    var clone = root.cloneNode(true);

    var removeSelectors = [
      "script",
      "style",
      "noscript",
      "iframe",
      "svg",
      "canvas",
      "img",
      "video",
      "audio",
      "form",
      "button",
      "input",
      "textarea",
      "select",
      "nav",
      "footer",
      "header",
      ".sidebar",
      ".menu",
      ".nav",
      ".comments",
      "#comments",
      ".related-posts",
      ".share-buttons",
      ".social-share",
      ".advertisement",
      ".adsbygoogle",
      ".cookie-banner",
      ".newsletter",
      ".popup",
      ".chat-widget",
      "#sitemind-widget-root"
    ];

    for (var j = 0; j < removeSelectors.length; j++) {
      var nodes = clone.querySelectorAll(removeSelectors[j]);
      for (var k = 0; k < nodes.length; k++) {
        nodes[k].remove();
      }
    }

    var text = cleanText(clone.innerText || clone.textContent || "");

    if (text.length > 3000) {
      text = text.slice(0, 3000);
    }

    return text;
  }

  function getPageContextPayload() {
    return {
      type: "sitemind-page-context",
      pageTitle: getPageTitle(),
      pageDescription: getPageDescription(),
      pageUrl: window.location.href,
      pageContext: getMainContentText()
    };
  }

  function sendPageContext() {
    if (!iframe || !iframe.contentWindow) return;

    var payload = getPageContextPayload();

    try {
      iframe.contentWindow.postMessage(payload, BASE_URL);
    } catch (e) {
      try {
        iframe.contentWindow.postMessage(payload, "*");
      } catch (err) {}
    }
  }

  function createWidget() {
    if (document.getElementById("sitemind-widget-root")) return;

    var root = document.createElement("div");
    root.id = "sitemind-widget-root";
    document.body.appendChild(root);

    bubble = document.createElement("button");
    bubble.type = "button";
    bubble.setAttribute("aria-label", "Open chat");
    bubble.innerHTML = bubbleText;

   bubble.style.position = "fixed";
bubble.style.zIndex = "999999";
bubble.style.border = "1px solid rgba(255,255,255,0.18)";
bubble.style.borderRadius = "999px";
bubble.style.padding = "14px 22px";
bubble.style.background = "linear-gradient(135deg, " + themeColor + ", #60a5fa)";
bubble.style.color = "#fff";
bubble.style.fontSize = "14px";
bubble.style.fontWeight = "700";
bubble.style.lineHeight = "1.35";
bubble.style.textAlign = "center";
bubble.style.maxWidth = "255px";
bubble.style.boxShadow = "0 16px 34px rgba(37, 99, 235, 0.28)";
bubble.style.cursor = "pointer";
bubble.style.whiteSpace = "normal";
    if (window.innerWidth < 520) {
  bubble.style.maxWidth = "220px";
  bubble.style.fontSize = "13px";
  bubble.style.padding = "12px 18px";
}

    panel = document.createElement("div");
    panel.style.position = "fixed";
    panel.style.zIndex = "999999";
    panel.style.width = "380px";
    panel.style.maxWidth = "calc(100vw - 24px)";
    panel.style.height = "620px";
    panel.style.maxHeight = "calc(100vh - 90px)";
    panel.style.background = "#fff";
    panel.style.borderRadius = "16px";
    panel.style.overflow = "hidden";
    panel.style.boxShadow = "0 18px 50px rgba(0,0,0,0.22)";
    panel.style.display = "none";

    if (window.innerWidth < 520) {
      panel.style.width = "calc(100vw - 16px)";
      panel.style.height = "min(78vh, 620px)";
    }

    iframe = document.createElement("iframe");
    iframe.src = BASE_URL + "/widget-frame.html?agentId=" + encodeURIComponent(agentId);
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.setAttribute("title", "SiteMind AI Chat");

    panel.appendChild(iframe);

    if (position === "bottom-left") {
      bubble.style.left = "16px";
      bubble.style.bottom = "16px";
      panel.style.left = "16px";
      panel.style.bottom = "92px";
    } else {
      bubble.style.right = "16px";
      bubble.style.bottom = "16px";
      panel.style.right = "16px";
      panel.style.bottom = "92px";
    }
var closeBtn = document.createElement("button");
closeBtn.type = "button";
closeBtn.setAttribute("aria-label", "Close chat");
closeBtn.innerHTML = "&times;";
closeBtn.style.border = "0";
closeBtn.style.background = "transparent";
closeBtn.style.color = "#334155";
closeBtn.style.fontSize = "24px";
closeBtn.style.lineHeight = "1";
closeBtn.style.width = "34px";
closeBtn.style.height = "34px";
closeBtn.style.borderRadius = "999px";
closeBtn.style.cursor = "pointer";
closeBtn.style.display = "flex";
closeBtn.style.alignItems = "center";
closeBtn.style.justifyContent = "center";

closeBtn.addEventListener("click", function () {
  isOpen = false;
  panel.style.display = "none";
});

iframe = document.createElement("iframe");
iframe.src = BASE_URL + "/widget-frame.html?agentId=" + encodeURIComponent(agentId);
iframe.style.width = "100%";
iframe.style.height = "calc(100% - 42px)";
iframe.style.border = "0";
iframe.setAttribute("title", "SiteMind AI Chat");

panelHeader.appendChild(closeBtn);
panel.appendChild(panelHeader);
panel.appendChild(iframe);
    bubble.addEventListener("click", function () {
      isOpen = !isOpen;
      panel.style.display = isOpen ? "block" : "none";

      if (isOpen) {
        sendPageContext();
      }
    });

    iframe.addEventListener("load", function () {
      setTimeout(sendPageContext, 300);
      setTimeout(sendPageContext, 1200);
    });

    root.appendChild(panel);
    root.appendChild(bubble);
  }

  window.addEventListener("message", function (event) {
    if (!event.data || typeof event.data !== "object") return;

    if (event.data.type === "sitemind-widget-ready") {
      sendPageContext();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createWidget);
  } else {
    createWidget();
  }
})();
