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
    "#081F39";

  var iframe = null;
  var bubble = null;
  var panel = null;
  var isOpen = false;

  var bubbleShortLabelEl = null;
  var bubbleFullLabelEl = null;
  var bubbleIconEl = null;
  var isBubbleExpanded = false;
  var scrollExpandThreshold = 60;

  var originalBodyPaddingRight = "";
  var originalBodyPaddingLeft = "";
  var originalHtmlOverflowX = "";
  var originalBodyOverflowX = "";

  function detectPageLanguage() {
    var htmlLang = document.documentElement.getAttribute("lang") || "";
    var ogLocaleMeta = document.querySelector('meta[property="og:locale"]');
    var ogLocale = ogLocaleMeta && ogLocaleMeta.content ? ogLocaleMeta.content : "";
    var browserLang = navigator.language || navigator.userLanguage || "";

    var lang = (htmlLang || ogLocale || browserLang || "en").toLowerCase();

    if (lang.indexOf("hr") === 0) return "hr";
    if (lang.indexOf("de") === 0) return "de";
    if (lang.indexOf("it") === 0) return "it";
    if (lang.indexOf("fr") === 0) return "fr";
    return "en";
  }

  function getDefaultShortBubbleText(lang) {
    if (lang === "hr") return "Pitaj";
    if (lang === "de") return "Fragen";
    if (lang === "it") return "Chiedi";
    if (lang === "fr") return "Demander";
    return "Ask";
  }

  function getDefaultFullBubbleText(lang) {
    if (lang === "hr") {
      return "Trebaš pomoć?<br>Pitaj AI asistenta";
    }

    if (lang === "de") {
      return "Brauchst du Hilfe?<br>Frag den KI-Assistenten";
    }

    if (lang === "it") {
      return "Hai bisogno di aiuto?<br>Chiedi all'assistente AI";
    }

    if (lang === "fr") {
      return "Besoin d’aide ?<br>Demandez à l’assistant IA";
    }

    return "Need help?<br>Ask the AI assistant";
  }

  var detectedLang = detectPageLanguage();

  var bubbleShortText =
    (CURRENT_SCRIPT && CURRENT_SCRIPT.getAttribute("data-bubble-short-text")) ||
    getDefaultShortBubbleText(detectedLang);

  var bubbleText =
    (CURRENT_SCRIPT && CURRENT_SCRIPT.getAttribute("data-bubble-text")) ||
    getDefaultFullBubbleText(detectedLang);

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
    if (!rgb) return "rgba(8, 31, 57, " + alpha + ")";
    return "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", " + alpha + ")";
  }

  function lightenHex(hex, amount) {
    var rgb = hexToRgb(hex);
    if (!rgb) return hex;

    function clamp(value) {
      return Math.max(0, Math.min(255, value));
    }

    function toHex(value) {
      var hexValue = clamp(value).toString(16);
      return hexValue.length === 1 ? "0" + hexValue : hexValue;
    }

    var r = clamp(rgb.r + amount);
    var g = clamp(rgb.g + amount);
    var b = clamp(rgb.b + amount);

    return "#" + toHex(r) + toHex(g) + toHex(b);
  }

  function darkenHex(hex, amount) {
    return lightenHex(hex, -Math.abs(amount));
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
    var url = String(window.location.href || "").toLowerCase();
    var title = String(getPageTitle() || "").toLowerCase();
    var desc = String(getPageDescription() || "").toLowerCase();
    var h1 = String(getPageH1() || "").toLowerCase();
    var headings = String((getHeadingsText() || []).join(" ") || "").toLowerCase();
    var text = String(getMainContentText() || "").slice(0, 2500).toLowerCase();

    var blob = [url, title, desc, h1, headings, text].join(" ");

    function hasAny(words) {
      for (var i = 0; i < words.length; i++) {
        if (blob.indexOf(words[i]) !== -1) return true;
      }
      return false;
    }

    if (hasAny([
      "api", "developer", "sdk", "documentation", "docs", "integration",
      "javascript", "typescript", "react", "code", "vercel", "supabase",
      "endpoint", "reference"
    ])) {
      return "technical";
    }

    if (hasAny([
      "shop", "product", "cart", "buy", "checkout", "store",
      "price", "add to cart", "sku"
    ])) {
      return "ecommerce";
    }

    if (hasAny([
      "travel", "hotel", "apartment", "booking", "guest",
      "reservation", "stay", "accommodation"
    ])) {
      return "travel";
    }

    if (hasAny([
      "pricing", "plan", "saas", "subscription", "service", "agency",
      "software", "company", "business"
    ])) {
      return "business";
    }

    if (hasAny([
      "news", "article", "blog", "post", "author", "published", "read more"
    ])) {
      return "blog";
    }

    if (hasAny([
      "course", "lesson", "school", "lernen", "guide for students",
      "student", "unterricht", "education", "learning", "study"
    ])) {
      return "education";
    }

    if (hasAny([
      "movie", "music", "game", "show", "entertainment"
    ])) {
      return "entertainment";
    }

    return "general";
  }

  function getPageContextPayload() {
    var pageText = getMainContentText();

    return {
      type: "sitemind-page-context",
      agentId: agentId,
      language: detectPageLanguage(),
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
    bubble.style.bottom = "18px";

    if (position === "bottom-left") {
      bubble.style.left = "18px";
    } else {
      bubble.style.right = "18px";
    }
  }

  function styleBubble() {
    if (!bubble) return;

    var bubbleBase = themeColor || "#081F39";
    var bubbleDark = darkenHex(bubbleBase, 10);
    var bubbleMid = lightenHex(bubbleBase, 12);
    var bubbleHighlight = lightenHex(bubbleBase, 22);
    var borderGlow = rgbaFromHex(bubbleHighlight, 0.24);
    var shadowOuter = rgbaFromHex("#000000", 0.28);
    var shadowSoft = rgbaFromHex(bubbleBase, 0.24);
    var shadowGlow = rgbaFromHex(bubbleHighlight, 0.18);

    bubble.style.position = "fixed";
    bubble.style.zIndex = "999999";
    bubble.style.border = "1px solid " + borderGlow;
    bubble.style.borderRadius = "999px";
    bubble.style.background =
      "radial-gradient(circle at 50% 45%, " + rgbaFromHex(bubbleHighlight, 0.30) + " 0%, " + rgbaFromHex(bubbleMid, 0.18) + " 22%, rgba(255,255,255,0.00) 50%), linear-gradient(180deg, " + bubbleDark + " 0%, " + bubbleBase + " 38%, " + bubbleMid + " 52%, " + bubbleBase + " 70%, " + bubbleDark + " 100%)";
    bubble.style.color = "#ffffff";
    bubble.style.cursor = "pointer";
    bubble.style.whiteSpace = "normal";
    bubble.style.backdropFilter = "blur(10px)";
    bubble.style.webkitBackdropFilter = "blur(10px)";
    bubble.style.transition =
      "transform 0.34s ease, box-shadow 0.24s ease, opacity 0.24s ease, border-color 0.24s ease, filter 0.24s ease, padding 0.30s ease, max-width 0.34s ease, min-width 0.34s ease";
    bubble.style.display = "inline-flex";
    bubble.style.alignItems = "center";
    bubble.style.justifyContent = "center";
    bubble.style.gap = "10px";
    bubble.style.textAlign = "center";
    bubble.style.boxShadow =
      "0 18px 34px " + shadowOuter + ", 0 10px 26px " + shadowSoft + ", 0 0 0 1px rgba(255,255,255,0.06), 0 0 18px " + shadowGlow;

    if (bubbleIconEl) {
      bubbleIconEl.style.display = "inline-flex";
      bubbleIconEl.style.alignItems = "center";
      bubbleIconEl.style.justifyContent = "center";
      bubbleIconEl.style.fontSize = window.innerWidth < 520 ? "14px" : "15px";
      bubbleIconEl.style.lineHeight = "1";
      bubbleIconEl.style.flexShrink = "0";
      bubbleIconEl.style.filter = "drop-shadow(0 1px 1px rgba(0,0,0,0.18))";
    }

    if (bubbleShortLabelEl) {
      bubbleShortLabelEl.style.fontSize = window.innerWidth < 520 ? "13px" : "14px";
      bubbleShortLabelEl.style.fontWeight = "800";
      bubbleShortLabelEl.style.lineHeight = "1";
      bubbleShortLabelEl.style.letterSpacing = "0.01em";
      bubbleShortLabelEl.style.whiteSpace = "nowrap";
      bubbleShortLabelEl.style.overflow = "hidden";
      bubbleShortLabelEl.style.transition =
        "opacity 0.26s ease, max-width 0.26s ease, transform 0.26s ease, margin 0.26s ease";
    }

    if (bubbleFullLabelEl) {
      bubbleFullLabelEl.style.fontSize = window.innerWidth < 520 ? "12.5px" : "13.5px";
      bubbleFullLabelEl.style.fontWeight = "800";
      bubbleFullLabelEl.style.lineHeight = "1.25";
      bubbleFullLabelEl.style.whiteSpace = "normal";
      bubbleFullLabelEl.style.textAlign = "left";
      bubbleFullLabelEl.style.overflow = "hidden";
      bubbleFullLabelEl.style.transition =
        "opacity 0.28s ease, max-width 0.28s ease, transform 0.28s ease, margin 0.28s ease";
    }

    applyBubbleExpandedState(isBubbleExpanded);

    bubble.onmouseenter = function () {
      bubble.style.transform = "translateY(-2px)";
      bubble.style.borderColor = rgbaFromHex(bubbleHighlight, 0.34);
      bubble.style.boxShadow =
        "0 22px 40px " + rgbaFromHex("#000000", 0.30) + ", 0 14px 30px " + rgbaFromHex(bubbleBase, 0.28) + ", 0 0 0 1px rgba(255,255,255,0.08), 0 0 22px " + rgbaFromHex(bubbleHighlight, 0.22);
      bubble.style.filter = "brightness(1.04)";
    };

    bubble.onmouseleave = function () {
      bubble.style.transform = "translateY(0)";
      bubble.style.borderColor = borderGlow;
      bubble.style.boxShadow =
        "0 18px 34px " + shadowOuter + ", 0 10px 26px " + shadowSoft + ", 0 0 0 1px rgba(255,255,255,0.06), 0 0 18px " + shadowGlow;
      bubble.style.filter = "brightness(1)";
    };
  }

  function applyBubbleExpandedState(expanded) {
    if (!bubble) return;

    isBubbleExpanded = !!expanded;

    if (isBubbleExpanded) {
      bubble.style.padding = window.innerWidth < 520 ? "12px 16px" : "13px 18px";
      bubble.style.minWidth = window.innerWidth < 520 ? "188px" : "222px";
      bubble.style.maxWidth = window.innerWidth < 520 ? "220px" : "248px";
      bubble.style.borderRadius = "999px";

      if (bubbleShortLabelEl) {
        bubbleShortLabelEl.style.opacity = "0";
        bubbleShortLabelEl.style.maxWidth = "0px";
        bubbleShortLabelEl.style.transform = "translateX(-6px)";
        bubbleShortLabelEl.style.marginRight = "0";
        bubbleShortLabelEl.style.pointerEvents = "none";
      }

      if (bubbleFullLabelEl) {
        bubbleFullLabelEl.style.opacity = "1";
        bubbleFullLabelEl.style.maxWidth = window.innerWidth < 520 ? "150px" : "170px";
        bubbleFullLabelEl.style.transform = "translateX(0)";
        bubbleFullLabelEl.style.marginLeft = "0";
        bubbleFullLabelEl.style.pointerEvents = "auto";
      }

      if (bubbleIconEl) {
        bubbleIconEl.style.display = "inline-flex";
      }
    } else {
  bubble.style.padding = window.innerWidth < 520 ? "11px 14px" : "11px 15px";
  bubble.style.minWidth = window.innerWidth < 520 ? "104px" : "118px";
  bubble.style.maxWidth = window.innerWidth < 520 ? "128px" : "142px";
  bubble.style.borderRadius = "999px";

  if (bubbleShortLabelEl) {
    bubbleShortLabelEl.style.opacity = "1";
    bubbleShortLabelEl.style.maxWidth = "80px";
    bubbleShortLabelEl.style.transform = "translateX(0)";
    bubbleShortLabelEl.style.marginRight = "0";
    bubbleShortLabelEl.style.pointerEvents = "auto";
  }

  if (bubbleFullLabelEl) {
    bubbleFullLabelEl.style.opacity = "0";
    bubbleFullLabelEl.style.maxWidth = "0px";
    bubbleFullLabelEl.style.transform = "translateX(8px)";
    bubbleFullLabelEl.style.marginLeft = "0";
    bubbleFullLabelEl.style.pointerEvents = "none";
  }

  if (bubbleIconEl) {
    bubbleIconEl.style.display = "inline-flex";
  }
}
  }

  function updateBubbleByScroll() {
    if (!bubble || isOpen) return;

    var shouldExpand = (window.pageYOffset || document.documentElement.scrollTop || 0) > scrollExpandThreshold;
    applyBubbleExpandedState(shouldExpand);
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

    bubble.style.display = isOpen ? "none" : "inline-flex";
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
    sendPageContext();
  }

  function closePanel() {
    isOpen = false;
    applyPanelLayout();
    resetPageShrink();
    updateBubbleByScroll();
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
    bubble.innerHTML =
      '<span class="sitemind-bubble-icon">💬</span>' +
      '<span class="sitemind-bubble-short">' + bubbleShortText + '</span>' +
      '<span class="sitemind-bubble-full">' + bubbleText + '</span>';

    bubbleIconEl = bubble.querySelector(".sitemind-bubble-icon");
    bubbleShortLabelEl = bubble.querySelector(".sitemind-bubble-short");
    bubbleFullLabelEl = bubble.querySelector(".sitemind-bubble-full");

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
    updateBubbleByScroll();
    applyPanelLayout();

    bubble.addEventListener("click", togglePanel);

    iframe.addEventListener("load", function () {
      setTimeout(sendPageContext, 300);
      setTimeout(sendPageContext, 1200);
    });
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== BASE_URL && event.origin !== window.location.origin) return;
    if (!event.data || typeof event.data !== "object") return;

    if (event.data.type === "sitemind-widget-ready") {
      sendPageContext();
    }

    if (event.data.type === "sitemind-refresh-page-context") {
      sendPageContext();
    }

    if (event.data.type === "sitemind-close-widget") {
      closePanel();
    }
  });

  window.addEventListener("resize", function () {
    applyBubblePosition();
    styleBubble();
    updateBubbleByScroll();
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
  });

  window.addEventListener("scroll", function () {
    updateBubbleByScroll();
  }, { passive: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createWidget);
  } else {
    createWidget();
  }
})();
