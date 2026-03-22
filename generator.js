<div id="smart-lektira-generator">
  <style>
    #smart-lektira-generator{
      font-family: Arial, sans-serif;
      max-width: 950px;
      margin: 20px auto;
      background: linear-gradient(135deg,#4e73df,#1cc88a);
      padding: 16px;
      border-radius: 20px;
      box-sizing: border-box;
    }

    #smart-lektira-generator *{
      box-sizing: border-box;
    }

    #smart-lektira-generator .slg-card{
      background: #fff;
      border-radius: 18px;
      padding: 22px;
      box-shadow: 0 14px 35px rgba(0,0,0,0.16);
    }

    #smart-lektira-generator .slg-head{
      text-align: center;
      margin-bottom: 18px;
    }

    #smart-lektira-generator .slg-badge{
      display: inline-block;
      background: #eef3ff;
      color: #2e59d9;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 10px;
      border-radius: 999px;
      margin-bottom: 10px;
    }

    #smart-lektira-generator h2{
      margin: 0 0 8px;
      font-size: 30px;
      line-height: 1.2;
      color: #1f2430;
    }

    #smart-lektira-generator .slg-sub{
      margin: 0;
      color: #666;
      font-size: 14px;
      line-height: 1.5;
    }

    #smart-lektira-generator .slg-search{
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 10px;
      margin: 18px 0 12px;
    }

    #smart-lektira-generator input,
    #smart-lektira-generator select{
      width: 100%;
      padding: 12px 14px;
      border: 1px solid #d8dce5;
      border-radius: 12px;
      font-size: 15px;
      outline: none;
      background: #fff;
    }

    #smart-lektira-generator input:focus,
    #smart-lektira-generator select:focus{
      border-color: #4e73df;
      box-shadow: 0 0 0 3px rgba(78,115,223,0.12);
    }

    #smart-lektira-generator button{
      border: none;
      border-radius: 12px;
      padding: 12px 16px;
      cursor: pointer;
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      transition: .2s ease;
      white-space: nowrap;
    }

    #smart-lektira-generator .slg-btn-primary{
      background: #4e73df;
    }

    #smart-lektira-generator .slg-btn-primary:hover{
      background: #2e59d9;
    }

    #smart-lektira-generator .slg-btn-secondary{
      background: #1cc88a;
    }

    #smart-lektira-generator .slg-btn-secondary:hover{
      background: #17a673;
    }

    #smart-lektira-generator .slg-btn-muted{
      background: #858796;
    }

    #smart-lektira-generator .slg-btn-muted:hover{
      background: #6c757d;
    }

    #smart-lektira-generator .slg-toolbar{
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin: 14px 0 10px;
    }

    #smart-lektira-generator .slg-status{
      min-height: 20px;
      font-size: 13px;
      color: #666;
      margin: 6px 0 12px;
    }

    #smart-lektira-generator .slg-meta{
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }

    #smart-lektira-generator .slg-chip{
      background: #f4f7fb;
      border: 1px solid #e3e8f2;
      color: #475067;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
    }

    #smart-lektira-generator .slg-tabs{
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }

    #smart-lektira-generator .slg-tab{
      background: #eef2f9;
      color: #2d3748;
      border: 1px solid #dde4f0;
      padding: 10px 12px;
      border-radius: 999px;
      font-size: 13px;
    }

    #smart-lektira-generator .slg-tab.active{
      background: #4e73df;
      color: #fff;
      border-color: #4e73df;
    }

    #smart-lektira-generator .slg-result{
      background: #f8f9fc;
      border-radius: 16px;
      padding: 18px;
      min-height: 220px;
      max-height: 650px;
      overflow: auto;
      line-height: 1.75;
      color: #222;
      font-size: 15px;
      border: 1px solid #eef1f6;
    }

    #smart-lektira-generator .slg-result h3{
      margin: 0 0 14px;
      font-size: 24px;
      line-height: 1.3;
      color: #111827;
    }

    #smart-lektira-generator .slg-result h4{
      margin: 18px 0 10px;
      font-size: 18px;
      color: #1f2937;
    }

    #smart-lektira-generator .slg-result p{
      margin: 0 0 14px;
    }

    #smart-lektira-generator .slg-result ul{
      margin: 0 0 14px 18px;
      padding: 0;
    }

    #smart-lektira-generator .slg-result li{
      margin-bottom: 8px;
    }

    #smart-lektira-generator .slg-link{
      display: inline-block;
      margin-top: 10px;
      color: #2e59d9;
      font-weight: 700;
      text-decoration: none;
    }

    #smart-lektira-generator .slg-link:hover{
      text-decoration: underline;
    }

    @media (max-width: 760px){
      #smart-lektira-generator .slg-card{
        padding: 16px;
      }

      #smart-lektira-generator h2{
        font-size: 24px;
      }

      #smart-lektira-generator .slg-search{
        grid-template-columns: 1fr;
      }

      #smart-lektira-generator .slg-toolbar{
        grid-template-columns: 1fr 1fr;
      }

      #smart-lektira-generator button{
        width: 100%;
      }
    }

    @media (max-width: 480px){
      #smart-lektira-generator .slg-toolbar{
        grid-template-columns: 1fr;
      }

      #smart-lektira-generator .slg-tabs{
        display: grid;
        grid-template-columns: 1fr 1fr;
      }

      #smart-lektira-generator .slg-tab{
        width: 100%;
        text-align: center;
      }
    }
  </style>

  <div class="slg-card">
    <div class="slg-head">
      <div class="slg-badge">AI pomoć za učenje</div>
      <h2>📚 SMART Generator lektire</h2>
      <p class="slg-sub">Pretraži postojeći post na blogu i brzo izvuci najvažnije dijelove za učenje.</p>
    </div>

    <div class="slg-search">
      <input id="slg-search-input" type="text" placeholder="Unesi naziv djela, npr. Pipi Duga Čarapa">
      <button type="button" class="slg-btn-primary" id="slg-search-btn">Pretraži</button>
      <button type="button" class="slg-btn-secondary" id="slg-copy-btn">Kopiraj</button>
    </div>

    <div class="slg-toolbar">
      <button type="button" class="slg-btn-muted" id="slg-show-summary">Kratki sadržaj</button>
      <button type="button" class="slg-btn-muted" id="slg-show-faq">FAQ</button>
      <button type="button" class="slg-btn-muted" id="slg-show-characters">Likovi</button>
      <button type="button" class="slg-btn-muted" id="slg-clear-btn">Obriši</button>
    </div>

    <div class="slg-status" id="slg-status"></div>

    <div class="slg-meta" id="slg-meta"></div>

    <div class="slg-tabs" id="slg-tabs" style="display:none;">
      <button type="button" class="slg-tab active" data-tab="full">Sve</button>
      <button type="button" class="slg-tab" data-tab="summary">Sadržaj</button>
      <button type="button" class="slg-tab" data-tab="theme">Tema/Ideja</button>
      <button type="button" class="slg-tab" data-tab="characters">Likovi</button>
      <button type="button" class="slg-tab" data-tab="faq">FAQ</button>
      <button type="button" class="slg-tab" data-tab="opinion">Mišljenje</button>
    </div>

    <div class="slg-result" id="slg-output">
      Ovdje će se prikazati rezultat.
    </div>
  </div>
