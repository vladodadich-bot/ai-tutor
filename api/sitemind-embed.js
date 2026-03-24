(function () {
  if (window.SiteMindWidgetLoaded) return;
  window.SiteMindWidgetLoaded = true;

  var config = window.SiteMindConfig || {};
  var agentId = config.agentId || "demo-agent";
  var apiBase = config.apiBase || "https://tvoj-api.vercel.app";
  var position = config.position || "right";

  var iframe = document.createElement("iframe");
  iframe.src =
    apiBase.replace(/\/$/, "") +
    "/widget-frame.html?agentId=" +
    encodeURIComponent(agentId);

  iframe.id = "sitemindai-widget-frame";
  iframe.title = "SiteMind AI Chat";
  iframe.style.position = "fixed";
  iframe.style.bottom = "24px";
  iframe.style.width = "380px";
  iframe.style.height = "640px";
  iframe.style.border = "0";
  iframe.style.borderRadius = "20px";
  iframe.style.boxShadow = "0 20px 60px rgba(0,0,0,0.22)";
  iframe.style.background = "transparent";
  iframe.style.zIndex = "999999";
  iframe.style.display = "none";

  if (position === "left") {
    iframe.style.left = "24px";
  } else {
    iframe.style.right = "24px";
  }

  var button = document.createElement("button");
  button.id = "sitemindai-widget-button";
  button.setAttribute("aria-label", "Open chat");
  button.innerHTML = "💬";
  button.style.position = "fixed";
  button.style.bottom = "24px";
  button.style.width = "64px";
  button.style.height = "64px";
  button.style.border = "0";
  button.style.borderRadius = "999px";
  button.style.cursor = "pointer";
  button.style.zIndex = "999999";
  button.style.boxShadow = "0 12px 30px rgba(0,0,0,0.18)";
  button.style.background = "linear-gradient(135deg, #0f172a, #2563eb)";
  button.style.color = "#fff";
  button.style.fontSize = "28px";

  if (position === "left") {
    button.style.left = "24px";
  } else {
    button.style.right = "24px";
  }

  button.addEventListener("click", function () {
    var isOpen = iframe.style.display === "block";
    iframe.style.display = isOpen ? "none" : "block";
    button.innerHTML = isOpen ? "💬" : "✕";
  });

  window.addEventListener("message", function (event) {
    if (!event.data) return;

    if (event.data.type === "SITEMIND_CLOSE_WIDGET") {
      iframe.style.display = "none";
      button.innerHTML = "💬";
    }
  });

  document.body.appendChild(iframe);
  document.body.appendChild(button);

  function setMobileStyles() {
    var isMobile = window.innerWidth < 520;
    if (isMobile) {
      iframe.style.width = "calc(100vw - 20px)";
      iframe.style.height = "calc(100vh - 100px)";
      iframe.style.left = "10px";
      iframe.style.right = "10px";
      iframe.style.bottom = "80px";
    } else {
      iframe.style.width = "380px";
      iframe.style.height = "640px";
      iframe.style.bottom = "24px";
      if (position === "left") {
        iframe.style.left = "24px";
        iframe.style.right = "auto";
      } else {
        iframe.style.right = "24px";
        iframe.style.left = "auto";
      }
    }
  }

  setMobileStyles();
  window.addEventListener("resize", setMobileStyles);
})();
