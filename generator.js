(function () {
  var BLOG_URL = "https://www.lektirko.com";
  var MAX_RESULTS = 150;
  var CALLBACK_NAME = "smartLektiraHandleData";

  var root = document.getElementById("smart-lektira-generator");
  if (!root) return;

  var input = document.getElementById("slg-search-input");
  var output = document.getElementById("slg-output");
  var statusEl = document.getElementById("slg-status");
  var metaEl = document.getElementById("slg-meta");
  var tabsEl = document.getElementById("slg-tabs");

  var searchBtn = document.getElementById("slg-search-btn");
  var copyBtn = document.getElementById("slg-copy-btn");
  var clearBtn = document.getElementById("slg-clear-btn");
  var summaryBtn = document.getElementById("slg-show-summary");
  var faqBtn = document.getElementById("slg-show-faq");
  var charactersBtn = document.getElementById("slg-show-characters");

  var currentScript = null;
  var currentData = null;

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || "";
  }

  function setOutput(html) {
    if (output) output.innerHTML = html;
  }

  function setMeta(items) {
    if (!metaEl) return;
    if (!items || !items.length) {
      metaEl.innerHTML = "";
      return;
    }

    metaEl.innerHTML = items.map(function (item) {
      return "<span class='slg-chip'>" + escapeHtml(item) + "</span>";
    }).join("");
  }

  function normalizeText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[čć]/g, "c")
      .replace(/[š]/g, "s")
      .replace(/[ž]/g, "z")
      .replace(/[đ]/g, "d")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function stripHtml(html) {
    var temp = document.createElement("div");
    temp.innerHTML = html || "";
    return (temp.textContent || temp.innerText || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+\n/g, "\n\n")
      .replace(/\r/g, "")
      .trim();
  }

  function cleanupScript() {
    if (currentScript && currentScript.parentNode) {
      currentScript.parentNode.removeChild(currentScript);
      currentScript = null;
    }
  }

  function createFeedUrl() {
    return BLOG_URL +
      "/feeds/posts/default?alt=json-in-script&start-index=1&max-results=" +
      MAX_RESULTS +
      "&callback=" + CALLBACK_NAME +
      "&_=" + Date.now();
  }

  function splitIntoSentences(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .filter(function (s) {
        return s && s.trim().length > 20;
      });
  }

  function firstUsefulParagraph(text, maxSentences) {
    return splitIntoSentences(text).slice(0, maxSentences || 4).join(" ").trim();
  }

  function parseSectionsFromHtml(rawHtml) {
    var container = document.createElement("div");
    container.innerHTML = rawHtml || "";

    var allNodes = container.querySelectorAll("h1,h2,h3,h4,h5,h6,p,div,li");
    var sections = [];
    var current = null;

    function pushCurrent() {
      if (current && current.content.join(" ").trim()) {
        sections.push({
          title: current.title,
          content: current.content.join("\n").trim()
        });
      }
    }

    for (var i = 0; i < allNodes.length; i++) {
      var el = allNodes[i];
      var tag = el.tagName.toLowerCase();
      var text = (el.textContent || "").replace(/\s+/g, " ").trim();

      if (!text) continue;

      if (/^h[1-6]$/.test(tag)) {
        pushCurrent();
        current = { title: text, content: [] };
      } else {
        if (!current) current = { title: "Uvod", content: [] };
        current.content.push(text);
      }
    }

    pushCurrent();
    return sections;
  }

  function findSection(sections, keywords) {
    for (var i = 0; i < sections.length; i++) {
      var titleNorm = normalizeText(sections[i].title);
      for (var j = 0; j < keywords.length; j++) {
        if (titleNorm.indexOf(normalizeText(keywords[j])) !== -1) {
          return sections[i].content;
        }
      }
    }
    return "";
  }

  function extractLikovi(text) {
    if (!text) return [];

    var lines = text.split(/\n+/).map(function (line) {
      return line.trim();
    }).filter(Boolean);

    var items = [];
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].length < 3) continue;
      items.push(lines[i]);
      if (items.length >= 8) break;
    }

    if (!items.length) {
      items = splitIntoSentences(text).slice(0, 5);
    }

    return items;
  }

  function generateFaq(text, title) {
    if (text && text.length > 300) {
      return [
        "Tko su najvažniji likovi u djelu " + title + "?",
        "Kako se razvija radnja u djelu " + title + "?",
        "Koja je tema i ideja djela " + title + "?",
        "Što ovo djelo poručuje čitatelju?",
        "Po čemu je djelo " + title + " posebno?"
      ];
    }

    return [
      "Tko je glavni lik u djelu " + title + "?",
      "Koja je glavna tema djela " + title + "?",
      "Koja je ideja ili poruka djela " + title + "?",
      "Koji se važni događaji ističu u djelu " + title + "?",
      "Zašto je ovo djelo zanimljivo za čitanje?"
    ];
  }

  function generateOpinion(title) {
    return "Moje mišljenje o djelu " + title + " je pozitivno jer je sadržaj zanimljiv, jasan i potiče razmišljanje. Djelo ostavlja dobar dojam, a posebno je vrijedno zbog poruka koje prenosi čitatelju.";
  }

  function extractData(post) {
    var title = post && post.title && post.title.$t ? post.title.$t : "Nepoznato djelo";

    var rawHtml = "";
    if (post.content && post.content.$t) rawHtml = post.content.$t;
    else if (post.summary && post.summary.$t) rawHtml = post.summary.$t;

    var cleanText = stripHtml(rawHtml);
    var sections = parseSectionsFromHtml(rawHtml);

    var summary = findSection(sections, [
      "kratki sadržaj",
      "kratak sadržaj",
      "sadrzaj",
      "sažetak",
      "sazetak",
      "kurze zusammenfassung",
      "inhaltsangabe"
    ]);

    if (!summary) summary = firstUsefulParagraph(cleanText, 5);

    var theme = findSection(sections, [
      "tema",
      "tema djela",
      "themen",
      "themen und motive"
    ]);

    var idea = findSection(sections, [
      "ideja",
      "poruka",
      "ideja djela",
      "interpretation"
    ]);

    var characters = findSection(sections, [
      "likovi",
      "opis likova",
      "glavni likovi",
      "figuren",
      "charakterisierung"
    ]);

    var faq = findSection(sections, [
      "faq",
      "pitanja i odgovori",
      "česta pitanja",
      "cesta pitanja"
    ]);

    var opinion = findSection(sections, [
      "moje mišljenje",
      "moje misljenje",
      "mišljenje o djelu",
      "misljenje o djelu",
      "fazit"
    ]);

    var link = "#";
    if (post.link && post.link.length) {
      for (var i = 0; i < post.link.length; i++) {
        if (post.link[i].rel === "alternate") {
          link = post.link[i].href;
          break;
        }
      }
    }

    return {
      title: title,
      link: link,
      cleanText: cleanText,
      summary: summary || "",
      theme: theme || "",
      idea: idea || "",
      characters: characters ? extractLikovi(characters) : [],
      faq: faq ? faq.split(/\n+/).filter(Boolean).slice(0, 7) : generateFaq(cleanText, title),
      opinion: opinion || generateOpinion(title)
    };
  }

  function paragraphBlock(label, text) {
    if (!text) return "";
    return "<h4>" + escapeHtml(label) + "</h4><p>" + escapeHtml(text) + "</p>";
  }

  function listBlock(label, items) {
    if (!items || !items.length) return "";
    var out = "<h4>" + escapeHtml(label) + "</h4><ul>";
    for (var i = 0; i < items.length; i++) {
      out += "<li>" + escapeHtml(items[i]) + "</li>";
    }
    out += "</ul>";
    return out;
  }

  function renderTab(tab) {
    if (!currentData) {
      setOutput("Ovdje će se prikazati rezultat.");
      return;
    }

    var tabButtons = tabsEl ? tabsEl.querySelectorAll(".slg-tab") : [];
    for (var i = 0; i < tabButtons.length; i++) {
      tabButtons[i].classList.remove("active");
      if (tabButtons[i].getAttribute("data-tab") === tab) {
        tabButtons[i].classList.add("active");
      }
    }

    var d = currentData;
    var html = "<h3>" + escapeHtml(d.title) + "</h3>";

    if (tab === "summary") {
      html += paragraphBlock("Kratki sadržaj", d.summary || firstUsefulParagraph(d.cleanText, 4));
    } else if (tab === "theme") {
      html += paragraphBlock("Tema", d.theme || "Tema djela odnosi se na glavne događaje, odnose među likovima i središnji problem priče.");
      html += paragraphBlock("Ideja", d.idea || "Ideja djela naglašava poruku koju čitatelj može izvući iz događaja i ponašanja likova.");
    } else if (tab === "characters") {
      html += listBlock("Likovi", d.characters.length ? d.characters : ["Likovi nisu posebno izdvojeni u tekstu."]);
    } else if (tab === "faq") {
      html += listBlock("FAQ pitanja", d.faq);
    } else if (tab === "opinion") {
      html += paragraphBlock("Moje mišljenje", d.opinion);
    } else {
      html += paragraphBlock("Kratki sadržaj", d.summary || firstUsefulParagraph(d.cleanText, 4));
      html += paragraphBlock("Tema", d.theme || "Tema djela odnosi se na glavne događaje, odnose među likovima i središnji problem priče.");
      html += paragraphBlock("Ideja", d.idea || "Ideja djela naglašava poruku koju čitatelj može izvući iz događaja i ponašanja likova.");
      html += listBlock("Likovi", d.characters.length ? d.characters : ["Likovi nisu posebno izdvojeni u tekstu."]);
      html += listBlock("FAQ pitanja", d.faq);
      html += paragraphBlock("Moje mišljenje", d.opinion);
    }

    if (d.link && d.link !== "#") {
      html += "<a class='slg-link' href='" + d.link + "' target='_blank' rel='noopener noreferrer'>Otvori originalni post</a>";
    }

    setOutput(html);
  }

  function searchPost() {
    var query = normalizeText(input ? input.value : "");

    if (!query) {
      currentData = null;
      if (tabsEl) tabsEl.style.display = "none";
      setStatus("");
      setMeta([]);
      setOutput("Unesi naziv djela.");
      return;
    }

    setStatus("Pretražujem blog...");
    setMeta(["Učitavanje feeda"]);
    if (tabsEl) tabsEl.style.display = "none";
    setOutput("Učitavanje podataka...");

    cleanupScript();

    currentScript = document.createElement("script");
    currentScript.src = createFeedUrl();
    currentScript.async = true;

    currentScript.onerror = function () {
      setStatus("");
      setMeta([]);
      setOutput("Dogodila se greška pri učitavanju Blogger feeda.");
    };

    document.body.appendChild(currentScript);
  }

  window[CALLBACK_NAME] = function (data) {
    cleanupScript();

    try {
      var query = normalizeText(input ? input.value : "");
      var posts = data && data.feed && data.feed.entry ? data.feed.entry : [];

      if (!posts.length) {
        setStatus("");
        setMeta([]);
        if (tabsEl) tabsEl.style.display = "none";
        setOutput("Feed je učitan, ali nema dostupnih postova.");
        return;
      }

      var bestPost = null;
      var bestScore = -1;

      for (var i = 0; i < posts.length; i++) {
        var post = posts[i];
        var title = post && post.title && post.title.$t ? post.title.$t : "";
        var titleNorm = normalizeText(title);
        var score = 0;

        if (titleNorm === query) score += 100;
        if (titleNorm.indexOf(query) !== -1) score += 50;

        query.split(" ").forEach(function (word) {
          if (word && titleNorm.indexOf(word) !== -1) score += 10;
        });

        if (score > bestScore) {
          bestScore = score;
          bestPost = post;
        }
      }

      if (!bestPost || bestScore < 10) {
        setStatus("");
        setMeta([]);
        if (tabsEl) tabsEl.style.display = "none";
        setOutput("Djelo nije pronađeno u feedu.");
        return;
      }

      currentData = extractData(bestPost);

      setStatus("Post je pronađen i obrađen.");
      setMeta([
        "Domena: " + BLOG_URL,
        "Djelo: " + currentData.title,
        "Spremno za kopiranje"
      ]);

      if (tabsEl) tabsEl.style.display = "flex";
      renderTab("full");
    } catch (err) {
      setStatus("");
      setMeta([]);
      if (tabsEl) tabsEl.style.display = "none";
      setOutput("Feed je učitan, ali je došlo do greške pri obradi podataka.");
    }
  };

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();

    try {
      document.execCommand("copy");
      alert("Tekst kopiran!");
    } catch (e) {
      alert("Kopiranje nije uspjelo.");
    }

    document.body.removeChild(ta);
  }

  function copyCurrent() {
    var text = output ? (output.innerText || output.textContent || "") : "";
    if (!text.trim()) {
      alert("Nema teksta za kopiranje.");
      return;
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        alert("Tekst kopiran!");
      }).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function clearAll() {
    if (input) input.value = "";
    currentData = null;
    setStatus("");
    setMeta([]);
    if (tabsEl) tabsEl.style.display = "none";
    setOutput("Ovdje će se prikazati rezultat.");
  }

  if (searchBtn) searchBtn.addEventListener("click", searchPost);
  if (copyBtn) copyBtn.addEventListener("click", copyCurrent);
  if (clearBtn) clearBtn.addEventListener("click", clearAll);

  if (summaryBtn) {
    summaryBtn.addEventListener("click", function () {
      if (currentData) renderTab("summary");
      else setOutput("Prvo pronađi neko djelo.");
    });
  }

  if (faqBtn) {
    faqBtn.addEventListener("click", function () {
      if (currentData) renderTab("faq");
      else setOutput("Prvo pronađi neko djelo.");
    });
  }

  if (charactersBtn) {
    charactersBtn.addEventListener("click", function () {
      if (currentData) renderTab("characters");
      else setOutput("Prvo pronađi neko djelo.");
    });
  }

  if (tabsEl) {
    tabsEl.addEventListener("click", function (e) {
      var btn = e.target.closest(".slg-tab");
      if (!btn || !currentData) return;
      renderTab(btn.getAttribute("data-tab"));
    });
  }

  if (input) {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") searchPost();
    });
  }
})();
