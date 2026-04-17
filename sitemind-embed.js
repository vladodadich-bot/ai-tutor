// ============================
// 🔥 ANALYTICS FUNKCIJE
// ============================
var __sitemindVisitStart = Date.now();

function __sitemindTrackVisit(BASE_URL, agentId, getPageTitle) {
  try {
    fetch(BASE_URL + "/api/index", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "track_visit",
        agent_id: agentId,
        page_url: window.location.href,
        page_title: getPageTitle(),
        referrer: document.referrer || null
      })
    });
  } catch (e) {}
}

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

// ============================
// 🚀 GLAVNI WIDGET
// ============================
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

  // 🔥 TRACK VISIT (ODMAH)
  __sitemindTrackVisit(BASE_URL, agentId, getPageTitle);

  function togglePanel() {
    if (isOpen) {
      panel.style.display = "none";
      bubble.style.display = "block";
      isOpen = false;
    } else {
      panel.style.display = "block";
      bubble.style.display = "none";
      isOpen = true;
    }
  }

  function createWidget() {
    if (document.getElementById("sitemind-widget-root")) return;

    var root = document.createElement("div");
    root.id = "sitemind-widget-root";
    document.body.appendChild(root);

    bubble = document.createElement("button");
    bubble.innerText = "💬 Chat";
    bubble.style.position = "fixed";
    bubble.style.bottom = "20px";
    bubble.style.right = "20px";
    bubble.style.zIndex = "999999";
    bubble.style.padding = "12px 16px";
    bubble.style.background = themeColor;
    bubble.style.color = "#fff";
    bubble.style.border = "none";
    bubble.style.borderRadius = "999px";
    bubble.style.cursor = "pointer";

    panel = document.createElement("div");
    panel.style.position = "fixed";
    panel.style.bottom = "80px";
    panel.style.right = "20px";
    panel.style.width = "380px";
    panel.style.height = "600px";
    panel.style.background = "#fff";
    panel.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";
    panel.style.display = "none";
    panel.style.zIndex = "999999";

    iframe = document.createElement("iframe");
    iframe.src =
      BASE_URL +
      "/widget-frame.html?agentId=" +
      encodeURIComponent(agentId);

    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";

    panel.appendChild(iframe);
    root.appendChild(panel);
    root.appendChild(bubble);

    bubble.addEventListener("click", togglePanel);
  }

  window.addEventListener("beforeunload", function () {
    __sitemindTrackTime(BASE_URL, agentId);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createWidget);
  } else {
    createWidget();
  }
})();
