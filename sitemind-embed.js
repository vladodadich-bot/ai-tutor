// ============================
// 🔥 ANALYTICS: TRACK VISIT
// ============================
function __sitemindTrackVisit(BASE_URL, agentId, getPageTitle) {
  const title = getPageTitle() || "Untitled Page";
  if (!agentId) return;

  try {
    fetch(BASE_URL + "/api/index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "track_visit",
        agent_id: agentId,
        page_url: window.location.href,
        page_title: title,
        referrer: document.referrer || ""
      })
    });
  } catch (e) {}
}

// ============================
// ⏱ TIME TRACKING
// ============================
var __sitemindVisitStart = Date.now();

function __sitemindTrackTime(BASE_URL, agentId) {
  try {
    var duration = Math.floor((Date.now() - __sitemindVisitStart) / 1000);

    navigator.sendBeacon(
      BASE_URL + "/api/index",
      JSON.stringify({
        action: "track_time",
        agent_id: agentId,
        page_url: window.location.href,
        duration: duration
      })
    );
  } catch (e) {}
}

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

  var initialVisitTracked = false;
  var lastTrackedTitle = "";
  var lastSentContextSignature = "";
  var contextRetryTimers = [];

  function cleanText(text) {
    return String(text || "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function detectPageLanguage() {
    var htmlLang = document.documentElement.getAttribute("lang") || "";
    var ogLocaleMeta = document.querySelector('meta[property="og:locale"]');
    var ogLocale = ogLocaleMeta && ogLocaleMeta.content ? ogLocaleMeta.content : "";
    var browserLang = navigator.language || navigator.userLanguage || "";

    var lang = (htmlLang || ogLocale || browserLang || "en").toLowerCase();

    if (lang.indexOf("hr") === 0 || lang.indexOf("bs") === 0 || lang.indexOf("sr") === 0) return "hr";
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
      return "Brauchst du Hilfe?<br>fragen Sie mich";
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
        if (blob.indexOf(String(words[i]).toLowerCase()) !== -1) return true;
      }
      return false;
    }

    if (hasAny([
      "api", "developer", "sdk", "documentation", "docs", "integration",
      "javascript", "typescript", "react", "code", "vercel", "supabase",
      "endpoint", "reference", "tools", "werkzeug"
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
      "course", "lesson", "lektira", "lektüre", "school", "lernen", "guide for students",
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

  function trackInitialVisitOnce() {
    if (initialVisitTracked) return;
    initialVisitTracked = true;
    lastTrackedTitle = getPageTitle();
    __sitemindTrackVisit(BASE_URL, agentId, getPageTitle);
  }

  function scheduleInitialVisitTracking() {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(trackInitialVisitOnce, 350);
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        setTimeout(trackInitialVisitOnce, 350);
      }, { once: true });
    }

    window.addEventListener("load", function () {
      if (!initialVisitTracked) {
        setTimeout(trackInitialVisitOnce, 250);
      }
    }, { once: true });
  }

  function sendPageContext(force) {
    if (!iframe || !iframe.contentWindow) return;

    var payload = getPageContextPayload();
    var signature = JSON.stringify({
      title: payload.pageTitle,
      url: payload.pageUrl,
      lang: payload.language,
      h1: payload.h1,
      desc: payload.pageDescription,
      type: payload.pageTypeHint,
      headings: payload.headings
    });

    if (!force && signature === lastSentContextSignature) return;
    lastSentContextSignature = signature;

    try {
      iframe.contentWindow.postMessage(payload, BASE_URL);
    } catch (e) {
      try {
        iframe.contentWindow.postMessage(payload, "*");
      } catch (err) {}
    }
  }

  function scheduleContextRefreshes() {
    while (contextRetryTimers.length) {
      clearTimeout(contextRetryTimers.pop());
    }

    var delays = [120, 600, 1600, 3200];

    for (var i = 0; i < delays.length; i++) {
      (function (delay) {
        var timer = setTimeout(function () {
          sendPageContext(i === delays.length - 1);
        }, delay);
        contextRetryTimers.push(timer);
      })(delays[i]);
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
  "transform 0.26s ease, box-shadow 0.26s ease, opacity 0.22s ease, border-color 0.26s ease, filter 0.26s ease, padding 0.20s ease";
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
    }

    if (bubbleFullLabelEl) {
      bubbleFullLabelEl.style.fontSize = window.innerWidth < 520 ? "12.5px" : "13.5px";
      bubbleFullLabelEl.style.fontWeight = "800";
      bubbleFullLabelEl.style.lineHeight = "1.25";
      bubbleFullLabelEl.style.whiteSpace = "normal";
      bubbleFullLabelEl.style.textAlign = "left";
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
      bubble.style.minWidth = window.innerWidth < 520 ? "166px" : "200px";
      bubble.style.maxWidth = window.innerWidth < 520 ? "198px" : "226px";
      bubble.style.borderRadius = "999px";

      if (bubbleShortLabelEl) bubbleShortLabelEl.style.display = "none";
      if (bubbleFullLabelEl) bubbleFullLabelEl.style.display = "block";
      if (bubbleIconEl) bubbleIconEl.style.display = "inline-flex";
    } else {
      bubble.style.padding = window.innerWidth < 520 ? "12px 15px" : "12px 16px";
      bubble.style.minWidth = window.innerWidth < 520 ? "86px" : "94px";
      bubble.style.maxWidth = window.innerWidth < 520 ? "110px" : "118px";
      bubble.style.borderRadius = "999px";

      if (bubbleShortLabelEl) bubbleShortLabelEl.style.display = "inline";
      if (bubbleFullLabelEl) bubbleFullLabelEl.style.display = "none";
      if (bubbleIconEl) bubbleIconEl.style.display = "inline-flex";
    }
  }

  function updateBubbleByScroll() {
    if (!bubble || isOpen) return;

    var shouldExpand = (window.pageYOffset || document.documentElement.scrollTop || 0) > scrollExpandThreshold;
    applyBubbleExpandedState(shouldExpand);
  }

  function applyPanelLayout() {
  if (!panel || !bubble || !iframe) return;

  var isNarrowMobile = window.innerWidth < 520;

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
  panel.style.transition = "transform 1.00s ease, opacity 0.60s ease, box-shadow 0.60s ease";
  panel.style.willChange = "transform, opacity";
  panel.style.display = "block";

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
      panel.style.transform = isOpen ? "translateX(0)" : "translateX(-100%)";
    } else {
      panel.style.right = "0";
      panel.style.borderLeft = "1px solid rgba(37,99,235,0.10)";
      panel.style.boxShadow = "-12px 0 36px rgba(15,23,42,0.12)";
      panel.style.transform = isOpen ? "translateX(0)" : "translateX(100%)";
    }

    panel.style.opacity = isOpen ? "1" : "0";
    panel.style.pointerEvents = isOpen ? "auto" : "none";
  } else {
    var mobileSideGap = isNarrowMobile ? 8 : 12;
    var mobileBottomGap = isOpen ? 8 : 92;

    panel.style.width = isNarrowMobile ? "calc(100vw - 16px)" : "380px";
    panel.style.maxWidth = "calc(100vw - 24px)";
    panel.style.height = isNarrowMobile ? "min(620px, calc(100vh - 16px))" : "620px";
    panel.style.maxHeight = isNarrowMobile ? "calc(100vh - 16px)" : "calc(100vh - 24px)";
    panel.style.borderRadius = "18px";
    panel.style.border = "1px solid rgba(37,99,235,0.10)";

    if (position === "bottom-left") {
      panel.style.left = mobileSideGap + "px";
      panel.style.bottom = mobileBottomGap + "px";
    } else {
      panel.style.right = mobileSideGap + "px";
      panel.style.bottom = mobileBottomGap + "px";
    }

    panel.style.transform = isOpen ? "translateY(0)" : "translateY(18px)";
    panel.style.opacity = isOpen ? "1" : "0";
    panel.style.pointerEvents = isOpen ? "auto" : "none";
  }

  bubble.style.display = isOpen ? "none" : "inline-flex";
}

  function applyPageShrink() {
    return;
  }

  function resetPageShrink() {
    return;
  }

  function openPanel() {
    isOpen = true;
    applyPanelLayout();
    applyPageShrink();
    sendPageContext(true);
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
panel.style.opacity = "0";
panel.style.pointerEvents = "none";
panel.style.transition = "none";

if (isDesktop()) {
  panel.style.transform = position === "bottom-left"
    ? "translateX(-100%)"
    : "translateX(100%)";
} else {
  panel.style.transform = "translateY(18px)";
}
    
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
    requestAnimationFrame(function () {
     panel.style.transition = "transform 1.00s ease, opacity 0.60s ease, box-shadow 0.60s ease";
});
    bubble.addEventListener("click", togglePanel);

    iframe.addEventListener("load", function () {
      sendPageContext(true);
      scheduleContextRefreshes();
    });
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== BASE_URL && event.origin !== window.location.origin) return;
    if (!event.data || typeof event.data !== "object") return;

    if (event.data.type === "sitemind-widget-ready") {
      sendPageContext(true);
      scheduleContextRefreshes();
    }

    if (event.data.type === "sitemind-refresh-page-context") {
      sendPageContext(true);
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

    sendPageContext(true);
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () {
      if (!panel) return;
      applyPanelLayout();
    });

    window.visualViewport.addEventListener("scroll", function () {
      if (!panel) return;
      applyPanelLayout();
    });
  }

  window.addEventListener("scroll", function () {
    updateBubbleByScroll();
  }, { passive: true });

  window.addEventListener("load", function () {
    sendPageContext(true);
    scheduleContextRefreshes();
  });

  window.addEventListener("pageshow", function () {
    sendPageContext(true);
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      sendPageContext(true);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createWidget);
  } else {
    createWidget();
  }

  scheduleInitialVisitTracking();

  window.addEventListener("beforeunload", function () {
    __sitemindTrackTime(BASE_URL, agentId);
  });
})();
