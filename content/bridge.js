/*
 * Universal Offer Hub — Bridge (ISOLATED world)
 * ----------------------------------------------
 * The autopilot in content/scraper.js runs in the page's MAIN world so it can
 * (a) drive the page exactly like the original bookmarklets did — including
 * React-fiber click handlers and inline `onclick="window.c1Clk(...)"` tile
 * handlers used by the Capital One sorter UI — and (b) avoid the wrapping
 * differences between ISOLATED-world content scripts and the page's own JS.
 *
 * That means the autopilot has no access to chrome.runtime / chrome.storage.
 * This bridge runs in ISOLATED world, listens for `window.postMessage` from
 * the autopilot, batches the writes, and persists them to chrome.storage.local.
 *
 * The autopilot tags every message with `__uoh: true` so we ignore everything
 * else flowing through the page.
 */
(function () {
  if (window.__uoh_bridge_installed) return;
  window.__uoh_bridge_installed = true;

  var pendingOffers = Object.create(null);
  var pendingLastRun = null;
  var flushTimer = null;
  // Becomes true once we detect the extension's runtime context has been
  // invalidated (the user reloaded / disabled the extension while this tab
  // was still running). After that we drop further flushes silently — the
  // alternative is one "Extension context invalidated" exception per tick
  // for the lifetime of the tab.
  var bridgeDead = false;

  function isContextAlive() {
    try { return !!(chrome && chrome.runtime && chrome.runtime.id); }
    catch (e) { return false; }
  }

  function scheduleFlush() {
    if (bridgeDead || flushTimer) return;
    flushTimer = setTimeout(flush, 250);
  }

  function flush() {
    flushTimer = null;
    if (bridgeDead) return;
    if (!isContextAlive()) { bridgeDead = true; return; }
    var offerKeys = Object.keys(pendingOffers);
    if (offerKeys.length === 0 && pendingLastRun === null) return;
    var offers = pendingOffers;
    var lastRun = pendingLastRun;
    pendingOffers = Object.create(null);
    pendingLastRun = null;

    try {
      chrome.storage.local.get(["UOH_Database"], function (res) {
        if (chrome.runtime.lastError) { bridgeDead = true; return; }
        var db = res.UOH_Database || {};
        for (var i = 0; i < offerKeys.length; i++) {
          var k = offerKeys[i];
          db[k] = Object.assign({}, db[k] || {}, offers[k]);
        }
        var write = { UOH_Database: db };
        if (lastRun !== null) {
          write.UOH_LastRunCount = lastRun;
          write.UOH_LastRunAt = Date.now();
        }
        try {
          chrome.storage.local.set(write, function () {
            if (chrome.runtime.lastError) bridgeDead = true;
          });
        } catch (e) { bridgeDead = true; }
      });
    } catch (e) { bridgeDead = true; }
  }

  window.addEventListener("message", function (e) {
    if (e.source !== window) return;
    var msg = e.data;
    if (!msg || msg.__uoh !== true) return;
    if (bridgeDead) return; // nothing we can do — drop until the tab reloads
    if (msg.type === "SAVE_OFFER" && msg.key && msg.record) {
      pendingOffers[msg.key] = msg.record;
      scheduleFlush();
    } else if (msg.type === "UPDATE_LAST_RUN" && typeof msg.count === "number") {
      pendingLastRun = msg.count;
      scheduleFlush();
    } else if (msg.type === "FLUSH") {
      flush();
    }
  }, false);
})();
