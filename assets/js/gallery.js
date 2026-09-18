(function () {
  "use strict";

  var grid = document.getElementById("gallery-grid");
  var userGrid = document.getElementById("user-gallery-grid");
  var userSection = document.getElementById("user-gallery-section");
  var empty = document.getElementById("gallery-empty");
  var loading = document.getElementById("gallery-loading");
  var errorEl = document.getElementById("gallery-error");
  var searchRow = document.querySelector(".search-row");
  var searchInput = document.getElementById("gallery-search");
  var searchBtn = document.getElementById("search-btn");
  var searchClear = document.getElementById("search-clear");
  var suggEl = document.getElementById("search-suggestions");
  var galleryTitle = document.getElementById("gallery-title");
  var search = null;
  var suggItems = [];
  var suggActive = -1;
  var debounceTimer = null;
  var page = 1;
  var loadingFlag = false;
  var hasMore = true;
  var showAll = false;
  var isAdmin = false;
  var localTokens = {};
  try {
    localTokens = JSON.parse(localStorage.getItem("gif_tokens") || "{}");
  } catch (e) {}
  var ownIds = {}; // IDs owned by current user (account or delete tokens)
  var rendered = {};
  var isUser = false;
  var myOffset = 0;
  var myTotal = 0;

  function loadMine(resetFlag) {
    if (resetFlag) {
      myOffset = 0;
      userGrid.innerHTML = "";
    }
    var mineUrl = "/api/gifs?mine=true&limit=6&offset=" + myOffset;
    if (search) mineUrl += "&q=" + encodeURIComponent(search);
    return fetch(mineUrl, {
      credentials: "same-origin",
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!data.gifs) return;
        data.gifs.forEach(function (g) {
          ownIds[g.id] = true;
          if (g.delete_token) localTokens[g.id] = g.delete_token;
          addGif(g, userGrid);
        });
        myOffset += data.gifs.length;
        myTotal = data.total != null ? Number(data.total) : myOffset;
        if (myTotal > 0) userSection.style.display = "block";
        redrawButtons();
        renderMineMore();
      })
      .catch(function () {});
  }

  function renderMineMore() {
    var el = document.getElementById("my-gallery-footer");
    if (!el) {
      el = document.createElement("div");
      el.id = "my-gallery-footer";
      userSection.appendChild(el);
    }
    if (myOffset < myTotal) {
      el.innerHTML = '<button>[ load more ]</button>';
      el.querySelector("button").addEventListener("click", function () {
        loadMine(false);
      });
    } else {
      el.innerHTML = "";
    }
  }

  function addAdminToggle() {
    if (document.getElementById("admin-toggle")) return;
    var nav = document.querySelector(".nav");
    if (!nav) return;
    var toggle = document.createElement("div");
    toggle.className = "nav-admin";
    toggle.style.cssText = "display:flex;align-items:center";
    toggle.innerHTML =
      '<label style="font-size:0.75rem;color:var(--fg-dim);cursor:pointer"><input type="checkbox" id="admin-toggle"> show all (admin)</label>';
    var navAuth = nav.querySelector(".nav-auth");
    if (navAuth) nav.insertBefore(toggle, navAuth);
    else nav.appendChild(toggle);
    document
      .getElementById("admin-toggle")
      .addEventListener("change", function () {
        showAll = this.checked;
        reset();
        loadGifs();
      });
  }

  function reset() {
    grid.innerHTML = "";
    userGrid.innerHTML = "";
    userSection.style.display = "none";
    page = 1;
    hasMore = true;
    loadingFlag = false;
    ownIds = {};
    rendered = {};
    myOffset = 0;
    myTotal = 0;
    var ft = document.getElementById("gallery-footer");
    if (ft) ft.innerHTML = "";
    var mf = document.getElementById("my-gallery-footer");
    if (mf) mf.innerHTML = "";
  }

  function start() {
    // resolve auth first so my-gifs vs public split is deterministic
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        if (d && d.user) {
          isUser = true;
          if (d.admin) {
            isAdmin = true;
            addAdminToggle();
          }
          // logged in: my gifs come from the account, not localStorage tokens
          return loadMine(true).then(loadGifs);
        }
        // anonymous: keep the delete-token based my gifs (editable by the anon)
        return startOver();
      })
      .catch(function () {
        startOver();
      });
  }

  function startOver() {
    var tokens = Object.keys(localTokens);
    if (tokens.length) {
      fetch("/api/gifs?tokens=" + tokens.join(","), { credentials: "same-origin" })
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          if (data.gifs) {
            data.gifs.forEach(function (g) {
              ownIds[g.id] = true;
              addGif(g, userGrid);
            });
          }
          loadGifs();
        })
        .catch(function () {
          loadGifs();
        });
    } else {
      loadGifs();
    }
  }

  function loadGifs() {
    if (loadingFlag || !hasMore) return;
    loadingFlag = true;
    loading.style.display = "block";
    errorEl.style.display = "none";
    var url = "/api/gifs?page=" + page + "&limit=24";
    if (search) url += "&q=" + encodeURIComponent(search);
    if (showAll && isAdmin) {
      url += "&all=true";
    } else if (isUser) {
      url += "&exclude_mine=true";
    } else {
      var tk = Object.keys(localTokens);
      if (tk.length) url += "&exclude_tokens=" + tk.join(",");
    }
    fetch(url, { credentials: "same-origin" })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        loading.style.display = "none";
        loadingFlag = false;
        if (data.error) {
          errorEl.style.display = "block";
          errorEl.querySelector(".error-msg").textContent = data.error;
          return;
        }
        if (data.gifs.length === 0 && page === 1) {
          empty.style.display = "block";
          if (search) {
            empty.querySelector("p").textContent = "no results for '" + search + "'";
          }
          return;
        }
        empty.style.display = "none";
        data.gifs.forEach(function (g) {
          addGif(g, grid);
        });
        var seen = (page - 1) * 24 + data.gifs.length;
        hasMore = data.total != null ? seen < Number(data.total) : data.gifs.length === 24;
        page++;
        updateFooter();
      })
      .catch(function (err) {
        loading.style.display = "none";
        loadingFlag = false;
        errorEl.style.display = "block";
        errorEl.querySelector(".error-msg").textContent =
          "failed to load: " + err.message;
      });
  }

  function addGif(g, target) {
    var container = target || grid;
    var key = (container === userGrid ? "u:" : "g:") + g.id;
    if (rendered[key]) return;
    rendered[key] = true;
    var item = document.createElement("div");
    item.className = "gallery-item";
    var img = document.createElement("a");
    img.href = g.direct_url;
    img.target = "_blank";
    img.innerHTML = '<img src="' + g.direct_url + '" alt="gif" loading="lazy">';
    var info = document.createElement("div");
    info.className = "gif-info";
    var infoText = g.size;
    if (g.public !== undefined)
      infoText += g.public ? " · public" : " · private";
    if (g.discord_id) infoText += " · user:" + g.discord_id.slice(0, 6);
    info.textContent = infoText;
    var tagsEl = document.createElement("div");
    tagsEl.className = "gif-tags";
    if (g.tags && g.tags.length)
      tagsEl.innerHTML = g.tags
        .map(function (t) {
          return '<span class="tag">' + esc(t) + "</span>";
        })
        .join("");
    var btnRow = document.createElement("div");
    btnRow.className = "btn-row";
    var copyBtn = document.createElement("button");
    copyBtn.className = "btn";
    copyBtn.textContent = "[ copy url ]";
    copyBtn.addEventListener("click", function () {
      navigator.clipboard
        .writeText(g.url)
        .then(function () {
          copyBtn.textContent = "copied!";
          setTimeout(function () {
            copyBtn.textContent = "[ copy url ]";
          }, 1500);
        })
        .catch(function () {});
    });
    btnRow.appendChild(copyBtn);
    item.appendChild(img);
    item.appendChild(info);
    item.appendChild(tagsEl);
    item.appendChild(btnRow);
    item._gif = g;
    item._btnRow = btnRow;
    if (isAdmin || ownIds[g.id] || localTokens[g.id]) {
      addOwnButtons(g, item, btnRow);
      item._ownBtns = true;
    }
    container.appendChild(item);
    if (container === userGrid) userSection.style.display = "block";
  }

  function redrawButtons() {
    [grid, userGrid].forEach(function (wrap) {
      var items = wrap.querySelectorAll(".gallery-item");
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it._ownBtns || !it._gif) continue;
        addOwnButtons(it._gif, it, it._btnRow);
        it._ownBtns = true;
      }
    });
  }

  function addOwnButtons(g, item, btnRow) {
    var editBtn = document.createElement("button");
    editBtn.className = "btn own-btn";
    editBtn.style.cssText = "font-size:0.7rem;padding:0.2rem 0.4rem";
    editBtn.textContent = "[edit]";
    editBtn.onclick = function () {
      editTags(g, editBtn, item);
    };
    btnRow.appendChild(editBtn);
    var delBtn = document.createElement("button");
    delBtn.className = "btn own-btn";
    delBtn.style.cssText =
      "border-color:var(--nord11);color:var(--nord11);font-size:0.7rem;padding:0.2rem 0.4rem";
    delBtn.textContent = "[x]";
    delBtn.addEventListener("click", function () {
      if (!confirm("delete this gif?")) return;
      fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: g.id,
          delete_token: localTokens[g.id] || "",
        }),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (d) {
          if (d.success) {
            item.remove();
          } else {
            delBtn.textContent = "failed";
          }
        })
        .catch(function () {
          delBtn.textContent = "error";
        });
    });
    btnRow.appendChild(delBtn);
  }

  function updateFooter() {
    var app = document.getElementById("gallery-app");
    var footer = document.getElementById("gallery-footer");
    if (!footer) {
      footer = document.createElement("div");
      footer.id = "gallery-footer";
      footer.style.cssText = "text-align:center;margin-top:1rem";
      app.appendChild(footer);
    }
    if (hasMore) {
      footer.innerHTML = '<button class="load-more">[ load more ]</button>';
      footer.querySelector(".load-more").addEventListener("click", loadGifs);
    } else {
      footer.innerHTML = '<span class="hint">all gifs loaded</span>';
    }
  }

  empty.style.display = "none";

  function esc(s) {
    var d = document.createElement("div");
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  function editTags(g, btn, item) {
    var tagsEl =
      item.querySelector(".gif-tags") || document.createElement("div");
    tagsEl.className = "gif-tags";
    var wrapper = document.createElement("span");
    wrapper.style.cssText =
      "display:inline-flex;flex-wrap:wrap;gap:.2rem;align-items:center;background:var(--nord0);border:1px solid var(--nord3);padding:.2rem .4rem;width:100%;cursor:text";
    var chips = document.createElement("span");
    var input = document.createElement("input");
    input.type = "text";
    input.placeholder = "add tag...";
    input.style.cssText =
      "border:none;background:transparent;color:var(--fg);font-family:Space Mono,monospace;font-size:.75rem;outline:none;width:80px;padding:0";
    wrapper.appendChild(chips);
    wrapper.appendChild(input);
    tagsEl.innerHTML = "";
    tagsEl.appendChild(wrapper);
    var tagList = (g.tags || []).slice();
    function renderChips() {
      chips.innerHTML = "";
      tagList.forEach(function (t) {
        var chip = document.createElement("span");
        chip.style.cssText =
          "display:inline-flex;align-items:center;gap:.15rem;font-size:.65rem;color:var(--nord14);border:1px solid var(--nord3);border-radius:3px;padding:0 .2rem;background:var(--nord1)";
        chip.textContent = "#" + t;
        var rm = document.createElement("span");
        rm.textContent = "x";
        rm.style.cssText =
          "cursor:pointer;margin-left:.15rem;color:var(--nord11)";
        rm.onclick = function () {
          tagList = tagList.filter(function (x) {
            return x !== t;
          });
          renderChips();
        };
        chip.appendChild(rm);
        chips.appendChild(chip);
      });
    }
    renderChips();
    input.addEventListener("keydown", function (e) {
      if (e.key === " " || e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        var val = input.value.trim().slice(0, 16);
        if (val && tagList.indexOf(val) === -1 && tagList.length < 10) {
          tagList.push(val);
          renderChips();
        }
        input.value = "";
      }
      if (e.key === "Backspace" && input.value === "" && tagList.length) {
        tagList.pop();
        renderChips();
      }
    });
    btn.textContent = "[save]";
    btn.onclick = function () {
      fetch("/api/gif/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: g.id,
          tags: tagList.join(","),
          delete_token: localTokens[g.id] || "",
        }),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (d) {
          if (d.success) {
            g.tags = d.tags;
            tagsEl.innerHTML = g.tags.length
              ? g.tags
                  .map(function (t) {
                    return '<span class="tag">' + esc(t) + "</span>";
                  })
                  .join("")
              : "";
            btn.textContent = "[edit]";
            btn.onclick = function () {
              editTags(g, btn, item);
            };
          } else {
            btn.textContent = "failed";
          }
        })
        .catch(function () {
          btn.textContent = "error";
        });
    };
  }

  function renderSuggestions(tags) {
    suggItems = tags;
    suggActive = -1;
    suggEl.innerHTML = "";
    if (!tags.length) {
      hideSuggestions();
      return;
    }
    tags.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "sugg";
      b.textContent = t;
      b.addEventListener("click", function () {
        searchInput.value = t;
        hideSuggestions();
        searchInput.focus();
      });
      suggEl.appendChild(b);
    });
    suggEl.style.display = "block";
  }

  function hideSuggestions() {
    suggEl.style.display = "none";
    suggEl.innerHTML = "";
    suggItems = [];
    suggActive = -1;
  }

  function runSearch() {
    var v = (searchInput.value || "").trim();
    if (!v) {
      if (search) clearSearch();
      return;
    }
    search = v;
    hideSuggestions();
    reset();
    empty.style.display = "none";
    galleryTitle.textContent = "> results for '" + search + "'";
    showClearButton();
    if (isUser) loadMine(true);
    loadGifs();
  }

  function showClearButton() {
    if (!searchClear) {
      searchClear = document.createElement("button");
      searchClear.id = "search-clear";
      searchClear.textContent = "[ x ]";
      searchRow.appendChild(searchClear);
      searchClear.addEventListener("click", clearSearch);
    }
    searchClear.style.display = "inline-block";
  }

  function hideClearButton() {
    if (searchClear) searchClear.style.display = "none";
  }

  function reloadGallery() {
    if (isUser) {
      loadMine(true).then(function () {
        loadGifs();
      });
    } else {
      startOver();
    }
  }

  function clearSearch() {
    search = null;
    searchInput.value = "";
    hideSuggestions();
    hideClearButton();
    galleryTitle.textContent = "> public gifs";
    var p = empty.querySelector("p");
    if (p) p.innerHTML = 'no gifs yet. <a href="/">create one</a>';
    empty.style.display = "none";
    reset();
    reloadGallery();
  }

  searchInput.addEventListener("input", function () {
    clearTimeout(debounceTimer);
    var v = (searchInput.value || "").trim();
    if (!v) {
      hideSuggestions();
      return;
    }
    debounceTimer = setTimeout(function () {
      var url = "/api/tags?q=" + encodeURIComponent(v);
      if (showAll && isAdmin) url += "&all=true";
      fetch(url)
        .then(function (r) {
          return r.json();
        })
        .then(function (d) {
          renderSuggestions(d.tags || []);
        })
        .catch(function () {
          hideSuggestions();
        });
    }, 200);
  });

  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!suggItems.length) return;
      e.preventDefault();
      var items = suggEl.querySelectorAll(".sugg");
      if (e.key === "ArrowDown") {
        suggActive = (suggActive + 1) % suggItems.length;
      } else {
        suggActive = (suggActive - 1 + suggItems.length) % suggItems.length;
      }
      items.forEach(function (el, i) {
        el.classList.toggle("active", i === suggActive);
      });
      return;
    }
    if (e.key === "Enter") {
      if (suggItems.length && suggActive >= 0) {
        e.preventDefault();
        searchInput.value = suggItems[suggActive];
        hideSuggestions();
        return;
      }
      runSearch();
      return;
    }
    if (e.key === "Escape") hideSuggestions();
  });

  searchBtn.addEventListener("click", runSearch);

  document.addEventListener("click", function (e) {
    if (searchRow && !searchRow.contains(e.target)) hideSuggestions();
  });

  start();
})();
