(function () {
  if (window.SiteMindAIInitialized) return;
  window.SiteMindAIInitialized = true;

  var currentScript = document.currentScript;
  var agentId =
    (currentScript && currentScript.getAttribute("data-agent-id")) ||
    "demo-agent";

  var apiBase =
    (currentScript && currentScript.getAttribute("data-api-base")) ||
    window.location.origin;

  function getMetaDescription() {
    var meta =
      document.querySelector('meta[name="description"]') ||
      document.querySelector('meta[property="og:description"]');
    return meta ? meta.getAttribute("content") || "" : "";
  }

  function cleanText(text) {
    return (text || "")
      .replace(/\s+/g, " ")
      .replace(/\n+/g, " ")
      .trim();
  }

  function getMainText() {
    var selectors = [
      "main",
      "article",
      "[role='main']",
      ".content",
      ".page-content",
      ".post-body",
      ".entry-content",
      ".product-description",
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

    // skrati da ne šalješ previše tokena
    return bestText.slice(0, 6000);
  }

  function getPageContext() {
    return {
      pageUrl: window.location.href,
      pageTitle: document.title || "",
      pageDescription: getMetaDescription(),
      pageText: getMainText(),
      lang:
        document.documentElement.lang ||
        navigator.language ||
        "hr"
    };
  }

  var bubble = document.createElement("button");
  bubble.type = "button";
  bubble.innerHTML = "💬";
  bubble.setAttribute("aria-label", "Open chat");

  bubble.style.position = "fixed";
  bubble.style.right = "20px";
  bubble.style.bottom = "20px";
  bubble.style.width = "60px";
  bubble.style.height = "60px";
  bubble.style.borderRadius = "999px";
  bubble.style.border = "none";
  bubble.style.cursor = "pointer";
  bubble.style.background = "#0f172a";
  bubble.style.color = "#fff";
  bubble.style.fontSize = "24px";
  bubble.style.boxShadow = "0 10px 30px rgba(0,0,0,0.18)";
  bubble.style.zIndex = "999999";

  var panel = document.createElement("div");
  panel.style.position = "fixed";
  panel.style.right = "20px";
  panel.style.bottom = "90px";
  panel.style.width = "380px";
  panel.style.maxWidth = "calc(100vw - 24px)";
  panel.style.height = "620px";
  panel.style.maxHeight = "calc(100vh - 120px)";
  panel.style.background = "#fff";
  panel.style.borderRadius = "18px";
  panel.style.overflow = "hidden";
  panel.style.boxShadow = "0 20px 60px rgba(0,0,0,0.2)";
  panel.style.zIndex = "999998";
  panel.style.display = "none";

  var iframe = document.createElement("iframe");
  iframe.src =
    apiBase.replace(/\/$/, "") +
    "/widget-frame.html?agentId=" +
    encodeURIComponent(agentId) +
    "&apiBase=" +
    encodeURIComponent(apiBase.replace(/\/$/, ""));
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.setAttribute("title", "SiteMind AI Chat");

  panel.appendChild(iframe);
  document.body.appendChild(panel);
  document.body.appendChild(bubble);

  var isOpen = false;

  function sendContextToIframe() {
    var pageContext = getPageContext();
    iframe.contentWindow.postMessage(
      {
        type: "sitemind_page_context",
        payload: pageContext
      },
      "*"
    );
  }

  bubble.addEventListener("click", function () {
    isOpen = !isOpen;
    panel.style.display = isOpen ? "block" : "none";

    if (isOpen) {
      setTimeout(sendContextToIframe, 300);
    }
  });

  iframe.addEventListener("load", function () {
    sendContextToIframe();
  });
})();
