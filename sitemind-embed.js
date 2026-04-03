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
    "💬 You need help?<br>Ask AI web Agent";

  var position =
    (CURRENT_SCRIPT && CURRENT_SCRIPT.getAttribute("data-position")) ||
    "bottom-right";

  var themeColor =
    (CURRENT_SCRIPT && CURRENT_SCRIPT.getAttribute("data-color")) ||
    "#2563eb";

  var iframe = null;
  var bubble = null;
  var panel = null;
  var footerLink = null;
  var isOpen = false;

  var originalBodyPaddingRight = "";
  var originalBodyPaddingLeft = "";
  var originalHtmlOverflowX = "";
  var originalBodyOverflowX = "";

  function isDesktop() {
    return window.innerWidth >= 992;
  }

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

  function applyBubblePosition() {
    if (!bubble) return;

    bubble.style.left = "";
    bubble.style.right = "";
    bubble.style.bottom = "16px";

    if (position === "bottom-left") {
      bubble.style.left = "16px";
    } else {
      bubble.style.right = "16px";
    }
  }

  function applyPanelLayout() {
    if (!panel || !bubble || !iframe) return;

    panel.style.left = "";
    panel.style.right = "";
    panel.style.top = "";
    panel.style.bottom = "";
    panel.style.width = "";
    panel.style.height = "";
    panel.style.maxWidth = "";
    panel.style.maxHeight = "";
    panel.style.borderRadius = "";
    panel.style.borderLeft = "";
    panel.style.borderRight = "";
    panel.style.background = "#fff";
    panel.style.overflow = "hidden";
    panel.style.boxShadow = "0 18px 50px rgba(0,0,0,0.22)";

    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";

    if (isDesktop()) {
      panel.style.width = "400px";
      panel.style.height = "100vh";
      panel.style.maxWidth = "400px";
      panel.style.maxHeight = "100vh";
      panel.style.top = "0";
      panel.style.bottom = "0";
      panel.style.borderRadius = "0";

      if (position === "bottom-left") {
        panel.style.left = "0";
        panel.style.borderRight = "1px solid rgba(15,23,42,0.08)";
        panel.style.boxShadow = "12px 0 40px rgba(15,23,42,0.16)";
      } else {
        panel.style.right = "0";
        panel.style.borderLeft = "1px solid rgba(15,23,42,0.08)";
        panel.style.boxShadow = "-12px 0 40px rgba(15,23,42,0.16)";
      }
    } else {
      panel.style.width = window.innerWidth < 520 ? "calc(100vw - 16px)" : "380px";
      panel.style.maxWidth = "calc(100vw - 24px)";
      panel.style.height = window.innerWidth < 520 ? "min(78vh, 620px)" : "620px";
      panel.style.maxHeight = "calc(100vh - 90px)";
      panel.style.borderRadius = "16px";

      if (position === "bottom-left") {
        panel.style.left = "16px";
        panel.style.bottom = "92px";
      } else {
        panel.style.right = "16px";
        panel.style.bottom = "92px";
      }
    }

    panel.style.display = isOpen ? "block" : "none";
    bubble.style.display = isOpen ? "none" : "block";
  }

  function updateBrandLinkVisibility() {
    if (!footerLink) return;
    footerLink.style.display = isOpen ? "block" : "none";
  }

  function applyPageShrink() {
    if (!isDesktop()) return;

    if (originalBodyPaddingRight === "") {
      originalBodyPaddingRight = document.body.style.paddingRight || "";
    }
    if (originalBodyPaddingLeft === "") {
      originalBodyPaddingLeft = document.body.style.paddingLeft || "";
    }
    if (originalHtmlOverflowX === "") {
      originalHtmlOverflowX = document.documentElement.style.overflowX || "";
    }
    if (originalBodyOverflowX === "") {
      originalBodyOverflowX = document.body.style.overflowX || "";
    }

    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";
    document.body.style.transition = "padding-right 0.28s ease, padding-left 0.28s ease";

    if (position === "bottom-left") {
      document.body.style.paddingLeft = "400px";
      document.body.style.paddingRight = originalBodyPaddingRight;
    } else {
      document.body.style.paddingRight = "400px";
      document.body.style.paddingLeft = originalBodyPaddingLeft;
    }
  }

  function resetPageShrink() {
    document.body.style.paddingRight = originalBodyPaddingRight;
    document.body.style.paddingLeft = originalBodyPaddingLeft;
    document.documentElement.style.overflowX = originalHtmlOverflowX;
    document.body.style.overflowX = originalBodyOverflowX;
  }

  function openPanel() {
    isOpen = true;
    applyPanelLayout();
    applyPageShrink();
    updateBrandLinkVisibility();
    sendPageContext();
  }

  function closePanel() {
    isOpen = false;
    applyPanelLayout();
    resetPageShrink();
    updateBrandLinkVisibility();
  }

  function togglePanel() {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function createBrandLink(root) {
    footerLink = document.createElement("a");
    footerLink.href = "https://sitemindai.app";
    footerLink.target = "_blank";
    footerLink.rel = "noopener noreferrer";
    footerLink.textContent = "sitemindai.app";

    footerLink.style.position = "fixed";
    footerLink.style.zIndex = "999999";
    footerLink.style.textDecoration = "none";
    footerLink.style.fontSize = "11px";
    footerLink.style.lineHeight = "1";
    footerLink.style.fontWeight = "600";
    footerLink.style.color = "rgba(15,23,42,0.58)";
    footerLink.style.background = "rgba(255,255,255,0.82)";
    footerLink.style.backdropFilter = "blur(10px)";
    footerLink.style.padding = "7px 10px";
    footerLink.style.borderRadius = "999px";
    footerLink.style.boxShadow = "0 8px 18px rgba(15,23,42,0.10)";
    footerLink.style.border = "1px solid rgba(15,23,42,0.08)";
    footerLink.style.transition = "opacity 0.2s ease";
    footerLink.style.display = "none";

    if (position === "bottom-left") {
      footerLink.style.left = "16px";
    } else {
      footerLink.style.right = "16px";
    }

    footerLink.style.bottom = isDesktop() ? "14px" : "20px";

    root.appendChild(footerLink);
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
    bubble.style.transition = "transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease";

    if (window.innerWidth < 520) {
      bubble.style.maxWidth = "220px";
      bubble.style.fontSize = "13px";
      bubble.style.padding = "12px 18px";
    }

    panel = document.createElement("div");
    panel.style.position = "fixed";
    panel.style.zIndex = "999999";
    panel.style.background = "#fff";
    panel.style.overflow = "hidden";

    iframe = document.createElement("iframe");
    iframe.src = BASE_URL + "/widget-frame.html?agentId=" + encodeURIComponent(agentId);
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.setAttribute("title", "SiteMind AI Chat");

    panel.appendChild(iframe);

    root.appendChild(panel);
    root.appendChild(bubble);
    createBrandLink(root);

    applyBubblePosition();
    applyPanelLayout();
    updateBrandLinkVisibility();

    bubble.addEventListener("click", togglePanel);

    iframe.addEventListener("load", function () {
      setTimeout(sendPageContext, 300);
      setTimeout(sendPageContext, 1200);
    });
  }

  window.addEventListener("message", function (event) {
    if (!event.data || typeof event.data !== "object") return;

    if (event.data.type === "sitemind-widget-ready") {
      sendPageContext();
    }

    if (event.data.type === "sitemind-close-widget") {
      closePanel();
    }
  });

  window.addEventListener("resize", function () {
    applyBubblePosition();
    applyPanelLayout();

    if (isOpen) {
      if (isDesktop()) {
        applyPageShrink();
      } else {
        resetPageShrink();
      }
    } else {
      resetPageShrink();
    }

    if (footerLink) {
      if (position === "bottom-left") {
        footerLink.style.left = "16px";
        footerLink.style.right = "";
      } else {
        footerLink.style.right = "16px";
        footerLink.style.left = "";
      }

      footerLink.style.bottom = isDesktop() ? "14px" : "20px";
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createWidget);
  } else {
    createWidget();
  }
})();
