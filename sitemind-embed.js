(function () {
  if (window.SiteMindWidgetLoaded) return;
  window.SiteMindWidgetLoaded = true;

  var config = window.SiteMindConfig || {};
  var agentId = config.agentId || "demo-agent";
  var baseUrl = "https://ai-tutor-rouge-theta.vercel.app";

  var isOpen = false;

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

  window.addEventListener("resize", applyMobileStyles);

  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(button);
    document.body.appendChild(iframe);
    applyMobileStyles();
  });

  if (document.body) {
    document.body.appendChild(button);
    document.body.appendChild(iframe);
    applyMobileStyles();
  }
})();