<script>
(function(){
  var BLOG_URL = window.location.origin;
  var MAX_RESULTS = 150;
  var CALLBACK_NAME = "smartLektiraHandleData";

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

  function setStatus(text){ statusEl.textContent = text || ""; }
  function setOutput(html){ output.innerHTML = html; }
  function setMeta(items){
    if(!items || !items.length){ metaEl.innerHTML = ""; return; }
    metaEl.innerHTML = items.map(function(item){
      return "<span class='slg-chip'>" + escapeHtml(item) + "</span>";
    }).join("");
  }

  function normalizeText(text){
    return String(text || "")
      .toLowerCase()
      .replace(/[čć]/g, "c")
      .replace(/[š]/g, "s")
      .replace(/[ž]/g, "z")
      .replace(/[đ]/g, "d")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(text){
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function stripHtml(html){
    var temp = document.createElement("div");
    temp.innerHTML = html || "";
    return (temp.textContent || temp.innerText || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+\n/g, "\n\n")
      .replace(/\r/g, "")
      .trim();
  }

  function cleanupScript(){
    if(currentScript && currentScript.parentNode){
      currentScript.parentNode.removeChild(currentScript);
      currentScript = null;
    }
  }

  function createFeedUrl(){
    return BLOG_URL +
      "/feeds/posts/summary?alt=json-in-script&start-index=1&max-results=" +
      MAX_RESULTS +
      "&callback=" + CALLBACK_NAME +
      "&_=" + Date.now();
  }

  function firstUsefulParagraph(text, maxSentences){
    var sentences = String(text || "")
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .filter(function(s){ return s && s.trim().length > 20; });

    return sentences.slice(0, maxSentences || 4).join(" ").trim();
  }

  function extractData(post){
    var title = post && post.title && post.title.$t ? post.title.$t : "Nepoznato djelo";
    var rawHtml = "";

    if(post.summary && post.summary.$t) rawHtml = post.summary.$t;
    else if(post.content && post.content.$t) rawHtml = post.content.$t;

    var cleanText = stripHtml(rawHtml);

    var link = "#";
    if(post.link && post.link.length){
      for(var i=0;i<post.link.length;i++){
        if(post.link[i].rel === "alternate"){
          link = post.link[i].href;
          break;
        }
      }
    }

    return {
      title: title,
      link: link,
      cleanText: cleanText,
      summary: firstUsefulParagraph(cleanText, 4),
      theme: "Tema djela odnosi se na glavne događaje, odnose među likovima i središnju poruku teksta.",
      idea: "Ideja djela naglašava pouku i vrijednosti koje čitatelj može prepoznati kroz radnju i likove.",
      characters: ["Likovi nisu automatski izdvojeni iz sažetog feeda."],
      faq: [
        "Tko je glavni lik u djelu " + title + "?",
        "Koja je glavna tema djela " + title + "?",
        "Koja je poruka djela " + title + "?",
        "Koji su najvažniji događaji u djelu " + title + "?",
        "Zašto je djelo " + title + " važno za čitanje?"
      ],
      opinion: "Moje mišljenje o djelu " + title + " je pozitivno jer je zanimljivo, jasno i potiče razmišljanje o glavnoj poruci djela."
    };
  }

  function renderTab(tab){
    if(!currentData){
      setOutput("Ovdje će se prikazati rezultat.");
      return;
    }

    var d = currentData;
    var html = "<h3>" + escapeHtml(d.title) + "</h3>";

    if(tab === "summary"){
      html += "<h4>Kratki sadržaj</h4><p>" + escapeHtml(d.summary) + "</p>";
    } else if(tab === "faq"){
      html += "<h4>FAQ pitanja</h4><ul>" + d.faq.map(function(q){
        return "<li>" + escapeHtml(q) + "</li>";
      }).join("") + "</ul>";
    } else if(tab === "characters"){
      html += "<h4>Likovi</h4><ul>" + d.characters.map(function(c){
        return "<li>" + escapeHtml(c) + "</li>";
      }).join("") + "</ul>";
    } else {
      html += "<h4>Kratki sadržaj</h4><p>" + escapeHtml(d.summary) + "</p>";
      html += "<h4>Tema</h4><p>" + escapeHtml(d.theme) + "</p>";
      html += "<h4>Ideja</h4><p>" + escapeHtml(d.idea) + "</p>";
      html += "<h4>FAQ pitanja</h4><ul>" + d.faq.map(function(q){
        return "<li>" + escapeHtml(q) + "</li>";
      }).join("") + "</ul>";
      html += "<h4>Moje mišljenje</h4><p>" + escapeHtml(d.opinion) + "</p>";
    }

    if(d.link && d.link !== "#"){
      html += "<a class='slg-link' href='" + d.link + "' target='_blank' rel='noopener noreferrer'>Otvori originalni post</a>";
    }

    setOutput(html);
  }

  function searchPost(){
    var query = normalizeText(input.value);

    if(!query){
      currentData = null;
      tabsEl.style.display = "none";
      setStatus("");
      setMeta([]);
      setOutput("Unesi naziv djela.");
      return;
    }

    setStatus("Pretražujem blog...");
    setMeta(["Učitavanje feeda"]);
    tabsEl.style.display = "none";
    setOutput("Učitavanje podataka...");

    cleanupScript();

    currentScript = document.createElement("script");
    currentScript.src = createFeedUrl();
    currentScript.async = true;

    currentScript.onerror = function(){
      setStatus("");
      setMeta([]);
      setOutput(
        "Dogodila se greška pri učitavanju Blogger feeda.<br><br>" +
        "Provjeri otvara li se: <br><code>" + escapeHtml(BLOG_URL + "/feeds/posts/summary") + "</code>"
      );
    };

    document.body.appendChild(currentScript);
  }

  window[CALLBACK_NAME] = function(data){
    cleanupScript();

    try{
      var query = normalizeText(input.value);
      var posts = data && data.feed && data.feed.entry ? data.feed.entry : [];

      if(!posts.length){
        setStatus("");
        setMeta([]);
        tabsEl.style.display = "none";
        setOutput("Feed je učitan, ali nema dostupnih postova.");
        return;
      }

      var bestPost = null;
      var bestScore = -1;

      for(var i=0;i<posts.length;i++){
        var post = posts[i];
        var title = post && post.title && post.title.$t ? post.title.$t : "";
        var titleNorm = normalizeText(title);
        var score = 0;

        if(titleNorm === query) score += 100;
        if(titleNorm.indexOf(query) !== -1) score += 50;

        query.split(" ").forEach(function(word){
          if(word && titleNorm.indexOf(word) !== -1) score += 10;
        });

        if(score > bestScore){
          bestScore = score;
          bestPost = post;
        }
      }

      if(!bestPost || bestScore < 10){
        setStatus("");
        setMeta([]);
        tabsEl.style.display = "none";
        setOutput("Djelo nije pronađeno u feedu.");
        return;
      }

      currentData = extractData(bestPost);

      setStatus("Post je pronađen.");
      setMeta([
        "Domena: " + BLOG_URL,
        "Feed: summary",
        "Djelo: " + currentData.title
      ]);

      tabsEl.style.display = "flex";
      renderTab("full");
    } catch(err){
      setStatus("");
      setMeta([]);
      tabsEl.style.display = "none";
      setOutput("Feed je učitan, ali je došlo do greške pri obradi podataka.");
    }
  };

  function copyCurrent(){
    var text = output.innerText || output.textContent || "";
    if(!text.trim()){
      alert("Nema teksta za kopiranje.");
      return;
    }

    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(text).then(function(){
        alert("Tekst kopiran!");
      }).catch(function(){
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text){
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();

    try{
      document.execCommand("copy");
      alert("Tekst kopiran!");
    } catch(e){
      alert("Kopiranje nije uspjelo.");
    }

    document.body.removeChild(ta);
  }

  function clearAll(){
    input.value = "";
    currentData = null;
    setStatus("");
    setMeta([]);
    tabsEl.style.display = "none";
    setOutput("Ovdje će se prikazati rezultat.");
  }

  searchBtn.addEventListener("click", searchPost);
  copyBtn.addEventListener("click", copyCurrent);
  clearBtn.addEventListener("click", clearAll);

  summaryBtn.addEventListener("click", function(){
    if(currentData) renderTab("summary");
  });

  faqBtn.addEventListener("click", function(){
    if(currentData) renderTab("faq");
  });

  charactersBtn.addEventListener("click", function(){
    if(currentData) renderTab("characters");
  });

  tabsEl.addEventListener("click", function(e){
    var btn = e.target.closest(".slg-tab");
    if(!btn || !currentData) return;
    renderTab(btn.getAttribute("data-tab"));
  });

  input.addEventListener("keydown", function(e){
    if(e.key === "Enter") searchPost();
  });
})();
</script>
