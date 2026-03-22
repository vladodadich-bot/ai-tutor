(function () {
      var BLOG_URL = "https://lektirko.blogspot.com";
      var MAX_RESULTS = 500;
      var CALLBACK_NAME = "smartGeneratorHandleData";
      var searchQuery = "";
      var currentScript = null;

      var input = document.getElementById("sg-searchTitle");
      var output = document.getElementById("sg-output");
      var status = document.getElementById("sg-status");
      var searchBtn = document.getElementById("sg-searchBtn");
      var copyBtn = document.getElementById("sg-copyBtn");
      var clearBtn = document.getElementById("sg-clearBtn");

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

      function stripHtml(html) {
        var temp = document.createElement("div");
        temp.innerHTML = html || "";
        var text = temp.textContent || temp.innerText || "";
        return text
          .replace(/\s+/g, " ")
          .replace(/\u00a0/g, " ")
          .trim();
      }

      function setStatus(message) {
        status.textContent = message || "";
      }

      function setOutput(html) {
        output.innerHTML = html;
      }

      function cleanupScript() {
        if (currentScript && currentScript.parentNode) {
          currentScript.parentNode.removeChild(currentScript);
          currentScript = null;
        }
      }

      function searchPost() {
        searchQuery = normalizeText(input.value);

        if (!searchQuery) {
          setStatus("");
          setOutput("Unesi naziv djela.");
          return;
        }

        setStatus("Pretražujem blog...");
        setOutput("Učitavanje podataka...");

        cleanupScript();

        var feedUrl =
          BLOG_URL +
          "/feeds/posts/default?alt=json-in-script&max-results=" +
          MAX_RESULTS +
          "&callback=" +
          CALLBACK_NAME +
          "&_=" +
          new Date().getTime();

        currentScript = document.createElement("script");
        currentScript.src = feedUrl;
        currentScript.async = true;

        currentScript.onerror = function () {
          setStatus("");
          setOutput("Došlo je do greške pri učitavanju Blogger feeda.");
        };

        document.body.appendChild(currentScript);
      }

      window[CALLBACK_NAME] = function (data) {
        cleanupScript();

        try {
          var posts = data && data.feed && data.feed.entry ? data.feed.entry : [];

          if (!posts.length) {
            setStatus("");
            setOutput("Nema dostupnih postova u feedu.");
            return;
          }

          var foundPost = null;

          for (var i = 0; i < posts.length; i++) {
            var post = posts[i];
            var postTitle = normalizeText(post && post.title && post.title.$t ? post.title.$t : "");

            if (postTitle.indexOf(searchQuery) !== -1) {
              foundPost = post;
              break;
            }
          }

          if (!foundPost) {
            setStatus("");
            setOutput("Djelo nije pronađeno u dostupnim postovima.");
            return;
          }

          var rawContent = "";
          if (foundPost.content && foundPost.content.$t) {
            rawContent = foundPost.content.$t;
          } else if (foundPost.summary && foundPost.summary.$t) {
            rawContent = foundPost.summary.$t;
          }

          var cleanText = stripHtml(rawContent);

          if (!cleanText) {
            cleanText = "Sadržaj posta nije dostupan za prikaz.";
          }

          var shortText = cleanText.length > 2500
            ? cleanText.substring(0, 2500) + "..."
            : cleanText;

          var postLink = "#";
          if (foundPost.link && foundPost.link.length) {
            for (var j = 0; j < foundPost.link.length; j++) {
              if (foundPost.link[j].rel === "alternate") {
                postLink = foundPost.link[j].href;
                break;
              }
            }
          }

          var title = foundPost.title && foundPost.title.$t ? foundPost.title.$t : "Nepoznato djelo";

          var formatted =
            "<strong>Naziv djela:</strong> " + escapeHtml(title) + "<br><br>" +
            "<strong>Preuzeti sadržaj:</strong><br><br>" +
            escapeHtml(shortText) + "<br><br>" +
            "<a href='" + postLink + "' target='_blank' rel='noopener noreferrer'>Otvori originalni post</a>";

          setStatus("Pronađen je odgovarajući post.");
          setOutput(formatted);
        } catch (err) {
          setStatus("");
          setOutput("Dogodila se greška pri obradi podataka.");
        }
      };

      function escapeHtml(text) {
        return String(text || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      function copyText() {
        var text = output.innerText || output.textContent || "";
        if (!text.trim()) {
          alert("Nema teksta za kopiranje.");
          return;
        }

        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text)
            .then(function () {
              alert("Tekst kopiran!");
            })
            .catch(function () {
              fallbackCopy(text);
            });
        } else {
          fallbackCopy(text);
        }
      }

      function fallbackCopy(text) {
        var textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
          document.execCommand("copy");
          alert("Tekst kopiran!");
        } catch (e) {
          alert("Kopiranje nije uspjelo. Kopiraj ručno.");
        }

        document.body.removeChild(textarea);
      }

      function clearAll() {
        input.value = "";
        setStatus("");
        setOutput("Ovdje će se prikazati rezultat.");
      }

      searchBtn.addEventListener("click", searchPost);
      copyBtn.addEventListener("click", copyText);
      clearBtn.addEventListener("click", clearAll);

      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          searchPost();
        }
      });
    })();
