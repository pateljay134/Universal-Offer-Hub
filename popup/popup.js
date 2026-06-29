/*
 * Universal Offer Hub — Popup
 * ----------------------------
 * Responsibilities:
 *   1. Auto-detect the active tab and offer a branded one-tap Run button.
 *   2. Render the cross-source search hub with chips / sort / scoring.
 *   3. Persist filter state across reopens (UOH_UIState).
 *
 * Storage keys:
 *   UOH_Database     map of offer key → offer record (m, v, site, n, t, r, ts, status, ...)
 *   UOH_LastRunCount last autopilot's added/clipped count (set by content/scraper.js)
 *   UOH_UIState      last-used filter state (source filter, type filter, sort, search)
 */
(function () {
  "use strict";

  var DEFAULT_UI = { source: "ALL", type: "ALL", sort: "best", query: "" };
  var state = Object.assign({}, DEFAULT_UI);
  var activeTab = null;
  var activeSource = null;

  /* ---------- DOM helpers ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var escapeHtml = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  /* ---------- Search engine ----------
   * Goal: "roadrunner", "Road Runner", "Road-Runner", "RoadRunner", "Road & Runner"
   * all return the same offers. So we don't ask the user to use any particular
   * separator — we normalize both sides aggressively before matching.
   *
   * Two flavours of normalization are used together per offer:
   *   normalize()  → camelCase split, lowercase, every non-alphanumeric → space.
   *                  "Road-Runner" / "RoadRunner" both become "road runner".
   *                  Used for whole-token substring search.
   *   compact()    → lowercase + strip every non-alphanumeric.
   *                  "Road Runner" / "Road-Runner" both become "roadrunner".
   *                  Lets a single-token query "roadrunner" hit a multi-word
   *                  merchant "Road Runner".
   *
   * Tokenization mirrors normalize(): the user can type spaces, dashes,
   * ampersands, dots — all are separators. AND semantics still apply across
   * tokens; we just don't surface the `&` operator anywhere. */
  function splitCamelCase(s) { return String(s == null ? "" : s).replace(/([a-z])([A-Z])/g, "$1 $2"); }
  function normalize(s) { return splitCamelCase(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function compact(s)   { return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, ""); }

  function tokenize(q) {
    if (!q) return [];
    return normalize(q).split(/\s+/).filter(Boolean);
  }

  // Score an offer against tokens. Each token MUST hit somewhere (AND); the
  // tier scale below ranks merchant matches above value matches above haystack
  // matches, with prefix/whole-string hits worth more than a substring.
  function scoreOffer(o, tokens) {
    if (!tokens.length) return 1;
    var mN = normalize(o.m);
    var vN = normalize(o.v);
    var rN = normalize(o.r || (o.m + " " + o.v + " " + (o.card || "")));
    var mC = compact(o.m);
    var vC = compact(o.v);
    var rC = compact(o.r || (o.m + " " + o.v + " " + (o.card || "")));
    var total = 0;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i], s = 0;
      if (mN === t)                  s = 6;
      else if (mN.indexOf(t) === 0)  s = 5;
      else if (mN.indexOf(t) > -1)   s = 4;
      else if (mC.indexOf(t) > -1)   s = 3; // catches "roadrunner" vs "Road Runner"
      else if (vN.indexOf(t) > -1)   s = 2;
      else if (vC.indexOf(t) > -1)   s = 2;
      else if (rN.indexOf(t) > -1)   s = 1;
      else if (rC.indexOf(t) > -1)   s = 1;
      if (s === 0) return 0; // AND failed
      total += s;
    }
    return total;
  }

  /* ---------- Render: top-of-popup auto-detect card ---------- */
  function renderRunCard() {
    var runCard = $("run-card");
    var quick = $("quick-open");
    if (activeSource) {
      runCard.hidden = false;
      quick.hidden = true;
      runCard.style.setProperty("--site-color", activeSource.color);
      $("run-detected").innerText = "Detected: " + activeSource.name;
      $("run-btn-label").innerText = "Run " + activeSource.shortName + " Autopilot";
      $("run-blurb").innerText = activeSource.blurb;
    } else {
      runCard.hidden = true;
      quick.hidden = false;
      var grid = $("quick-open-grid");
      grid.innerHTML = "";
      window.UOH_SOURCES.forEach(function (s) {
        var btn = document.createElement("button");
        btn.className = "quick-open-tile";
        btn.innerHTML = '<span class="dot" style="background:' + s.color + '"></span>'
                      + '<span>' + escapeHtml(s.shortName) + '</span>';
        btn.title = "Open " + s.name;
        btn.addEventListener("click", function () { chrome.tabs.create({ url: s.landingUrl }); });
        grid.appendChild(btn);
      });
    }
  }

  /* ---------- Render: source filter chips (one per known source) ---------- */
  function renderSourceChips() {
    var bar = $("source-chips");
    bar.innerHTML = "";
    var chips = [{ id: "ALL", label: "All sources", color: null }].concat(
      window.UOH_SOURCES.map(function (s) { return { id: s.id, label: s.shortName, color: s.color }; })
    );
    chips.forEach(function (c) {
      var btn = document.createElement("button");
      btn.className = "chip" + (state.source === c.id ? " active" : "");
      btn.setAttribute("data-source", c.id);
      btn.innerText = c.label;
      if (c.color) btn.style.setProperty("--chip-color", c.color);
      btn.addEventListener("click", function () {
        state.source = c.id;
        persistUI();
        renderSourceChips();
        rerenderResults();
      });
      bar.appendChild(btn);
    });
  }

  /* ---------- Render: results list ---------- */
  function rerenderResults() {
    chrome.storage.local.get(["UOH_Database", "UOH_LastRunCount"], function (res) {
      var db = res.UOH_Database || {};
      var all = Object.values(db);

      // Filter by source
      var items = state.source === "ALL" ? all.slice() : all.filter(function (o) { return o.site === state.source; });

      // Filter by type. We bucket DOLLAR + SPEND_GET together under "$".
      if (state.type !== "ALL") {
        items = items.filter(function (o) {
          var t = o.t || "OTHER";
          if (state.type === "DOLLAR") return t === "DOLLAR" || t === "SPEND_GET";
          return t === state.type;
        });
      }

      // Search scoring + AND filter
      var tokens = tokenize(state.query);
      if (tokens.length) {
        items = items.map(function (o) { return { o: o, s: scoreOffer(o, tokens) }; })
                     .filter(function (x) { return x.s > 0; });
      } else {
        items = items.map(function (o) { return { o: o, s: 0 }; });
      }

      // Sort
      var bestScore = 0;
      items.forEach(function (x) { if (x.s > bestScore) bestScore = x.s; });
      items.sort(function (a, b) {
        if (state.sort === "best" && tokens.length) {
          if (b.s !== a.s) return b.s - a.s;
        }
        if (state.sort === "expiry") {
          // Offers without a parsed expiry sink to the bottom; otherwise the
          // soonest-to-expire wins. Already-expired offers (ts in the past)
          // still surface first so the user can decide whether to drop them.
          var ae = a.o.expiresTs == null ? Infinity : a.o.expiresTs;
          var be = b.o.expiresTs == null ? Infinity : b.o.expiresTs;
          if (ae !== be) return ae - be;
        }
        if (state.sort === "value") {
          return (b.o.n || 0) - (a.o.n || 0);
        }
        if (state.sort === "az") {
          return (a.o.m || "").localeCompare(b.o.m || "");
        }
        if (state.sort === "recent") {
          return (b.o.ts || 0) - (a.o.ts || 0);
        }
        // best-match default tie-breaker: numeric value desc, then merchant
        if ((b.o.n || 0) !== (a.o.n || 0)) return (b.o.n || 0) - (a.o.n || 0);
        return (a.o.m || "").localeCompare(b.o.m || "");
      });

      // Stats
      $("stat-total").innerText = all.length;
      $("stat-cards").innerText = new Set(all.map(function (o) { return o.site; })).size;
      $("stat-recent").innerText = res.UOH_LastRunCount || 0;
      $("results-count").innerText = items.length + (items.length === 1 ? " result" : " results");

      // List
      var list = $("results");
      if (!items.length) {
        list.innerHTML = '<div class="row-empty">' + (state.query ? "No offers match your search." : "No offers saved yet. Open a supported site and click Run.") + "</div>";
        return;
      }

      var nowMs = Date.now();
      list.innerHTML = items.map(function (x) {
        var o = x.o;
        var src = window.UOH_SOURCES.find(function (s) { return s.id === o.site; });
        var bg = src ? src.color : "#475569";
        var typeTxt = (o.t && o.t !== "OTHER") ? '<span class="type-tag">' + escapeHtml(o.t) + "</span>" : "";
        var cardTxt = o.card ? '<span class="card-tag" title="' + escapeHtml(o.card) + '">' + escapeHtml(o.card) + "</span>" : "";
        var expiryTxt = "";
        if (o.expiresTs) {
          var msLeft = o.expiresTs - nowMs;
          var daysLeft = Math.floor(msLeft / 86400000);
          var label, cls = "expiry-tag";
          if (msLeft < 0) { label = "Expired"; cls += " expired"; }
          else if (daysLeft === 0) { label = "Expires today"; cls += " soon"; }
          else if (daysLeft === 1) { label = "1 day left"; cls += " soon"; }
          else if (daysLeft <= 7)  { label = daysLeft + " days left"; cls += " soon"; }
          else if (daysLeft <= 30) { label = daysLeft + " days left"; }
          else { label = new Date(o.expiresTs).toLocaleDateString(); }
          var fullTitle = "Expires " + new Date(o.expiresTs).toLocaleDateString();
          expiryTxt = '<span class="' + cls + '" title="' + escapeHtml(fullTitle) + '">' + escapeHtml(label) + '</span>';
        } else if (o.days) {
          // Fall-through for legacy offers saved before expiresTs existed.
          expiryTxt = '<span class="expiry-tag" title="' + escapeHtml(o.days) + '">' + escapeHtml(o.days) + '</span>';
        }
        var isBest = tokens.length && x.s === bestScore && bestScore >= 4;
        return '<div class="row' + (isBest ? " best" : "") + '">'
             + '  <div class="row-info">'
             + '    <div class="row-merchant" title="' + escapeHtml(o.m) + '">' + escapeHtml(o.m) + "</div>"
             + '    <div class="row-meta">'
             + '      <span class="site-tag" style="background:' + bg + '">' + escapeHtml(src ? src.shortName : o.site) + "</span>"
             + typeTxt + cardTxt + expiryTxt
             + "    </div>"
             + "  </div>"
             + '  <div class="row-value">' + escapeHtml(o.v) + "</div>"
             + "</div>";
      }).join("");
    });
  }

  /* ---------- UI state persistence ---------- */
  function persistUI() { chrome.storage.local.set({ UOH_UIState: state }); }
  function loadUI(cb) {
    chrome.storage.local.get(["UOH_UIState"], function (res) {
      state = Object.assign({}, DEFAULT_UI, res.UOH_UIState || {});
      cb && cb();
    });
  }

  /* ---------- Wire up events ---------- */
  function bind() {
    $("run-btn").addEventListener("click", function () {
      if (!activeTab || !activeSource) return;
      // 0) MAIN-world marker: lets the AMEX auto-injected content script tell a
      //    real popup-triggered run apart from passive page-visit auto-injection.
      //    Scraper consumes & deletes it on the first invocation.
      chrome.scripting.executeScript(
        {
          target: { tabId: activeTab.id },
          func: function () { try { sessionStorage.setItem("UOH_PopupTrigger", String(Date.now())); } catch (e) {} },
          world: "MAIN"
        },
        function () {
          // 1) ISOLATED bridge: forwards window.postMessage offers → chrome.storage.
          chrome.scripting.executeScript(
            { target: { tabId: activeTab.id }, files: ["content/bridge.js"] },
            function () {
              if (chrome.runtime.lastError) {
                alert("Could not install storage bridge: " + chrome.runtime.lastError.message);
                return;
              }
              // 2) MAIN-world autopilot: needed for Capital One's React-fiber clicks
              //    and its inline onclick="window.c1Clk(...)" handlers. Safe for the
              //    other three sites too — they only use plain DOM events.
              chrome.scripting.executeScript(
                { target: { tabId: activeTab.id }, files: ["content/scraper.js"], world: "MAIN" },
                function () {
                  if (chrome.runtime.lastError) {
                    alert("Could not start the autopilot: " + chrome.runtime.lastError.message);
                  } else {
                    window.close();
                  }
                }
              );
            }
          );
        }
      );
    });

    $("search").addEventListener("input", function (e) {
      state.query = e.target.value;
      persistUI();
      rerenderResults();
    });

    $("clear-search").addEventListener("click", function () {
      state.query = "";
      $("search").value = "";
      persistUI();
      rerenderResults();
    });

    $("sort-select").addEventListener("change", function (e) {
      state.sort = e.target.value;
      persistUI();
      rerenderResults();
    });

    $("type-chips").addEventListener("click", function (e) {
      var btn = e.target.closest(".chip"); if (!btn) return;
      state.type = btn.getAttribute("data-type");
      Array.from(this.querySelectorAll(".chip")).forEach(function (c) {
        c.classList.toggle("active", c === btn);
      });
      persistUI();
      rerenderResults();
    });

    $("export-btn").addEventListener("click", function () {
      chrome.storage.local.get(["UOH_Database"], function (res) {
        var arr = Object.values(res.UOH_Database || {});
        if (!arr.length) { alert("No saved offers yet."); return; }
        var header = ["Merchant", "Offer", "Source", "Type", "Numeric", "Status", "Days", "Channel", "Badge", "Saved"];
        var rows = [header.join(",")];
        arr.forEach(function (o) {
          var row = [o.m, o.v, o.site, o.t, o.n, o.status || "", o.days || "", o.channel || "", o.badge || "",
                     o.ts ? new Date(o.ts).toISOString() : ""];
          rows.push(row.map(function (x) { return '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"'; }).join(","));
        });
        var blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "universal_offer_hub_" + new Date().toISOString().slice(0, 10) + ".csv";
        a.click();
      });
    });

    $("reset-source").addEventListener("click", function () {
      var label = state.source === "ALL" ? "ALL saved offers" : ("offers from " + state.source);
      if (!confirm("This will permanently delete " + label + ". Continue?")) return;
      chrome.storage.local.get(["UOH_Database"], function (res) {
        var db = res.UOH_Database || {};
        if (state.source === "ALL") db = {};
        else {
          Object.keys(db).forEach(function (k) { if (db[k].site === state.source) delete db[k]; });
        }
        chrome.storage.local.set({ UOH_Database: db, UOH_LastRunCount: 0 }, rerenderResults);
      });
    });

    // Live-refresh while autopilot writes new offers (popup stays open scenario).
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "local") return;
      if (changes.UOH_Database || changes.UOH_LastRunCount) rerenderResults();
    });
  }

  /* ---------- Init ---------- */
  loadUI(function () {
    $("search").value = state.query || "";
    $("sort-select").value = state.sort || "best";
    Array.from($("type-chips").querySelectorAll(".chip")).forEach(function (c) {
      c.classList.toggle("active", c.getAttribute("data-type") === state.type);
    });
    renderSourceChips();
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      activeTab = tabs && tabs[0] ? tabs[0] : null;
      activeSource = activeTab ? window.UOH_detectSource(activeTab.url) : null;
      renderRunCard();
      bind();
      rerenderResults();
    });
  });
})();
