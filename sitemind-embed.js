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

  var originalBodyPaddingRight = "";
  var originalBodyPaddingLeft = "";
  var originalHtmlOverflowX = "";
  var originalBodyOverflowX = "";

  function detectBrowserLanguage() {
  var browserLang = navigator.language || navigator.userLanguage || "en";
  var lang = String(browserLang || "en").toLowerCase();

  if (lang.indexOf("hr") === 0 || lang.indexOf("bs") === 0 || lang.indexOf("sr") === 0) return "hr";
  if (lang.indexOf("de") === 0) return "de";
  if (lang.indexOf("it") === 0) return "it";
  if (lang.indexOf("fr") === 0) return "fr";
  return "en";
}

function getDefaultBubbleText(lang) {
  if (lang === "hr") {
    return "💬 Trebaš pomoć?<br>Pitaj AI asistenta";
  }

  if (lang === "de") {
    return "💬 Brauchst du Hilfe?<br>Frag den KI-Assistenten";
  }

  if (lang === "it") {
    return "💬 Hai bisogno di aiuto?<br>Chiedi all'assistente AI";
  }

  if (lang === "fr") {
    return "💬 Besoin d’aide ?<br>Demandez à l’assistant IA";
  }

  return "💬 Need help?<br>Ask the AI assistant";
}

  var detectedLang = detectBrowserLanguage();

  var bubbleText =
    (CURRENT_SCRIPT && CURRENT_SCRIPT.getAttribute("data-bubble-text")) ||
    getDefaultBubbleText(detectedLang);

  function isDesktop() {
    return window.innerWidth >= 992;
  }

  function hexToRgb(hex) {
    var cleaned = String(hex || "").replace("#", "").trim();

    if (cleaned.length === 3) {
      cleaned = cleaned.split("").map(function (c) {
        return c + c;
      }).join("");
    }

    if (cleaned.length !== 6) return null;

    var num = parseInt(cleaned, 16);
    if (isNaN(num)) return null;

    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function rgbaFromHex(hex, alpha) {
    var rgb = hexToRgb(hex);
    if (!rgb) return "rgba(37, 99, 235, " + alpha + ")";
    return "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", " + alpha + ")";
  }

  function cleanText(text) {
    return String(text || "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getPageTitle() {
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) return cleanText(ogTitle.content);

    var title = document.title || "";
    if (title) return cleanText(title);

    var h1 = document.querySelector("h1");
    if (h1 && h1.textContent) return cleanText(h1.textContent);

    return "";
  }

  function getPageDescription() {
    var meta =
      document.querySelector('meta[name="description"]') ||
      document.querySelector('meta[property="og:description"]');

    return meta && meta.content ? cleanText(meta.content) : "";
  }

  function getPageH1() {
    var h1 = document.querySelector("h1");
    return h1 && h1.textContent ? cleanText(h1.textContent) : "";
  }

  function getHeadingsText() {
    var headings = [];
    var nodes = document.querySelectorAll("h1, h2, h3");

    for (var i = 0; i < nodes.length; i++) {
      var text = cleanText(nodes[i].innerText || nodes[i].textContent || "");
      if (text && headings.indexOf(text) === -1) {
        headings.push(text);
      }
      if (headings.length >= 12) break;
    }

    return headings;
  }

  function removeNodes(root, selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var nodes = root.querySelectorAll(selectors[i]);
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j] && nodes[j].remove) {
          nodes[j].remove();
        }
      }
    }
  }

  function getBestContentRoot() {
    var selectors = [
      "article",
      "main",
      '[role="main"]',
      ".post-body",
      ".entry-content",
      ".post-content",
      ".article-content",
      ".article-body",
      ".blog-post",
      ".post",
      ".content",
      "#content",
      ".main-content",
      ".page-content"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && cleanText(el.innerText || el.textContent || "").length > 120) {
        return el;
      }
    }

    return document.body;
  }

  function getMainContentText() {
    var root = getBestContentRoot();
    if (!root) return "";

    var clone = root.cloneNode(true);

    removeNodes(clone, [
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
      "aside",
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
      ".cookie-consent",
      ".newsletter",
      ".popup",
      ".modal",
      ".chat-widget",
      "#sitemind-widget-root"
    ]);

    var text = cleanText(clone.innerText || clone.textContent || "");

    if (!text || text.length < 200) {
      var bodyClone = document.body.cloneNode(true);

      removeNodes(bodyClone, [
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
        "aside",
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
        ".cookie-consent",
        ".newsletter",
        ".popup",
        ".modal",
        ".chat-widget",
        "#sitemind-widget-root"
      ]);

      text = cleanText(bodyClone.innerText || bodyClone.textContent || "");
    }

    if (text.length > 7000) {
      text = text.slice(0, 7000);
    }

    return text;
  }

  function getPageTypeHint() {
    var url = (window.location.href || "").toLowerCase();
    var title = getPageTitle().toLowerCase();
    var desc = getPageDescription().toLowerCase();
    var h1 = getPageH1().toLowerCase();
    var text = getMainContentText().slice(0, 2500).toLowerCase();
    var blob = [url, title, desc, h1, text].join(" ");

    function hasAny(words) {
      for (var i = 0; i < words.length; i++) {
        if (blob.indexOf(words[i]) !== -1) return true;
      }
      return false;
    }

    if (hasAny(["course", "lesson", "school", "lernen", "guide for students", "student", "unterricht"])) {
      return "education";
    }

    if (hasAny(["api", "developer", "sdk", "documentation", "docs", "integration", "javascript", "code", "vercel", "supabase"])) {
      return "technical";
    }

    if (hasAny(["pricing", "plan", "saas", "subscription", "business", "service", "agency", "software"])) {
      return "business";
    }

    if (hasAny(["shop", "product", "cart", "buy", "checkout", "store", "price"])) {
      return "ecommerce";
    }

    if (hasAny(["news", "article", "blog", "post"])) {
      return "blog";
    }

    if (hasAny(["travel", "hotel", "apartment", "booking", "guest"])) {
      return "travel";
    }

    if (hasAny(["movie", "fun", "entertainment", "music", "game", "show"])) {
      return "entertainment";
    }

    return "general";
  }

  function isTransparentColor(color) {
    var value = String(color || "").toLowerCase().trim();
    return (
      !value ||
      value === "transparent" ||
      value === "rgba(0, 0, 0, 0)" ||
      value === "rgba(0,0,0,0)" ||
      value === "inherit" ||
      value === "initial"
    );
  }

  function parseRgb(color) {
    if (!color) return null;

    var value = String(color).trim();

    if (value.charAt(0) === "#") {
      return hexToRgb(value);
    }

    var match = value.match(/rgba?\(([^)]+)\)/i);
    if (!match) return null;

    var parts = match[1].split(",");
    if (parts.length < 3) return null;

    return {
      r: parseInt(parts[0], 10),
      g: parseInt(parts[1], 10),
      b: parseInt(parts[2], 10)
    };
  }

  function getBrightness(color) {
    var rgb = parseRgb(color);
    if (!rgb) return 255;
    return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  }

  function findFirstVisibleElement(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (!el) continue;

      var rect = el.getBoundingClientRect();
      if ((rect.width > 0 || rect.height > 0) && el.offsetParent !== null) {
        return el;
      }

      if (rect.width > 0 || rect.height > 0) {
        return el;
      }
    }
    return null;
  }

  function getComputedStyleSafe(el) {
    if (!el) return null;
    try {
      return window.getComputedStyle(el);
    } catch (e) {
      return null;
    }
  }

  function pickSolidBackground(el) {
    if (!el) return "";

    var current = el;
    var depth = 0;

    while (current && depth < 5) {
      var style = getComputedStyleSafe(current);
      if (style) {
        var bg = style.backgroundColor;
        if (!isTransparentColor(bg)) {
          return bg;
        }
      }
      current = current.parentElement;
      depth += 1;
    }

    return "";
  }

  function detectHeaderElement() {
    return findFirstVisibleElement([
      "header",
      ".site-header",
      ".navbar",
      ".nav-bar",
      ".main-header",
      ".top-header",
      "#header",
      ".app-header"
    ]);
  }

  function detectAccentElement() {
    return findFirstVisibleElement([
      "button",
      ".btn",
      ".button",
      "[class*='btn']",
      "[class*='button']",
      "a.button",
      "a.btn",
      ".cta",
      "[class*='cta']"
    ]);
  }

  function detectPageBackgroundColor() {
    var mainRoot = getBestContentRoot();
    var bg =
      pickSolidBackground(mainRoot) ||
      pickSolidBackground(document.body) ||
      pickSolidBackground(document.documentElement);

    return bg || "#0b1220";
  }

  function detectHeaderBackgroundColor() {
    var headerEl = detectHeaderElement();
    var bg = pickSolidBackground(headerEl);

    return bg || "";
  }

  function detectAccentColor() {
    var accentEl = detectAccentElement();
    var style = getComputedStyleSafe(accentEl);

    if (style) {
      if (!isTransparentColor(style.backgroundColor)) {
        return style.backgroundColor;
      }
      if (!isTransparentColor(style.color)) {
        return style.color;
      }
      if (!isTransparentColor(style.borderColor)) {
        return style.borderColor;
      }
    }

    var link = document.querySelector("a");
    var linkStyle = getComputedStyleSafe(link);
    if (linkStyle && !isTransparentColor(linkStyle.color)) {
      return linkStyle.color;
    }

    return themeColor;
  }

  function detectSiteThemePayload() {
    var pageBg = detectPageBackgroundColor();
    var headerBg = detectHeaderBackgroundColor() || pageBg;
    var accent = detectAccentColor() || themeColor;

    var mode = getBrightness(pageBg) < 145 ? "dark" : "light";

    return {
      type: "sitemind-theme",
      agentId: agentId,
      mode: mode,
      pageBackground: pageBg,
      headerBackground: headerBg,
      accentColor: accent,
      fallbackColor: themeColor
    };
  }

  function getPageContextPayload() {
    var pageText = getMainContentText();

    return {
      type: "sitemind-page-context",
      agentId: agentId,
      language: detectBrowserLanguage(),
      pageTypeHint: getPageTypeHint(),
      pageTitle: getPageTitle(),
      pageDescription: getPageDescription(),
      pageUrl: window.location.href,
      h1: getPageH1(),
      headings: getHeadingsText(),
      pageContext: pageText,
      pageText: pageText
    };
  }

  function postToIframe(payload) {
    if (!iframe || !iframe.contentWindow || !payload) return;

    try {
      iframe.contentWindow.postMessage(payload, BASE_URL);
    } catch (e) {
      try {
        iframe.contentWindow.postMessage(payload, "*");
      } catch (err) {}
    }
  }

  function sendPageContext() {
    postToIframe(getPageContextPayload());
  }

  function sendThemeContext() {
    postToIframe(detectSiteThemePayload());
  }

  function sendAllContext() {
    sendThemeContext();
    sendPageContext();
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

function styleBubble() {
  if (!bubble) return;

  var bubbleDark = "#115C79";
  var bubbleLight = "#1588A7";

  var borderColor = "rgba(255,255,255,0.18)";
  var outerGlow = "rgba(17, 92, 121, 0.20)";
  var outerGlowHover = "rgba(17, 92, 121, 0.28)";
  var innerHighlight = "rgba(255,255,255,0.22)";
  var brushedLine = "rgba(255,255,255,0.045)";
  var brushedLineDark = "rgba(0,0,0,0.035)";

  bubble.style.position = "fixed";
  bubble.style.zIndex = "999999";
  bubble.style.border = "1px solid " + borderColor;
  bubble.style.borderRadius = "999px";
  bubble.style.padding = "14px 22px";
  bubble.style.color = "#ffffff";
  bubble.style.fontSize = "14px";
  bubble.style.fontWeight = "700";
  bubble.style.lineHeight = "1.35";
  bubble.style.textAlign = "center";
  bubble.style.maxWidth = "255px";
  bubble.style.cursor = "pointer";
  bubble.style.whiteSpace = "normal";
  bubble.style.backdropFilter = "blur(10px)";
  bubble.style.webkitBackdropFilter = "blur(10px)";
  bubble.style.transition =
    "transform 0.22s ease, box-shadow 0.22s ease, opacity 0.18s ease, border-color 0.22s ease, filter 0.22s ease";

  bubble.style.background =
    "linear-gradient(145deg, " + bubbleDark + " 0%, " + bubbleLight + " 52%, " + bubbleDark + " 100%), " +
    "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 38%, rgba(0,0,0,0.05) 100%), " +
    "repeating-linear-gradient(115deg, transparent 0px, transparent 6px, " + brushedLine + " 7px, transparent 12px), " +
    "repeating-linear-gradient(115deg, transparent 0px, transparent 11px, " + brushedLineDark + " 12px, transparent 17px), " +
    "radial-gradient(circle at 18% 18%, " + innerHighlight + ", transparent 28%)";

  bubble.style.boxShadow =
    "0 14px 34px " + outerGlow + ", " +
    "0 0 0 1px rgba(255,255,255,0.06), " +
    "inset 0 1px 0 rgba(255,255,255,0.18), " +
    "inset 0 -8px 18px rgba(0,0,0,0.10)";

  bubble.style.textShadow = "0 1px 1px rgba(0,0,0,0.18)";
  bubble.style.letterSpacing = "0.1px";

  if (window.innerWidth < 520) {
    bubble.style.maxWidth = "220px";
    bubble.style.fontSize = "13px";
    bubble.style.padding = "12px 18px";
  }

  bubble.onmouseenter = function () {
    bubble.style.transform = "translateY(-2px)";
    bubble.style.borderColor = "rgba(255,255,255,0.24)";
    bubble.style.boxShadow =
      "0 18px 40px " + outerGlowHover + ", " +
      "0 0 0 1px rgba(255,255,255,0.08), " +
      "inset 0 1px 0 rgba(255,255,255,0.22), " +
      "inset 0 -10px 20px rgba(0,0,0,0.12)";
    bubble.style.filter = "brightness(1.03)";
  };

  bubble.onmouseleave = function () {
    bubble.style.transform = "translateY(0)";
    bubble.style.borderColor = borderColor;
    bubble.style.boxShadow =
      "0 14px 34px " + outerGlow + ", " +
      "0 0 0 1px rgba(255,255,255,0.06), " +
      "inset 0 1px 0 rgba(255,255,255,0.18), " +
      "inset 0 -8px 18px rgba(0,0,0,0.10)";
    bubble.style.filter = "brightness(1)";
  };
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
    panel.style.border = "";
    panel.style.background = "#ffffff";
    panel.style.overflow = "hidden";
    panel.style.boxShadow = "0 18px 50px rgba(15,23,42,0.16)";
    panel.style.display = isOpen ? "block" : "none";

    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.background = "#ffffff";

    if (isDesktop()) {
      panel.style.width = "450px";
      panel.style.height = "100vh";
      panel.style.maxWidth = "450px";
      panel.style.maxHeight = "100vh";
      panel.style.top = "0";
      panel.style.bottom = "0";
      panel.style.borderRadius = "0";

      if (position === "bottom-left") {
        panel.style.left = "0";
        panel.style.borderRight = "1px solid rgba(37,99,235,0.10)";
        panel.style.boxShadow = "12px 0 36px rgba(15,23,42,0.12)";
      } else {
        panel.style.right = "0";
        panel.style.borderLeft = "1px solid rgba(37,99,235,0.10)";
        panel.style.boxShadow = "-12px 0 36px rgba(15,23,42,0.12)";
      }
    } else {
      panel.style.width = window.innerWidth < 520 ? "calc(100vw - 16px)" : "380px";
      panel.style.maxWidth = "calc(100vw - 24px)";
      panel.style.height = window.innerWidth < 520 ? "min(78vh, 620px)" : "620px";
      panel.style.maxHeight = "calc(100vh - 90px)";
      panel.style.borderRadius = "18px";
      panel.style.border = "1px solid rgba(37,99,235,0.10)";

      if (position === "bottom-left") {
        panel.style.left = "16px";
        panel.style.bottom = "92px";
      } else {
        panel.style.right = "16px";
        panel.style.bottom = "92px";
      }
    }

    bubble.style.display = isOpen ? "none" : "block";
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
      document.body.style.paddingLeft = "450px";
      document.body.style.paddingRight = originalBodyPaddingRight;
    } else {
      document.body.style.paddingRight = "450px";
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
    sendAllContext();
  }

  function closePanel() {
    isOpen = false;
    applyPanelLayout();
    resetPageShrink();
  }

  function togglePanel() {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
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

    panel = document.createElement("div");
    panel.style.position = "fixed";
    panel.style.zIndex = "999999";
    panel.style.background = "#ffffff";
    panel.style.overflow = "hidden";

    iframe = document.createElement("iframe");
    iframe.src =
      BASE_URL +
      "/widget-frame.html?agentId=" +
      encodeURIComponent(agentId) +
      "&lang=" +
      encodeURIComponent(detectedLang);
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.setAttribute("title", "SiteMind AI Chat");

    panel.appendChild(iframe);
    root.appendChild(panel);
    root.appendChild(bubble);

    applyBubblePosition();
    styleBubble();
    applyPanelLayout();

    bubble.addEventListener("click", togglePanel);

    iframe.addEventListener("load", function () {
      setTimeout(sendAllContext, 300);
      setTimeout(sendAllContext, 1200);
    });
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== BASE_URL && event.origin !== window.location.origin) return;
    if (!event.data || typeof event.data !== "object") return;

    if (event.data.type === "sitemind-widget-ready") {
      sendAllContext();
    }

    if (event.data.type === "sitemind-refresh-page-context") {
      sendAllContext();
    }

    if (event.data.type === "sitemind-close-widget") {
      closePanel();
    }
  });

  window.addEventListener("resize", function () {
    applyBubblePosition();
    styleBubble();
    applyPanelLayout();

    if (isOpen) {
      if (isDesktop()) {
        applyPageShrink();
      } else {
        resetPageShrink();
      }
      sendThemeContext();
    } else {
      resetPageShrink();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createWidget);
  } else {
    createWidget();
  }
})();
