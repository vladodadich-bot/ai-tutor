(function () {

  function initSmartLektira() {

    var BLOG_URL = "https://www.lektirko.com";
    var MAX_RESULTS = 150;
    var CALLBACK_NAME = "smartLektiraHandleData";

    var root = document.getElementById("smart-lektira-generator");
    if (!root) {
      console.log("SMART generator: root nije pronađen");
      return;
    }

    if (root.getAttribute("data-init") === "1") return;
    root.setAttribute("data-init", "1");

    var input = document.getElementById("slg-search-input");
    var output = document.getElementById("slg-output");
    var statusEl = document.getElementById("slg-status");
    var metaEl = document.getElementById("slg-meta");
    var tabsEl = document.getElementById("slg-tabs");

    var searchBtn = document.getElementById("slg-search-btn");
    var copyBtn = document.getElementById("slg-copy-btn");
    var clearBtn = document.getElementById("slg-clear-btn");

    var currentScript = null;
    var currentData = null;

    function setStatus(t) { statusEl.textContent = t || ""; }
    function setOutput(h) { output.innerHTML = h; }

    function escapeHtml(t) {
      return String(t || "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");
    }

    function normalizeText(t) {
      return String(t || "")
        .toLowerCase()
        .replace(/[čć]/g,"c")
        .replace(/[š]/g,"s")
        .replace(/[ž]/g,"z")
        .replace(/[đ]/g,"d")
        .replace(/\s+/g," ")
        .trim();
    }

    function stripHtml(html) {
      var tmp = document.createElement("div");
      tmp.innerHTML = html || "";
      return (tmp.textContent || "").trim();
    }

    function cleanupScript() {
      if (currentScript) {
        document.body.removeChild(currentScript);
        currentScript = null;
      }
    }

    function createFeedUrl() {
      return BLOG_URL +
        "/feeds/posts/default?alt=json-in-script&max-results=" +
        MAX_RESULTS +
        "&callback=" + CALLBACK_NAME +
        "&_=" + Date.now();
    }

    function extractData(post) {

      var title = post.title.$t;
      var raw = post.content?.$t || post.summary?.$t || "";
      var text = stripHtml(raw);

      var link = "#";
      if (post.link) {
        post.link.forEach(function(l){
          if (l.rel === "alternate") link = l.href;
        });
      }

      return {
        title: title,
        text: text,
        link: link
      };
    }

    function render(data) {
      setOutput(
        "<h3>" + escapeHtml(data.title) + "</h3>" +
        "<p>" + escapeHtml(data.text.substring(0, 800)) + "...</p>" +
        "<a href='" + data.link + "' target='_blank'>Otvori post</a>"
      );
    }

    function searchPost() {

      var query = normalizeText(input.value);

      if (!query) {
        setOutput("Unesi naziv djela.");
        return;
      }

      setStatus("Pretražujem...");
      setOutput("Učitavanje...");

      cleanupScript();

      currentScript = document.createElement("script");
      currentScript.src = createFeedUrl();

      currentScript.onerror = function () {
        setOutput("Greška kod učitavanja feeda.");
      };

      document.body.appendChild(currentScript);
    }

    window[CALLBACK_NAME] = function (data) {

      cleanupScript();

      var posts = data.feed.entry || [];
      var query = normalizeText(input.value);

      var found = null;

      posts.forEach(function(p){
        var t = normalizeText(p.title.$t);
        if (t.includes(query) && !found) found = p;
      });

      if (!found) {
        setOutput("Djelo nije pronađeno.");
        return;
      }

      currentData = extractData(found);

      setStatus("Pronađeno ✔");
      render(currentData);
    };

    function copyText() {
      if (!currentData) return;

      navigator.clipboard.writeText(currentData.text);
      alert("Kopirano!");
    }

    function clearAll() {
      input.value = "";
      setOutput("Ovdje će se prikazati rezultat.");
      setStatus("");
    }

    searchBtn.addEventListener("click", searchPost);
    copyBtn.addEventListener("click", copyText);
    clearBtn.addEventListener("click", clearAll);

    input.addEventListener("keydown", function(e){
      if (e.key === "Enter") searchPost();
    });

    setStatus("Generator spreman ✔");
    console.log("SMART generator radi");

  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSmartLektira);
  } else {
    initSmartLektira();
  }

})();
