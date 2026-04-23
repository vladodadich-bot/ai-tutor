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

  var initialVisitTracked = false;
  var lastTrackedTitle = "";
  var lastSentContextSignature = "";
  var contextRetryTimers = [];
  var contextObserver = null;
  var delayedRefreshTimer = null;

  function cleanText(text) {
    return String(text || "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function safeSlice(text, maxLength) {
    var value = String(text || "");
    if (!maxLength || value.length <= maxLength) return value;
    return value.slice(0, maxLength);
  }

  function getCanonicalUrl() {
    var canonical = document.querySelector('link[rel="canonical"]');
    var href = canonical && canonical.href ? cleanText(canonical.href) : "";
    return href || window.location.href;
  }

  function isProbablyVisible(node) {
    if (!node || node.nodeType !== 1) return false;

    if (node.hasAttribute("hidden") || node.getAttribute("aria-hidden") === "true") {
      return false;
    }

    var style;
    try {
      style = window.getComputedStyle(node);
    } catch (e) {
      style = null;
    }

    if (style) {
      if (style.display === "none" || style.visibility === "hidden") return false;
    }

    return true;
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
      return "Trebaš pomoć?<br>Pitaj me";
    }

    if (lang === "de") {
      return "Brauchst du Hilfe?<br>frag mich";
    }

    if (lang === "it") {
      return "Hai bisogno di aiuto?<br>chiedi a me";
    }

    if (lang === "fr") {
      return "Besoin d’aide ?<br>demandez-moi";
    }

    return "You need help?<br>Ask me";
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

  function getPrimaryH1(root) {
    var targetRoot = root || document;
    var h1 = targetRoot.querySelector("h1");
    return h1 && h1.textContent ? cleanText(h1.textContent) : "";
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

  function getCleanupSelectors() {
    return [
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
      "header nav",
      "aside",
      ".sidebar",
      ".menu",
      ".nav",
      ".comments",
      "#comments",
      ".related-posts",
      ".related",
      ".share-buttons",
      ".social-share",
      ".advertisement",
      ".adsbygoogle",
      ".cookie-banner",
      ".cookie-consent",
      ".newsletter",
      ".popup",
      ".modal",
      ".breadcrumbs",
      ".breadcrumb",
      ".pagination",
      ".post-nav",
      ".author-box",
      ".widget",
      ".widgets",
      ".recommended",
      ".recommendations",
      ".toc",
      ".table-of-contents",
      ".chat-widget",
      "#sitemind-widget-root"
    ];
  }

  function getElementText(el) {
    if (!el) return "";
    return cleanText(el.innerText || el.textContent || "");
  }

  function scoreContentRoot(el) {
    if (!el || !isProbablyVisible(el)) return -999999;

    var text = getElementText(el);
    if (!text || text.length < 120) return -999999;

    var score = 0;
    var className = String(el.className || "").toLowerCase();
    var id = String(el.id || "").toLowerCase();
    var tag = String(el.tagName || "").toLowerCase();
    var hint = tag + " " + className + " " + id;

    if (tag === "article") score += 180;
    if (tag === "main") score += 160;
    if (el.getAttribute("role") === "main") score += 150;

    if (/(post|entry|article|content|main|page-body|post-body|entry-content|article-body|blog-post)/.test(hint)) score += 120;
    if (/(sidebar|footer|header|nav|menu|comment|related|share|widget|popup|modal)/.test(hint)) score -= 220;

    score += Math.min(text.length, 6000) / 18;

    var headings = el.querySelectorAll("h1, h2, h3").length;
    score += Math.min(headings * 18, 90);

    var paragraphs = el.querySelectorAll("p").length;
    score += Math.min(paragraphs * 10, 80);

    var links = el.querySelectorAll("a").length;
    if (links > 0) {
      var linkPenalty = Math.min(links * 2, 80);
      score -= linkPenalty;
    }

    var textLength = text.length || 1;
    var linkDensity = links / Math.max(1, textLength / 120);
    if (linkDensity > 6) score -= 140;
    if (linkDensity > 10) score -= 180;

    return score;
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
      ".page-content",
      ".entry",
      ".post-outer",
      ".post-inner"
    ];

    var bestEl = null;
    var bestScore = -999999;
    var seen = [];

    for (var i = 0; i < selectors.length; i++) {
      var candidates = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < candidates.length; j++) {
        var candidate = candidates[j];
        if (seen.indexOf(candidate) !== -1) continue;
        seen.push(candidate);

        var score = scoreContentRoot(candidate);
        if (score > bestScore) {
          bestScore = score;
          bestEl = candidate;
        }
      }
    }

    if (!bestEl) {
      var bodyChildren = document.body ? document.body.children : [];
      for (var k = 0; k < bodyChildren.length; k++) {
        var child = bodyChildren[k];
        var childScore = scoreContentRoot(child);
        if (childScore > bestScore) {
          bestScore = childScore;
          bestEl = child;
        }
      }
    }

    return bestEl || document.body;
  }

  function getCleanRootClone(root) {
    if (!root) return null;
    var clone = root.cloneNode(true);
    removeNodes(clone, getCleanupSelectors());
    return clone;
  }

  function getPageH1() {
    var root = getBestContentRoot();
    var h1 = getPrimaryH1(root);
    if (h1) return h1;
    return getPrimaryH1(document);
  }

  function getHeadingsText(root) {
    var sourceRoot = root || getBestContentRoot();
    if (!sourceRoot) return [];

    var clone = getCleanRootClone(sourceRoot);
    if (!clone) return [];

    var headings = [];
    var nodes = clone.querySelectorAll("h1, h2, h3");

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var tag = String(node.tagName || "").toLowerCase();
      var text = cleanText(node.innerText || node.textContent || "");
      if (!text) continue;
      if (text.length < 2) continue;
      if (text.length > 180) continue;
      if (headings.indexOf(text) !== -1) continue;
      if (/^(komentari|related posts|povezani članci|share|podijeli|newsletter|cookie)/i.test(text)) continue;

      headings.push(text);
      if (tag === "h2" && headings.length >= 10) break;
      if (headings.length >= 12) break;
    }

    return headings;
  }

  function getMainContentText() {
    var root = getBestContentRoot();
    if (!root) return "";

    var clone = getCleanRootClone(root);
    var text = clone ? cleanText(clone.innerText || clone.textContent || "") : "";

    if (!text || text.length < 200) {
      var bodyClone = getCleanRootClone(document.body);
      text = bodyClone ? cleanText(bodyClone.innerText || bodyClone.textContent || "") : text;
    }

    if (text.length > 9000) {
      text = text.slice(0, 9000);
    }

    return text;
  }

  function getPageTypeHint(pageData) {
    var data = pageData || {};
    var url = String(data.pageUrl || window.location.href || "").toLowerCase();
    var title = String(data.pageTitle || getPageTitle() || "").toLowerCase();
    var desc = String(data.pageDescription || getPageDescription() || "").toLowerCase();
    var h1 = String(data.h1 || getPageH1() || "").toLowerCase();
    var headings = String((data.headings || []).join(" ") || "").toLowerCase();
    var text = String(data.pageText || getMainContentText() || "").slice(0, 3500).toLowerCase();

    var blob = [url, title, desc, h1, headings, text].join(" ");

    function hasAny(words) {
      for (var i = 0; i < words.length; i++) {
        if (blob.indexOf(String(words[i]).toLowerCase()) !== -1) return true;
      }
      return false;
    }

    if (hasAny([
      "lektira", "lektüre", "roman", "pjesma", "likovi", "kratki sadržaj", "kratak sadržaj",
      "analiza djela", "tema i ideja", "redoslijed događaja", "učenik", "škola", "student",
      "study", "learning", "education", "summary", "figuren", "inhaltsangabe", "interpretation"
    ])) {
      return "education";
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
      "api", "developer", "sdk", "documentation", "docs", "integration",
      "javascript", "typescript", "react", "code", "vercel", "supabase",
      "endpoint", "reference"
    ])) {
      return "technical";
    }

    if (hasAny([
      "movie", "music", "game", "show", "entertainment"
    ])) {
      return "entertainment";
    }

    return "general";
  }

  function hashSignature(value) {
    var str = String(value || "");
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  }

  function getPageContextPayload() {
    var root = getBestContentRoot();
    var pageText = getMainContentText();
    var pageTitle = getPageTitle();
    var pageDescription = getPageDescription();
    var pageUrl = window.location.href;
    var canonicalUrl = getCanonicalUrl();
    var h1 = getPageH1();
    var headings = getHeadingsText(root);

    var payload = {
      type: "sitemind-page-context",
      agentId: agentId,
      language: detectPageLanguage(),
      pageTitle: pageTitle,
      pageDescription: pageDescription,
      pageUrl: pageUrl,
      canonicalUrl: canonicalUrl,
      h1: h1,
      headings: headings,
      pageContext: pageText,
      pageText: pageText,
      pageTextPreview: safeSlice(pageText, 2500),
      pageTextLength: pageText.length,
      pageContextReady: pageText.length >= 180
    };

    payload.pageTypeHint = getPageTypeHint(payload);
    return payload;
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
      canonicalUrl: payload.canonicalUrl,
      lang: payload.language,
      h1: payload.h1,
      desc: payload.pageDescription,
      type: payload.pageTypeHint,
      headings: payload.headings,
      textLength: payload.pageTextLength,
      textHash: hashSignature(payload.pageTextPreview)
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

    var delays = [120, 600, 1600, 3200, 5200];

    for (var i = 0; i < delays.length; i++) {
      (function (delay, isLast) {
        var timer = setTimeout(function () {
          sendPageContext(!!isLast);
        }, delay);
        contextRetryTimers.push(timer);
      })(delays[i], i === delays.length - 1);
    }
  }

  function queueContextRefresh() {
    if (delayedRefreshTimer) {
      clearTimeout(delayedRefreshTimer);
    }

    delayedRefreshTimer = setTimeout(function () {
      delayedRefreshTimer = null;
      sendPageContext(false);
    }, 250);
  }

  function watchPageChanges() {
    if (contextObserver || !window.MutationObserver || !document.body) return;

    contextObserver = new MutationObserver(function (mutations) {
      var shouldRefresh = false;

      for (var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];
        if (mutation.type === "characterData") {
          shouldRefresh = true;
          break;
        }

        if (mutation.type === "attributes") {
          var target = mutation.target;
          if (target === document.documentElement || target === document.body || target === document.querySelector("title")) {
            shouldRefresh = true;
            break;
          }
        }

        if (mutation.addedNodes && mutation.addedNodes.length) {
          shouldRefresh = true;
          break;
        }
      }

      if (shouldRefresh) {
        queueContextRefresh();
      }
    });

    contextObserver.observe(document.documentElement || document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["content", "class", "id", "lang"]
    });
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
    document.addEventListener("DOMContentLoaded", function () {
      createWidget();
      watchPageChanges();
    });
  } else {
    createWidget();
    watchPageChanges();
  }

  scheduleInitialVisitTracking();

  window.addEventListener("beforeunload", function () {
    __sitemindTrackTime(BASE_URL, agentId);
  });
})();
