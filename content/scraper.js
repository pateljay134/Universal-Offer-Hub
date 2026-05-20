/*
 * Universal Offer Hub — Per-site Autopilot Router  (MAIN world)
 * --------------------------------------------------------------
 * Injected into the page's MAIN JS context by chrome.scripting.executeScript
 * with `world: "MAIN"`. Running here is intentional and important:
 *
 *   • The Capital One sorter UI renders rows with inline
 *     `onclick="window.c1Clk(...)"` handlers. Inline-onclick attributes run
 *     in the page's MAIN world, so c1Clk MUST be defined there.
 *   • The Capital One "View More Offers" button is wired through React's
 *     synthetic event system + React-fiber props. Reaching those fiber keys
 *     (`__reactProps$xyz`) reliably requires the MAIN world.
 *   • The Chase / Amex / Walgreens autopilots are pure DOM-event clicks and
 *     work in either world, so MAIN is safe for them too.
 *
 * MAIN world has no chrome.* APIs. We persist offers by posting messages to
 * content/bridge.js (ISOLATED), which batches them into chrome.storage.local.
 *
 * Adding a new site:
 *   1. Add a record to lib/sources.js.
 *   2. Add a `host.indexOf("yoursite.com") > -1` branch below that calls
 *      saveOffer(uniqueKey, merchant, value, "Site Display Name", { ... }).
 */
(function () {
  var host = window.location.hostname;

  /* ---------- Hub database write helpers (post to ISOLATED bridge) ---------- */
  var saveOffer = function (key, merchant, value, site, extra) {
    if (!key || !merchant) return;
    var parsed = parseValue(value);
    var cardLabel = (extra && extra.card) || "";
    var record = Object.assign(
      {
        m: merchant,
        v: value || "",
        site: site,
        n: parsed.num,
        t: parsed.type,
        // search haystack — include the card label so users can search e.g.
        // "platinum samsung" and surface only Platinum-card Samsung offers.
        r: (merchant + " " + (value || "") + " " + cardLabel).toLowerCase(),
        ts: Date.now(),
        firstSeen: Date.now()
      },
      extra || {}
    );
    try {
      window.postMessage({ __uoh: true, type: "SAVE_OFFER", key: key, record: record }, "*");
    } catch (e) {}
  };

  /* ---------- Per-site active-card detection ----------
   * Same merchant on two different cards under one issuer is two different
   * offers, so the storage key must include a per-card discriminator. Each
   * helper returns { cardId, label } — cardId becomes part of the offer key,
   * label is shown as a chip in the popup. All helpers fall back to "default"
   * so the autopilot still works on cards whose DOM/URL we don't recognise. */
  var amexCardInfo = function () {
    var label = "", last4 = "";
    var nameEl = document.querySelector('[data-testid="simple_switcher_display_name"]');
    if (nameEl) label = (nameEl.innerText || nameEl.textContent || "").replace(/\s+/g, " ").trim();
    var numEl = document.querySelector('[data-testid="simple_switcher_display_number_val"]');
    if (numEl) {
      var t = (numEl.innerText || numEl.textContent || "").trim();
      var m = t.match(/(\d{4,5})\b/);
      if (m) last4 = m[1];
    }
    if (!last4) {
      var sel = document.querySelector('[data-testid="simple_switcher_selected_option_display"]');
      if (sel) {
        var aria = sel.getAttribute("aria-label") || "";
        var m2 = aria.match(/(\d{4,5})\b/);
        if (m2) last4 = m2[1];
      }
    }
    if (!last4) {
      try {
        var u = new URL(window.location.href);
        var op = u.searchParams.get("opaqueAccountId") || "";
        if (op) last4 = op.length > 6 ? op.slice(-6) : op;
      } catch (e) {}
    }
    if (!last4) last4 = "default";
    if (!label) label = "Amex";
    return { cardId: last4, label: label + " ••" + last4 };
  };

  var chaseCardInfo = function () {
    var accountId = "";
    try {
      var hash = window.location.hash || "";
      var qpos = hash.indexOf("?");
      if (qpos > -1) {
        accountId = new URLSearchParams(hash.slice(qpos + 1)).get("accountId") || "";
      }
      if (!accountId) {
        accountId = new URLSearchParams(window.location.search || "").get("accountId") || "";
      }
    } catch (e) {}
    if (!accountId) accountId = "default";
    var short = accountId.length > 6 ? accountId.slice(-6) : accountId;
    return { cardId: accountId, label: "Chase Acct " + short };
  };

  var capOneCardInfo = function () {
    var label = "", last4 = "";
    // Header text format: "Venture X...0881" / "Quicksilver•0123" etc.
    var els = Array.from(document.querySelectorAll('p.text-white, button p, header p'));
    for (var i = 0; i < els.length; i++) {
      var t = (els[i].innerText || els[i].textContent || "").trim();
      if (!t || t.length > 60) continue;
      var m = t.match(/(\d{4})\b/);
      if (m) {
        last4 = m[1];
        var name = t.slice(0, m.index).replace(/[\.••\s]+$/, "").trim();
        label = (name || "Capital One") + " ••" + last4;
        break;
      }
    }
    if (!last4) last4 = "default";
    if (!label) label = "Capital One ••" + last4;
    return { cardId: last4, label: label };
  };

  var updateLastRun = function (count) {
    try {
      window.postMessage({ __uoh: true, type: "UPDATE_LAST_RUN", count: count }, "*");
    } catch (e) {}
  };

  /* Light-weight value parser — gives every saved offer a numeric + type so the
   * popup search can rank "best deals" without re-parsing per render.
   *
   * Rule: the offer's TYPE is whatever the user gets back, never what they
   * spend. "Spend $30, earn 1,500 miles" is a MILES offer (you receive miles),
   * not a DOLLAR offer. We strip the spend clause before classifying so the
   * '$30' in the trigger doesn't mislabel the reward. */
  function parseValue(v) {
    if (!v) return { num: 0, type: "OTHER" };
    var s = String(v).trim();

    // If the offer has spend-then-reward shape, classify only the reward
    // portion. We match the LAST occurrence of "earn|get|receive" so any
    // bonuses-on-top phrasing still ends up on the reward side.
    var sg = s.match(/^.*\b(?:earn|get|receive)\s+(.+)$/i);
    if (sg) s = sg[1];

    var m;
    // MULTIPLIER first — "8X miles", "3X points on dining", bare "5X".
    // Must beat the MILES rule below, otherwise "8X miles" reads as MILES=8.
    if ((m = s.match(/(\d+(?:\.\d+)?)\s*[xX]\b/))) {
      return { num: parseFloat(m[1]), type: "MULTI" };
    }
    // MILES / POINTS — number followed by a points-flavoured noun.
    // Covers "1,500 miles", "5,000 Membership Rewards points", "ThankYou points".
    if ((m = s.match(/([\d,]+(?:\.\d+)?)[^\d%$]{0,40}?\b(?:miles|points|MR\b|membership\s*rewards|thank\s*you|ultimate\s*rewards)/i))) {
      return { num: parseFloat(m[1].replace(/,/g, "")), type: "MILES" };
    }
    // PERCENT — "10% cash back"
    if ((m = s.match(/(\d+(?:\.\d+)?)\s*%/))) {
      return { num: parseFloat(m[1]), type: "PERCENT" };
    }
    // DOLLAR — "$200 cash back" / "$10 back". Last because a stray "$30" in
    // the spend clause would otherwise steal a MILES/PERCENT classification.
    if ((m = s.match(/\$\s*([\d,]+(?:\.\d+)?)/))) {
      return { num: parseFloat(m[1].replace(/,/g, "")), type: "DOLLAR" };
    }
    return { num: 0, type: "OTHER" };
  }

  /* Normalize a per-site expiry string ("Expires 5/18/26", "120d left",
   * "5 days left") into a JS timestamp so the popup can sort by soonest. */
  function parseExpiresTs(text) {
    if (!text) return null;
    var s = String(text).trim();
    // Absolute date: "Expires 5/18/26" or "5/18/2026"
    var m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      var mm = parseInt(m[1], 10), dd = parseInt(m[2], 10), yy = parseInt(m[3], 10);
      if (yy < 100) yy = 2000 + yy;
      var d = new Date(yy, mm - 1, dd);
      return isNaN(d.getTime()) ? null : d.getTime();
    }
    // Relative: "120d left" / "5 days left" / "1d"
    m = s.match(/(\d+)\s*(?:d|day|days)\b/i);
    if (m) {
      var n = parseInt(m[1], 10);
      // End-of-day for the target date so a "1d left" offer doesn't read
      // as already expired the instant the clock crosses midnight.
      var target = new Date();
      target.setDate(target.getDate() + n);
      target.setHours(23, 59, 59, 999);
      return target.getTime();
    }
    return null;
  }

  /* ============================================================ */
  /*                        CHASE  (enhanced)                     */
  /* ============================================================ */
  if (host.indexOf("chase.com") > -1) {
    if (document.getElementById("chase-autopilot-ui")) return;
    var chaseCard = chaseCardInfo();
    // If the user lands directly on Chase's Added Offers page (deep link,
    // back button, bookmark), the available-tile selector returns zero and
    // the original state machine would walk into opening_added, fail to find
    // a "navigate to Added Offers" link (we're already on it!), and exit
    // with no harvest. Detect this case via the added-list-only tile id and
    // jump straight to scraping_added.
    var chaseStartOnAddedPage = !!document.querySelector('[data-testid="added-offer-list-item-container"]')
      && !document.querySelector('[data-cy="commerce-tile"]');
    var ui = document.createElement("div");
    ui.id = "chase-autopilot-ui";
    ui.style.cssText = "position:fixed;bottom:20px;right:20px;width:240px;background:#1c2b36;color:#fff;font-family:sans-serif;font-size:12px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:999999;border:1px solid #455a64;overflow:hidden;";
    ui.innerHTML = '<div style="background:#117ACA;padding:10px;font-weight:700;display:flex;justify-content:space-between;align-items:center;"><span>Chase Autopilot</span><span id="cp-close" style="cursor:pointer;font-size:16px;opacity:0.8;">&times;</span></div><div style="padding:12px;"><div style="margin-bottom:8px;color:#90a4ae;">STATUS</div><div id="cp-status" style="color:#4caf50;font-weight:600;margin-bottom:12px;line-height:1.4;">Starting...</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:center;"><div style="background:#263238;padding:6px;border-radius:4px;"><div id="cp-seen" style="font-weight:700;font-size:14px;">0</div><div style="font-size:10px;color:#78909c;">Visible</div></div><div style="background:#263238;padding:6px;border-radius:4px;"><div id="cp-queue" style="font-weight:700;font-size:14px;color:#ffb74d;">0</div><div style="font-size:10px;color:#78909c;">Queue</div></div><div style="background:#263238;padding:6px;border-radius:4px;"><div id="cp-added" style="font-weight:700;font-size:14px;color:#4caf50;">0</div><div style="font-size:10px;color:#78909c;">Added New</div></div><div style="background:#263238;padding:6px;border-radius:4px;"><div id="cp-pre" style="font-weight:700;font-size:14px;color:#90a4ae;">0</div><div style="font-size:10px;color:#78909c;">Saved</div></div></div></div>';
    document.body.appendChild(ui);

    var state = {
      added: 0, run: true, baselineOld: null,
      phase: chaseStartOnAddedPage ? "scraping_added" : "adding",
      bottomHits: 0, saved: 0, addedPageHits: 0, captureFails: 0,
      waitStart: 0, hashBeforeAdded: "", openAttempts: 0
    };

    // Chase's SPA occasionally rerenders sub-trees that contain our injected
    // panel. Each stat write goes through setText so a missing child element
    // is a silent no-op instead of "Cannot set properties of null".
    var setText = function (id, val) {
      var el = document.getElementById(id);
      if (el) el.innerText = val;
    };
    var update = function (s, t, q, p) {
      if (s) setText("cp-status", s);
      if (t !== undefined) setText("cp-seen", t);
      if (q !== undefined) setText("cp-queue", q);
      setText("cp-added", state.added);
      if (p !== undefined) setText("cp-pre", p);
      updateLastRun(state.added + state.addedPageHits);
    };

    // Chase uses two completely different DOM layouts:
    //
    //   Available list  (host /offerhub/list/all)
    //     <div data-cy="commerce-tile">
    //       <span class="mds-body-small-heavier">{merchant}</span>
    //       <span class="mds-body-large-heavier">{value}</span>
    //
    //   Added Offers list (host /offerhub/added)
    //     <div data-testid="added-offer-list-item-container"
    //          aria-label="<idx> of <total>\n  {merchant}\n  {constraint?}\n\n  {value}\n  {days} days left">
    //       <span class="listItemLabel ...">{merchant}</span>
    //       <span class="listItemLabel ...">{value}</span>
    //       <div data-testid="days-left-banner">{N}d left</div>
    //
    // captureChaseTile must handle both. We parse aria-label first when present
    // (Added Offers tiles always have a clean newline-delimited aria-label) and
    // fall back to the per-layout CSS selectors otherwise.
    var textOf = function (el) { return el ? (el.innerText || el.textContent || "").trim() : ""; };

    var parseAriaLabel = function (tile) {
      var raw = tile.getAttribute("aria-label") || "";
      if (!raw) return null;
      var lines = raw.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      if (lines.length < 2) return null;
      // lines[0] = "1 of 156" (positional) — discard if it matches that shape
      var startIdx = /^\d+\s+of\s+\d+$/i.test(lines[0]) ? 1 : 0;
      if (lines.length <= startIdx) return null;
      var merchant = lines[startIdx];
      var value = "", days = "";
      for (var i = startIdx + 1; i < lines.length; i++) {
        var l = lines[i];
        if (/days?\s*left/i.test(l) && !days) days = l;
        else if (/(\d+(?:\.\d+)?\s*%|\$\s*\d|cash\s*back|miles|points|back)/i.test(l) && !value) value = l;
      }
      if (!merchant || !value) return null;
      return { merchant: merchant, value: value, days: days };
    };

    var captureChaseTile = function (tile, forceStatus) {
      try {
        var merchant = "", value = "", days = "";
        var fromAria = parseAriaLabel(tile);
        if (fromAria) {
          merchant = fromAria.merchant;
          value = fromAria.value;
          days = fromAria.days;
        }
        // Available-list layout fallback
        if (!merchant) merchant = textOf(tile.querySelector(".mds-body-small-heavier"));
        if (!value)    value    = textOf(tile.querySelector(".mds-body-large-heavier"));
        // Added-list span fallback (in case aria-label is ever stripped)
        if (!merchant || !value) {
          var spans = tile.querySelectorAll(".listItemLabel.semanticColorTextRegular");
          if (spans.length >= 2) {
            if (!merchant) merchant = textOf(spans[0]);
            if (!value)    value    = textOf(spans[1]);
          }
        }
        if (!days) {
          var daysEl = tile.querySelector('[data-testid="days-left-banner"]');
          days = daysEl ? daysEl.innerText.trim() : "";
        }
        if (!merchant || !value) { state.captureFails++; return false; }

        var isAddedTile = tile.matches && tile.matches('[data-testid="added-offer-list-item-container"]');
        var isAddedFlag = !!tile.querySelector('[data-testid="offer-tile-alert-container-success"]');
        var status = forceStatus || (isAddedTile || isAddedFlag ? "added" : "available");
        var key = "chase_" + chaseCard.cardId + "_" + merchant.replace(/\W/g, "");
        saveOffer(key, merchant, value, "Chase", {
          days: days, expiresTs: parseExpiresTs(days), status: status,
          card: chaseCard.label, cardId: chaseCard.cardId
        });
        state.saved++;
        return true;
      } catch (e) { state.captureFails++; return false; }
    };

    var queryTiles = function (phase) {
      // The Available and Added pages use different selectors. Query by phase
      // so the queue / waiting / scraping logic doesn't pick up the wrong list.
      if (phase === "adding") {
        return Array.from(document.querySelectorAll('[data-cy="commerce-tile"]'));
      }
      return Array.from(document.querySelectorAll('[data-testid="added-offer-list-item-container"]'));
    };

    var stopWith = function (msg, t) {
      update(msg, t === undefined ? 0 : t, 0, state.saved);
      state.run = false;
      clearInterval(loop);
    };

    var loop = setInterval(function () {
      if (!state.run) return;
      // SPA rerender wiped our panel — there's nothing left to drive or
      // report to. Stop the interval instead of hammering null DOM.
      if (!document.getElementById("chase-autopilot-ui")) {
        state.run = false; clearInterval(loop); return;
      }

      // The 'mds-secondary-back-navbar' Going-back handler ONLY applies during
      // the 'adding' phase — it backs out of accidental offer-detail sub-pages
      // we may have clicked into. After 'opening_added', the Added Offers list
      // itself renders inside the same secondary-back-navbar shell, so auto-
      // clicking Back here would immediately undo our navigation and the
      // harvest would never run.  This was the original bug.
      if (state.phase === "adding") {
        var nav = document.getElementById("mds-secondary-back-navbar");
        if (nav && nav.getBoundingClientRect().width > 0 && nav.shadowRoot) {
          var bb = nav.shadowRoot.getElementById("back-button");
          if (bb) { update("Going back..."); bb.click(); return; }
        }
      }

      if (state.baselineOld === null) {
        var header = document.querySelector('[aria-label$="Added offers"]');
        if (header) {
          var m = header.getAttribute("aria-label").match(/^(\d+)/);
          state.baselineOld = m ? parseInt(m[1]) : 0;
        } else state.baselineOld = 0;
      }

      var tiles = queryTiles(state.phase);

      if (state.phase === "adding") {
        var queue = tiles.filter(function (t) {
          return !t.querySelector('[data-testid="offer-tile-alert-container-success"]')
              && !t.hasAttribute("data-chase-processed");
        });
        var totalScanned = state.added + queue.length;
        update(queue.length > 0 ? "Adding offers..." : "All available added. Loading history...",
               totalScanned, queue.length, state.saved);

        if (queue.length > 0) {
          var target = queue[0];
          target.setAttribute("data-chase-processed", "true");
          target.scrollIntoView({ behavior: "auto", block: "center" });
          captureChaseTile(target);
          var addBtn = target.querySelector('[data-testid="commerce-tile-button"]') || target;
          state.added++;
          update("Adding...");
          var o = { view: window, bubbles: true, cancelable: true };
          addBtn.dispatchEvent(new MouseEvent("mousedown", o));
          addBtn.dispatchEvent(new MouseEvent("mouseup", o));
          addBtn.dispatchEvent(new MouseEvent("click", o));
        } else {
          state.phase = "opening_added";
        }
      } else if (state.phase === "opening_added") {
        var link = document.querySelector('[data-testid="hub-header-addedoffers"]')
                || document.querySelector('a[href*="addedoffers" i]')
                || document.querySelector('[aria-label*="Added offers" i]');
        if (link) {
          update("Opening Added Offers...", state.added, 0, state.saved);
          // Wipe per-tile markers so recycled DOM tiles re-capture on the next view.
          // Chase's SPA frequently reuses tile nodes for both Available and Added
          // lists; without this, every recycled tile is skipped by 'data-chase-saved'.
          document.querySelectorAll("[data-chase-processed],[data-chase-saved]").forEach(function (n) {
            n.removeAttribute("data-chase-processed");
            n.removeAttribute("data-chase-saved");
          });
          state.hashBeforeAdded = window.location.hash || "";
          var o2 = { view: window, bubbles: true, cancelable: true };
          link.dispatchEvent(new MouseEvent("mousedown", o2));
          link.dispatchEvent(new MouseEvent("mouseup", o2));
          link.dispatchEvent(new MouseEvent("click", o2));
          // Fallback in case dispatched events were intercepted
          try { link.click(); } catch (e) {}
          state.phase = "wait_added";
          state.waitStart = Date.now();
          state.openAttempts++;
        } else {
          stopWith("Done. " + state.saved + " saved.", state.added);
        }
      } else if (state.phase === "wait_added") {
        // `tiles` is queried with the added-offer-list-item-container selector
        // (queryTiles returns that for any non-'adding' phase). Its presence is
        // a definitive signal that the Added Offers view has rendered — the hash
        // route doesn't change on this navigation, so we rely on DOM only.
        var elapsed = Date.now() - state.waitStart;
        if (tiles.length > 0 && elapsed > 600) {
          state.phase = "scraping_added";
          state.bottomHits = 0;
        } else if (tiles.length === 0 && elapsed > 2500 && state.openAttempts < 2) {
          // Click was swallowed (no Added Offers tiles appeared). Retry once.
          state.phase = "opening_added";
        } else if (elapsed > 12000) {
          stopWith("Added Offers did not load. " + state.saved + " saved.", tiles.length);
        } else {
          update("Loading Added Offers... (" + tiles.length + " tiles)", tiles.length, 0, state.saved);
        }
      } else if (state.phase === "scraping_added") {
        // Pure text-scrape — we never click these tiles, so pace it like one.
        // Jump straight to the bottom of the page on every tick (cheap; no-op
        // if already there). If Chase virtualizes the list, the new tiles
        // render under the existing ones and we sweep them on the next tick.
        // Stop when a sweep produces no new saves twice in a row.
        window.scrollTo(0, document.body.scrollHeight);
        var newSaves = 0;
        tiles.forEach(function (tile) {
          if (!tile.hasAttribute("data-chase-saved")) {
            tile.setAttribute("data-chase-saved", "true");
            if (captureChaseTile(tile, "added")) { state.addedPageHits++; newSaves++; }
          }
        });
        update("Harvested " + state.addedPageHits + " of " + tiles.length + " added offers...",
               tiles.length, 0, state.saved);
        if (newSaves === 0) {
          state.bottomHits++;
          if (state.bottomHits >= 2) {
            var msg = "Done. " + state.added + " added, " + state.addedPageHits + " from history.";
            if (state.captureFails > 0) msg += " (" + state.captureFails + " skipped)";
            stopWith(msg, tiles.length);
          }
        } else {
          state.bottomHits = 0;
        }
      }
    }, 400);

    document.getElementById("cp-close").onclick = function () {
      state.run = false; clearInterval(loop); ui.remove();
    };
    return;
  }

  /* ============================================================ */
  /*                        AMEX  (enhanced)                      */
  /* ============================================================ */
  //
  // Amex flow (two physically distinct pages, joined by a hard navigation):
  //
  //   /offers (main hub)         Available offer tiles render with
  //                              <button data-testid="merchantOfferListAddButton">.
  //                              The "Added to Card" strip has a "View All" anchor
  //                                <a id="added-view-more-header"
  //                                   href="/offers/enrolled?opaqueAccountId=...">
  //                              that links to the full Added Offers page.
  //
  //   /offers/enrolled           Server-rendered full list of every added offer.
  //                              Each row carries
  //                                [data-testid="merchantOfferSuccessIcon"]
  //                              with merchant in
  //                                h3.heading-sans-small-medium span
  //                              and value in the second
  //                                [data-testid="overflowTextContainer"] span.
  //
  // Clicking View All performs a hard navigation. To survive the reload and
  // continue harvesting on the enrolled page, the extension auto-injects this
  // file on `/offers/enrolled*` via manifest content_scripts and we hand off
  // state through sessionStorage:
  //
  //   UOH_PopupTrigger  set by popup.js right before chrome.scripting.execute.
  //                     Distinguishes "user pressed Run" from a passive content-
  //                     script auto-inject during normal browsing. Consumed on
  //                     first scraper entry.
  //
  //   UOH_AmexResume    set by the autopilot just before navigating from /offers
  //                     to /offers/enrolled. The auto-injected scraper on the
  //                     new page reads it to know "we're resuming a run, jump
  //                     straight to harvest". Cleared once harvest finishes.
  //
  //   UOH_AmexAddedRun  carry-over count of offers added on the previous page,
  //                     so the harvest-page UI can still display it.
  //
  if (host.indexOf("americanexpress.com") > -1) {
    // Detect the enrolled / Added-Offers page via DOM markers, not just URL —
    // the user may land here through a non-canonical route (deep link, bookmark
    // with extra params, search-result click) and the URL form isn't a stable
    // contract. merchantOfferSuccessIcon appears once per added offer and
    // never on the main /offers hub, so it's our authoritative signal.
    var amexPath = window.location.pathname;
    var isEnrolledPage = /\/offers\/enrolled/i.test(amexPath)
      || !!document.querySelector('[data-testid="merchantOfferSuccessIcon"], [data-testid="addedToCardViewAllContainer"]');

    // Tell a real popup-triggered run apart from passive auto-inject.
    var popupTriggerTs = 0;
    try { popupTriggerTs = parseInt(sessionStorage.getItem("UOH_PopupTrigger") || "0", 10); } catch (e) {}
    var hasPopupTrigger = popupTriggerTs && (Date.now() - popupTriggerTs) < 15000;
    if (hasPopupTrigger) { try { sessionStorage.removeItem("UOH_PopupTrigger"); } catch (e) {} }

    var hasResumeFlag = false;
    try { hasResumeFlag = sessionStorage.getItem("UOH_AmexResume") === "1"; } catch (e) {}

    // Auto-inject (no trigger, no resume) on the enrolled page = a normal user
    // browsing their added offers. Don't pop the autopilot UI for that.
    if (isEnrolledPage && !hasPopupTrigger && !hasResumeFlag) return;

    if (document.getElementById("amex-autopilot-ui")) return;
    var amexCard = amexCardInfo();
    var aui = document.createElement("div");
    aui.id = "amex-autopilot-ui";
    aui.style.cssText = "position:fixed;bottom:20px;right:20px;width:240px;background:#1c2b36;color:#fff;font-family:sans-serif;font-size:12px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:999999;border:1px solid #455a64;overflow:hidden;";
    aui.innerHTML = '<div style="background:#006FCF;padding:10px;font-weight:700;display:flex;justify-content:space-between;align-items:center;"><span>Amex Autopilot</span><span id="cp-close" style="cursor:pointer;font-size:16px;opacity:0.8;">&times;</span></div><div style="padding:12px;"><div style="margin-bottom:8px;color:#90a4ae;">STATUS</div><div id="cp-status" style="color:#4caf50;font-weight:600;margin-bottom:12px;line-height:1.4;">Starting...</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:center;"><div style="background:#263238;padding:6px;border-radius:4px;"><div id="cp-seen" style="font-weight:700;font-size:14px;">0</div><div style="font-size:10px;color:#78909c;">Scanned</div></div><div style="background:#263238;padding:6px;border-radius:4px;"><div id="cp-queue" style="font-weight:700;font-size:14px;color:#ffb74d;">0</div><div style="font-size:10px;color:#78909c;">Queue</div></div><div style="background:#263238;padding:6px;border-radius:4px;"><div id="cp-added" style="font-weight:700;font-size:14px;color:#4caf50;">0</div><div style="font-size:10px;color:#78909c;">Added New</div></div><div style="background:#263238;padding:6px;border-radius:4px;"><div id="cp-pre" style="font-weight:700;font-size:14px;color:#90a4ae;">0</div><div style="font-size:10px;color:#78909c;">Saved</div></div></div></div>';
    document.body.appendChild(aui);

    // Restore "added" count across the page navigation so the right-side UI
    // still shows what we did on the previous page after auto-resume.
    var carriedAdded = 0;
    try { carriedAdded = parseInt(sessionStorage.getItem("UOH_AmexAddedRun") || "0", 10) || 0; } catch (e) {}

    var astate = {
      added: carriedAdded, run: true, baselineOld: null, saved: 0,
      phase: isEnrolledPage ? "scraping_added" : "adding",
      addedPageHits: 0, bottomHits: 0, navStart: 0
    };

    var setAText = function (id, val) {
      var el = document.getElementById(id);
      if (el) el.innerText = val;
    };
    var aupdate = function (s, t, q, p) {
      if (s) setAText("cp-status", s);
      if (t !== undefined) setAText("cp-seen", t);
      if (q !== undefined) setAText("cp-queue", q);
      setAText("cp-added", astate.added);
      if (p !== undefined) setAText("cp-pre", p);
      updateLastRun(astate.added + astate.addedPageHits);
    };

    var amexOldCount = function () {
      var container = document.querySelector('[data-testid="addedToCardContainer"]');
      if (container) {
        var spans = Array.from(container.querySelectorAll("span"));
        var target = spans.find(function (s) { return s.innerText.indexOf("Added to Card") > -1; });
        if (target) {
          var m = target.innerText.match(/\((\d+)\)/);
          if (m) return parseInt(m[1]);
        }
      }
      return null;
    };

    var amexTextOf = function (el) { return el ? (el.innerText || el.textContent || "").trim() : ""; };

    var findViewAll = function () {
      return document.getElementById("added-view-more-header")
          || document.querySelector('a[aria-label="View All"][href*="/offers/enrolled"]')
          || document.querySelector('a[href*="/offers/enrolled"]');
    };

    // Walk up from a success-icon span to the nearest ancestor that also
    // contains the merchant <h3>. This is the per-tile container regardless of
    // whether Amex is in list-view (_listViewRow_*) or grid-view markup.
    var addedTileFromIcon = function (iconEl) {
      var n = iconEl;
      for (var i = 0; i < 14 && n; i++) {
        n = n.parentElement;
        if (n && n.querySelector("h3.heading-sans-small-medium span")) return n;
      }
      return null;
    };

    var harvestAddedTile = function (tile) {
      try {
        var h3 = tile.querySelector("h3.heading-sans-small-medium span")
              || tile.querySelector("h3 span");
        var merchant = amexTextOf(h3);
        var bodyContainers = tile.querySelectorAll('[data-testid="overflowTextContainer"]');
        var value = "";
        if (bodyContainers && bodyContainers.length >= 2) {
          var valSpan = bodyContainers[1].querySelector("span");
          value = amexTextOf(valSpan) || amexTextOf(bodyContainers[1]);
        }
        if (!value) {
          // Grid-view fallback
          var grid = tile.querySelector(".body-1.text-truncate span");
          if (grid) value = amexTextOf(grid);
        }
        var daysEl = tile.querySelector(".color-status-text-critical");
        var days = amexTextOf(daysEl);
        if (!merchant || !value) return false;
        saveOffer(
          "amex_" + amexCard.cardId + "_" + merchant.replace(/\W/g, ""),
          merchant, value, "Amex",
          {
            status: "added", days: days, expiresTs: parseExpiresTs(days),
            card: amexCard.label, cardId: amexCard.cardId
          }
        );
        astate.saved++;
        return true;
      } catch (e) { return false; }
    };

    var stopAmex = function (msg) {
      try { sessionStorage.removeItem("UOH_AmexResume"); } catch (e) {}
      try { sessionStorage.removeItem("UOH_AmexAddedRun"); } catch (e) {}
      aupdate(msg, undefined, 0, astate.saved);
      astate.run = false; clearInterval(aloop);
    };

    var aloop = setInterval(function () {
      if (!astate.run) return;
      if (!document.getElementById("amex-autopilot-ui")) {
        astate.run = false; clearInterval(aloop); return;
      }

      if (astate.phase === "adding") {
        if (astate.baselineOld === null) {
          astate.baselineOld = amexOldCount();
          if (astate.baselineOld === null) astate.baselineOld = 0;
        }
        var buttons = Array.from(document.querySelectorAll('button[data-testid="merchantOfferListAddButton"]'));
        var queue = buttons.filter(function (b) { return !b.hasAttribute("data-amex-processed"); });
        var totalScanned = astate.added + queue.length;
        aupdate(queue.length > 0 ? "Adding offers..." : "All available added. Loading history...",
                totalScanned, queue.length, astate.saved);

        if (queue.length > 0) {
          var btn = queue[0];
          btn.setAttribute("data-amex-processed", "true");
          btn.scrollIntoView({ behavior: "auto", block: "center" });
          try {
            var card = btn.closest(".flex-justify-between.flex-item-grow") || btn.closest(".row");
            var merchant = card.querySelector(".heading-sans-small-medium span").innerText.trim();
            var value = card.querySelector(".body.color-text-regular span").innerText.trim();
            var expiryEl = card.querySelector(".color-status-text-critical");
            var expiryTxt = expiryEl ? (expiryEl.innerText || "").trim() : "";
            saveOffer(
              "amex_" + amexCard.cardId + "_" + merchant.replace(/\W/g, ""),
              merchant, value, "Amex",
              {
                status: "available", days: expiryTxt, expiresTs: parseExpiresTs(expiryTxt),
                card: amexCard.label, cardId: amexCard.cardId
              }
            );
          } catch (e) {}
          astate.added++;
          aupdate("Adding...");
          var o2 = { view: window, bubbles: true, cancelable: true };
          btn.dispatchEvent(new MouseEvent("mousedown", o2));
          btn.dispatchEvent(new MouseEvent("mouseup", o2));
          btn.dispatchEvent(new MouseEvent("click", o2));
        } else {
          astate.phase = "opening_added";
        }
      } else if (astate.phase === "opening_added") {
        var link = findViewAll();
        if (!link) { stopAmex("Done. No View All link found."); return; }
        aupdate("Opening Added Offers...", astate.added, 0, astate.saved);
        try { sessionStorage.setItem("UOH_AmexResume", "1"); } catch (e) {}
        try { sessionStorage.setItem("UOH_AmexAddedRun", String(astate.added)); } catch (e) {}
        astate.navStart = Date.now();
        astate.phase = "wait_enrolled";
        try {
          link.scrollIntoView({ behavior: "auto", block: "center" });
          var o3 = { view: window, bubbles: true, cancelable: true };
          link.dispatchEvent(new MouseEvent("mousedown", o3));
          link.dispatchEvent(new MouseEvent("mouseup", o3));
          link.dispatchEvent(new MouseEvent("click", o3));
        } catch (e) {}
      } else if (astate.phase === "wait_enrolled") {
        // SPA route: URL switches but this script stays alive. Hard nav: script
        // dies and the content_scripts auto-inject revives us on /offers/enrolled
        // — that fresh instance starts in scraping_added directly. This branch
        // only fires if the click was a soft SPA route or the navigation stalled.
        var elapsed = Date.now() - astate.navStart;
        if (/\/offers\/enrolled/i.test(window.location.pathname)) {
          astate.phase = "scraping_added";
          astate.bottomHits = 0;
        } else if (elapsed > 4000) {
          // Click was swallowed (overlay, etc.) — force the navigation.
          var lk = findViewAll();
          if (lk && lk.href) {
            try { window.location.href = lk.href; } catch (e) {}
            astate.navStart = Date.now() + 60000; // suppress retry
          } else {
            stopAmex("Could not open Added Offers page.");
          }
        } else {
          aupdate("Waiting for Added Offers page...", astate.added, 0, astate.saved);
        }
      } else if (astate.phase === "scraping_added") {
        // The enrolled page server-renders every tile in one go (no pagination,
        // no virtualization), so this is a single-pass text scrape, not a
        // scroll-paced clip loop. We do one full sweep per tick, mark each tile
        // with data-amex-saved so subsequent ticks are no-ops, and stop the
        // moment a sweep produces zero new saves (with a short DOM-ready wait
        // so we don't bail before the list paints).
        var iconNodes = Array.from(document.querySelectorAll('[data-testid="merchantOfferSuccessIcon"]'));
        if (iconNodes.length === 0) {
          astate.bottomHits++;
          if (astate.bottomHits > 30) {
            stopAmex("Timed out waiting for Added Offers list.");
          } else {
            aupdate("Loading Added Offers list...", 0, 0, astate.saved);
          }
          return;
        }
        var newSaves = 0;
        for (var i = 0; i < iconNodes.length; i++) {
          var t = addedTileFromIcon(iconNodes[i]);
          if (t && !t.hasAttribute("data-amex-saved")) {
            t.setAttribute("data-amex-saved", "true");
            if (harvestAddedTile(t)) { astate.addedPageHits++; newSaves++; }
          }
        }
        aupdate("Harvested " + astate.addedPageHits + " of " + iconNodes.length + " added offers...",
                iconNodes.length, 0, astate.saved);
        if (newSaves === 0) {
          // No new tiles on this pass — we're done. (One pass usually saves
          // everything; this branch fires on the second tick to confirm.)
          stopAmex("Done. " + astate.added + " added, " + astate.addedPageHits + " from history.");
        } else {
          astate.bottomHits = 0;
        }
      }
    }, 250);

    document.getElementById("cp-close").onclick = function () {
      try { sessionStorage.removeItem("UOH_AmexResume"); } catch (e) {}
      try { sessionStorage.removeItem("UOH_AmexAddedRun"); } catch (e) {}
      astate.run = false; clearInterval(aloop); aui.remove();
    };
    return;
  }

  /* ============================================================ */
  /*                       CAPITAL ONE                            */
  /* ============================================================ */
  if (host.indexOf("capitalone.com") > -1 || host.indexOf("capitaloneoffers.com") > -1) {
    var c1Card = capOneCardInfo();
    var C1_STYLES = "#c1-scraper-root{font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;position:fixed;z-index:2147483647;top:10px;left:10px;background:#fff;box-shadow:0 10px 40px rgba(0,0,0,0.3);border-radius:12px;display:flex;flex-direction:column;overflow:hidden;border:1px solid #ddd;transition:all .3s ease;right:10px;bottom:10px;max-width:1000px;max-height:850px;margin:auto}#c1-scraper-root.minimized{width:180px;height:40px;top:auto;left:auto;bottom:20px;right:20px;border-radius:20px;cursor:pointer;background:#004879;box-shadow:0 4px 10px rgba(0,0,0,0.3);border:2px solid #fff}#c1-scraper-root.minimized *{display:none}#c1-scraper-root.minimized .min-label{display:flex!important;color:#fff;font-weight:700;width:100%;height:100%;align-items:center;justify-content:center;font-size:14px;text-transform:uppercase;letter-spacing:0.5px}.c1-header{background:#004879;color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;cursor:grab}.c1-controls{display:flex;gap:8px}.c1-btn-icon{background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:4px;cursor:pointer;padding:2px 8px;font-size:14px}.c1-stats{background:#f4f4f4;padding:8px 12px;font-size:12px;border-bottom:1px solid #e0e0e0;display:flex;flex-wrap:wrap;gap:10px;justify-content:space-around;flex-shrink:0}.c1-stat-item b{color:#004879}.c1-toolbar{padding:10px;border-bottom:1px solid #eee;background:#fff;flex-shrink:0;display:flex;flex-direction:column;gap:10px}.c1-search{width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px;box-sizing:border-box}.c1-filter-group{display:flex;flex-wrap:wrap;gap:6px;max-height:80px;overflow-y:auto;padding-bottom:4px}.c1-chip{padding:4px 10px;font-size:11px;border:1px solid #ccc;background:#f9f9f9;color:#555;border-radius:12px;cursor:pointer;transition:all .2s;user-select:none}.c1-chip:hover{background:#eee;border-color:#bbb}.c1-chip.active{background:#004879;color:#fff;border-color:#004879;font-weight:600;box-shadow:0 2px 4px rgba(0,72,121,0.2)}.c1-chip.tag-new.active{background:#FF8C00;border-color:#FF8C00;color:#000}.c1-chip.tag-excl.active{background:#4CAF50;border-color:#4CAF50}.c1-chip.tag-bonus.active{background:#7C3AED;border-color:#7C3AED;color:#fff}.c1-sort-group{display:flex;gap:5px;justify-content:space-between;margin-top:4px}.c1-sort-btn{flex:1;padding:6px 2px;font-size:11px;border:1px solid #004879;background:#fff;color:#004879;border-radius:4px;cursor:pointer;transition:all .2s;text-align:center}.c1-sort-btn.active{background:#004879;color:#fff}.c1-export-btn{padding:6px 12px;font-size:12px;border:1px solid #2e7d32;background:#fff;color:#2e7d32;border-radius:4px;cursor:pointer;font-weight:bold;transition:all .2s;white-space:nowrap}.c1-export-btn:hover{background:#2e7d32;color:#fff}.c1-table-wrapper{flex-grow:1;overflow-y:auto;position:relative}table{width:100%;border-collapse:collapse;font-size:13px}thead{position:sticky;top:0;background:#fff;z-index:10;box-shadow:0 1px 2px rgba(0,0,0,.1)}th{text-align:center;padding:10px 8px;color:#555;font-weight:600;border-bottom:2px solid #eee;cursor:pointer;user-select:none}th:first-child{text-align:left}th#th-v{text-align:center}th:hover{background:#f9f9f9}td{padding:8px;border-bottom:1px solid #f0f0f0;color:#333;vertical-align:middle}tr:hover{background-color:#f0f8ff;cursor:pointer}.col-val{font-weight:700;color:#2e7d32;text-align:center}.val-container{display:flex;align-items:center;justify-content:center;gap:8px}.col-chan{text-align:center;font-size:11px;color:#666}.tag-badge{font-size:10px;padding:2px 6px;border-radius:4px;text-transform:uppercase;color:#fff;font-weight:bold;white-space:nowrap;box-shadow:0 1px 2px rgba(0,0,0,0.1)}.tag-new{background-color:#FF8C0020;color:#000}.ltag-new{background-color:#FF8C00;color:#000}.tag-excl{background-color:#4CAF5020}.ltag-excl{background-color:#4CAF50}.tag-bonus{background-color:#7C3AED20}.ltag-bonus{background-color:#7C3AED}.min-label{display:none}";
    var s = document.createElement("style"); s.textContent = C1_STYLES; document.head.appendChild(s);

    var st = { offers: new Map(), sortMode: "MILES", valSortDir: "DESC", search: "", isLoading: true, uiMinimized: false, activeFilters: new Set(["ALL"]) };
    var FILTERS = [
      { id: "ALL", label: "All" },
      { id: "NEW", label: "New", isTag: true },
      { id: "EXCLUSIVE", label: "Exclusive", isTag: true },
      { id: "BONUS", label: "Bonus", isTag: true }
    ];

    var el = function (t, p, c) {
      p = p || {}; c = c || [];
      var e = document.createElement(t);
      Object.entries(p).forEach(function (kv) {
        var k = kv[0], v = kv[1];
        if (k.startsWith("on")) e.addEventListener(k.substring(2).toLowerCase(), v);
        else if (k === "style") e.style.cssText = v;
        else e.setAttribute(k, v);
      });
      c.forEach(function (n) { typeof n === "string" ? e.appendChild(document.createTextNode(n)) : e.appendChild(n); });
      return e;
    };

    var reactClick = async function (e) {
      if (!e) return;
      e.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      await new Promise(function (r) { setTimeout(r, 100); });
      ["mouseover", "mousedown", "mouseup", "click"].forEach(function (t) {
        e.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, buttons: 1 }));
      });
      var k = Object.keys(e).find(function (k) { return k.startsWith("__reactProps") || k.startsWith("__reactFiber"); });
      if (k && e[k]) {
        var p = e[k].memoizedProps || e[k].props;
        if (p && p.onClick) p.onClick({ stopPropagation: function () {}, preventDefault: function () {} });
        else if (p && p.children && p.children.props && p.children.props.onClick)
          p.children.props.onClick({ stopPropagation: function () {}, preventDefault: function () {} });
      }
    };

    var parse = function (n) {
      var img = n.querySelector("img"), m = "Unknown";
      if (img) {
        if (img.alt && img.alt.indexOf("logo") === -1) m = img.alt;
        else if (img.src && img.src.indexOf("domain=") > -1) {
          try { m = new URL(img.src).searchParams.get("domain").split(".").slice(0, -1).join(" "); } catch (e) {}
        }
      }
      m = m.charAt(0).toUpperCase() + m.slice(1);
      var rawTxt = n.innerText || n.textContent || "";
      var vEl = n.querySelector('[style*="color: rgb(37, 129, 14)"]');
      if (!vEl) {
        var cands = Array.from(n.querySelectorAll(".font-semibold"));
        vEl = cands.find(function (el) {
          var t = el.innerText.toLowerCase();
          return t.indexOf("miles") > -1 || t.indexOf("points") > -1 || t.indexOf("back") > -1 || t.indexOf("spend") > -1;
        });
      }
      var vStr = vEl ? vEl.innerText : rawTxt;
      var reS = /Spend\s*\$([\d,]+).*?(?:earn|get)\s*([\d,]+)/is,
          reM = /([\d,.]+)\s*(X|%)/i,
          reMi = /(?:Up to\s*)?([\d,.]+)\s*(?:miles|points|cash)/i;
      if (!vEl) {
        var lines = rawTxt.split("\n");
        vStr = lines.find(function (l) { return reM.test(l) || reMi.test(l) || reS.test(l); }) || "Check Offer";
      }
      var type = "OTHER", num = 0, clean = vStr.replace(/\n/g, " ").trim(), ma;
      if (reS.test(vStr)) { type = "SPEND_GET"; ma = vStr.match(reS); if (ma) num = parseFloat(ma[2].replace(/,/g, "")); }
      else if (reM.test(vStr)) { type = "MULTI"; ma = vStr.match(reM); if (ma) num = parseFloat(ma[1].replace(/,/g, "")); }
      else if (reMi.test(vStr)) { type = "MILES"; ma = vStr.match(reMi); if (ma) num = parseFloat(ma[1].replace(/,/g, ""));
        if (rawTxt.toLowerCase().indexOf("up to") > -1 && clean.toLowerCase().indexOf("up to") === -1) clean = "Up to " + clean; }
      var ch = "Online";
      if (rawTxt.toLowerCase().indexOf("in-store") > -1) ch = "In-Store";
      if (rawTxt.toLowerCase().indexOf("in-store") > -1 && (rawTxt.toLowerCase().indexOf("online") > -1 || rawTxt.toLowerCase().indexOf("web") > -1)) ch = "Both";
      var badgeEl = n.querySelector(".absolute.-top-\\[5px\\]"), badge = "";
      if (badgeEl) {
        var bTxt = badgeEl.innerText.toLowerCase();
        if (bTxt.indexOf("new") > -1) badge = "NEW";
        else if (bTxt.indexOf("exclusive") > -1) badge = "EXCLUSIVE";
        else if (bTxt.indexOf("bonus") > -1) badge = "BONUS";
      }
      var sig = m.toLowerCase() + "_" + clean.replace(/[^a-z0-9]/gi, "");
      if (!n.dataset.sid) n.dataset.sid = "o-" + Math.random().toString(36).substr(2, 9);
      return { id: n.dataset.sid, sig: sig, m: m, v: clean, t: type, n: num, c: ch, r: rawTxt.toLowerCase(), b: badge, el: n };
    };

    var getRoot = function () { return document.getElementById("c1-scraper-root"); };
    var minimizeUI = function () { var r = getRoot(); if (r) r.classList.add("minimized"); st.uiMinimized = true; };
    var maximizeUI = function () { var r = getRoot(); if (r) r.classList.remove("minimized"); st.uiMinimized = false; };

    var scrape = function () {
      document.querySelectorAll('div[class*="tile"], div[data-testid^="feed-tile"], div.standard-tile').forEach(function (n) {
        var d = parse(n);
        if (d.v && d.v !== "Check Offer") {
          if (st.offers.has(d.sig)) {
            var ex = st.offers.get(d.sig);
            if (d.c === "Both" || (d.c === "In-Store" && ex.c === "Online") || (d.c === "Online" && ex.c === "In-Store")) ex.c = "Both";
          } else {
            st.offers.set(d.sig, d);
            saveOffer(
              "cap1_" + c1Card.cardId + "_" + d.m.replace(/\W/g, ""),
              d.m, d.v, "Capital One",
              { channel: d.c, badge: d.b, status: "available", card: c1Card.label, cardId: c1Card.cardId }
            );
          }
        }
      });
      render(); upStats();
    };

    var render = function () {
      var b = document.getElementById("c1-tbody"); if (!b) return;
      var i = Array.from(st.offers.values());
      if (st.search) i = i.filter(function (o) {
        return o.m.toLowerCase().indexOf(st.search.toLowerCase()) > -1
            || o.r.indexOf(st.search.toLowerCase()) > -1
            || o.b.toLowerCase().indexOf(st.search.toLowerCase()) > -1;
      });
      if (!st.activeFilters.has("ALL")) i = i.filter(function (o) { return o.b && st.activeFilters.has(o.b); });
      var rank = function (t) {
        var order = { MILES: ["MILES","MULTI","SPEND_GET"], MULTI: ["MULTI","MILES","SPEND_GET"], SPEND_GET: ["SPEND_GET","MILES","MULTI"] }[st.sortMode];
        if (!order) return 0;
        var idx = order.indexOf(t);
        return idx === -1 ? 3 : idx;
      };
      i.sort(function (a, b) {
        if (st.sortMode === "AZ") return a.m.localeCompare(b.m);
        var ra = rank(a.t), rb = b.t ? rank(b.t) : 9;
        if (ra !== rb) return ra - rb;
        if (st.valSortDir && a.t === b.t) {
          if (st.valSortDir === "DESC") return b.n - a.n;
          if (st.valSortDir === "ASC") return a.n - b.n;
        }
        return a.m.localeCompare(b.m);
      });
      var arrow = st.valSortDir === "DESC" ? " ↓" : st.valSortDir === "ASC" ? " ↑" : "";
      var hv = document.getElementById("th-v");
      if (hv) hv.innerHTML = "Value" + (st.sortMode === "AZ" ? "" : arrow);
      b.innerHTML = i.map(function (o) {
        var bg = o.b === "NEW" ? '<span class="tag-badge ltag-new">NEW</span>'
               : o.b === "EXCLUSIVE" ? '<span class="tag-badge ltag-excl">EXCLUSIVE</span>'
               : o.b === "BONUS" ? '<span class="tag-badge ltag-bonus">BONUS</span>' : "";
        return '<tr onclick="window.c1Clk(\'' + o.id + '\')"><td><b>' + o.m + "</b></td><td class=\"col-val\"><div class=\"val-container\">" + bg + "<span>" + o.v + "</span></div></td><td class=\"col-chan\">" + o.c + "</td></tr>";
      }).join("");
    };

    var upStats = function () {
      var a = Array.from(st.offers.values());
      document.getElementById("st-t").innerText = a.length;
      document.getElementById("st-m").innerText = a.filter(function (x) { return x.t === "MILES"; }).length;
      document.getElementById("st-x").innerText = a.filter(function (x) { return x.t === "MULTI"; }).length;
      document.getElementById("st-s").innerText = a.filter(function (x) { return x.t === "SPEND_GET"; }).length;
      document.getElementById("st-o").innerText = a.filter(function (x) { return x.t === "OTHER"; }).length;
      updateLastRun(a.length);
    };

    var loader = async function () {
      var txt = "View More Offers", att = 0;
      while (st.isLoading) {
        scrape();
        var btn = Array.from(document.querySelectorAll("button")).find(function (b) { return b.innerText.indexOf(txt) > -1; });
        if (btn) {
          document.getElementById("c1-ti").innerText = "Loading... (" + st.offers.size + ")";
          btn.scrollIntoView({ block: "center" });
          await new Promise(function (r) { setTimeout(r, 500); });
          await reactClick(btn);
          await new Promise(function (r) { setTimeout(r, 1000); });
          att = 0;
        } else {
          att++;
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise(function (r) { setTimeout(r, 750); });
          if (att > 3) { st.isLoading = false; document.getElementById("c1-ti").innerText = "Done (" + st.offers.size + ")"; }
        }
      }
    };

    var exportCSV = function () {
      if (st.offers.size === 0) { alert("No data to export"); return; }
      var h = ["Merchant","Value","Type","Channel","Badge"];
      var rows = [h.join(",")];
      st.offers.forEach(function (o) {
        var f = [o.m, o.v, o.t, o.c, o.b].map(function (x) { return '"' + String(x || "").replace(/"/g, '""') + '"'; });
        rows.push(f.join(","));
      });
      var blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
      var u = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = u; a.download = "capitalone_offers.csv"; a.style.display = "none";
      document.body.appendChild(a); a.dispatchEvent(new MouseEvent("click"));
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(u); }, 200);
    };

    window.c1Clk = function (id) {
      var el = document.querySelector('[data-sid="' + id + '"]');
      if (el) { reactClick(el); minimizeUI(); } else { alert("Offer element lost. Try scrolling to it."); }
    };
    window.c1Sort = function (m) {
      st.sortMode = m;
      document.querySelectorAll(".c1-sort-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.m === m); });
      render();
    };
    window.c1ValSort = function () {
      st.valSortDir = st.valSortDir === null ? "DESC" : st.valSortDir === "DESC" ? "ASC" : null;
      render();
    };
    window.c1ToggleFilter = function (fid) {
      if (fid === "ALL") { st.activeFilters.clear(); st.activeFilters.add("ALL"); }
      else {
        st.activeFilters.delete("ALL");
        st.activeFilters.has(fid) ? st.activeFilters.delete(fid) : st.activeFilters.add(fid);
        if (st.activeFilters.size === 0) st.activeFilters.add("ALL");
      }
      document.querySelectorAll(".c1-chip").forEach(function (c) { c.classList.toggle("active", st.activeFilters.has(c.dataset.fid)); });
      render();
    };

    var initC1 = function () {
      var old = document.getElementById("c1-scraper-root"); if (old) old.remove();
      var root = el("div", { id: "c1-scraper-root" });
      var h = el("div", { class: "c1-header" }, [
        el("span", { id: "c1-ti", style: "font-weight:bold" }, ["Capital One Sorter"]),
        el("div", { class: "c1-controls" }, [
          el("button", { class: "c1-btn-icon", onclick: function () { minimizeUI(); } }, ["_"]),
          el("button", { class: "c1-btn-icon", onclick: function () { root.remove(); st.isLoading = false; } }, ["X"])
        ])
      ]);
      root.appendChild(el("div", { class: "min-label", onclick: function () { maximizeUI(); } }, ["CapitalOne Offers"]));
      var sBox = el("div", { class: "c1-stats" });
      sBox.innerHTML = '<span class="c1-stat-item">Total: <b id="st-t">0</b></span> <span class="c1-stat-item">Miles: <b id="st-m">0</b></span> <span class="c1-stat-item">% / X: <b id="st-x">0</b></span> <span class="c1-stat-item">Spend/Get: <b id="st-s">0</b></span> <span class="c1-stat-item">Other: <b id="st-o">0</b></span>';
      var tb = el("div", { class: "c1-toolbar" });
      var topRow = el("div", { style: "display:flex;gap:8px;align-items:center" }, [
        el("input", { class: "c1-search", style: "flex-grow:1", placeholder: "Search merchant...", oninput: function (e) { st.search = e.target.value; render(); } }),
        el("button", { class: "c1-export-btn", onclick: function () { exportCSV(); } }, ["Export CSV"])
      ]);
      var fg = el("div", { class: "c1-filter-group" });
      FILTERS.forEach(function (f) {
        var cls = "c1-chip";
        if (f.id === "ALL") cls += " active";
        if (f.id === "NEW") cls += " tag-new";
        if (f.id === "EXCLUSIVE") cls += " tag-excl";
        if (f.id === "BONUS") cls += " tag-bonus";
        fg.appendChild(el("div", { class: cls, "data-fid": f.id, onclick: function () { window.c1ToggleFilter(f.id); } }, [f.label]));
      });
      var sg = el("div", { class: "c1-sort-group" });
      [{ l: "Miles", m: "MILES" }, { l: "% / X", m: "MULTI" }, { l: "Spend/Get", m: "SPEND_GET" }, { l: "A-Z", m: "AZ" }].forEach(function (o, i) {
        sg.appendChild(el("button", { class: "c1-sort-btn " + (i === 0 ? "active" : ""), "data-m": o.m, onclick: function () { window.c1Sort(o.m); } }, [o.l]));
      });
      tb.appendChild(topRow); tb.appendChild(fg); tb.appendChild(sg);
      var tw = el("div", { class: "c1-table-wrapper" });
      tw.innerHTML = '<table><thead><tr><th width="40%">Merchant</th><th width="40%" id="th-v" onclick="window.c1ValSort()">Value</th><th width="20%">Channel</th></tr></thead><tbody id="c1-tbody"></tbody></table>';
      root.appendChild(h); root.appendChild(sBox); root.appendChild(tb); root.appendChild(tw);
      document.body.appendChild(root);
      var d = false, sx, sy, ix, iy;
      h.onmousedown = function (e) {
        if (e.target.tagName === "BUTTON") return;
        d = true; sx = e.clientX; sy = e.clientY; ix = root.offsetLeft; iy = root.offsetTop; root.style.right = "auto";
      };
      document.onmousemove = function (e) { if (!d) return; root.style.left = (ix + e.clientX - sx) + "px"; root.style.top = (iy + e.clientY - sy) + "px"; };
      document.onmouseup = function () { d = false; };
      loader();
    };
    initC1();
    return;
  }

  /* ============================================================ */
  /*                         WALGREENS                            */
  /* ============================================================ */
  if (host.indexOf("walgreens.com") > -1) {
    if (document.getElementById("walg-autopilot-ui")) return;
    var wui = document.createElement("div");
    wui.id = "walg-autopilot-ui";
    wui.style.cssText = "position:fixed;bottom:20px;right:20px;width:240px;background:#1c2b36;color:#fff;font-family:sans-serif;font-size:12px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:999999;border:1px solid #455a64;overflow:hidden;";
    wui.innerHTML = '<div style="background:#E31837;padding:10px;font-weight:700;display:flex;justify-content:space-between;align-items:center;"><span>Walgreens Autopilot</span><span id="cp-close" style="cursor:pointer;font-size:16px;opacity:0.8;">&times;</span></div><div style="padding:12px;"><div style="margin-bottom:8px;color:#90a4ae;">STATUS</div><div id="cp-status" style="color:#4caf50;font-weight:600;margin-bottom:12px;line-height:1.4;">Starting...</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:center;"><div style="background:#263238;padding:6px;border-radius:4px;"><div id="cp-seen" style="font-weight:700;font-size:14px;">0</div><div style="font-size:10px;color:#78909c;">Visible</div></div><div style="background:#263238;padding:6px;border-radius:4px;"><div id="cp-queue" style="font-weight:700;font-size:14px;color:#ffb74d;">0</div><div style="font-size:10px;color:#78909c;">Queue</div></div><div style="background:#263238;padding:6px;border-radius:4px;"><div id="cp-added" style="font-weight:700;font-size:14px;color:#4caf50;">0</div><div style="font-size:10px;color:#78909c;">Clipped</div></div><div style="background:#263238;padding:6px;border-radius:4px;"><div id="cp-pre" style="font-weight:700;font-size:14px;color:#90a4ae;">0</div><div style="font-size:10px;color:#78909c;">Pre-Clipped</div></div></div></div>';
    document.body.appendChild(wui);
    var wstate = { clipped: 0, run: true, bottomHits: 0 };
    var setWText = function (id, val) {
      var el = document.getElementById(id);
      if (el) el.innerText = val;
    };
    var wupdate = function (s, t, q, p) {
      if (s) setWText("cp-status", s);
      if (t !== undefined) setWText("cp-seen", t);
      if (q !== undefined) setWText("cp-queue", q);
      setWText("cp-added", wstate.clipped);
      if (p !== undefined) setWText("cp-pre", p);
      updateLastRun(wstate.clipped);
    };
    var wstop = function () { wstate.run = false; clearInterval(wloop); wupdate("Done. Script stopped."); };
    var wloop = setInterval(function () {
      if (!wstate.run) return;
      if (!document.getElementById("walg-autopilot-ui")) { wstop(); return; }
      var allButtons = Array.from(document.querySelectorAll('button[id^="clip"]'));
      var preClipped = document.querySelectorAll(".icon__check").length;
      var queue = allButtons.filter(function (btn) {
        return !btn.hasAttribute("data-walg-processed") && btn.innerText.trim() === "Clip" && btn.offsetParent !== null;
      });
      var total = allButtons.length + preClipped;
      wupdate(queue.length > 0 ? "Clipping..." : "Scrolling for more...", total, queue.length, preClipped);
      if (queue.length > 0) {
        wstate.bottomHits = 0;
        var target = queue[0];
        target.setAttribute("data-walg-processed", "true");
        target.scrollIntoView({ behavior: "auto", block: "center" });
        try {
          var card = target.closest(".wag-do-couponlist-box");
          var merchant = card.querySelector('[id^="brand"] strong').innerText.trim();
          var value = card.querySelector('[id^="summary"] strong').innerText.trim();
          saveOffer("walg_" + merchant.replace(/\W/g, ""), merchant, value, "Walgreens", { status: "clipped" });
        } catch (e) {}
        wstate.clipped++;
        var o3 = { view: window, bubbles: true, cancelable: true };
        target.dispatchEvent(new MouseEvent("mousedown", o3));
        target.dispatchEvent(new MouseEvent("mouseup", o3));
        target.dispatchEvent(new MouseEvent("click", o3));
      } else {
        var max = document.body.scrollHeight;
        var cur = window.innerHeight + window.scrollY;
        if (cur >= max - 100) { wstate.bottomHits++; if (wstate.bottomHits > 3) wstop(); }
        else { wstate.bottomHits = 0; window.scrollBy(0, 500); }
      }
    }, 400);
    document.getElementById("cp-close").onclick = function () { wstop(); wui.remove(); };
    return;
  }

  /* ============================================================ */
  /*                           CITI                               */
  /* ============================================================ */
  //
  // Citi flow (single page, no navigation):
  //
  //   Phase 0 "scrolling":  Scroll to bottom repeatedly until page height
  //                         stops growing — Citi lazy-loads offer tiles and
  //                         the page must be fully scrolled before all session
  //                         cookies are set and all offers are available.
  //   Phase 1 "fetching":   GET accountDetails → list eligible cards
  //   Phase 2 "offers":     POST merchantOffers/retrieve per card
  //   Phase 3 "enrolling":  POST enrollMerchantOffer (fallback: enrollment)
  //                         per unenrolled offer, then saveOffer()
  //
  //   All headers are read from cookies Citi sets at login time.
  //   environmentID is hardcoded "SuperMarioPROD" (confirmed from Kudos extension).
  //
  if (host.indexOf("citi.com") > -1) {
    if (document.getElementById("citi-autopilot-ui")) return;

    var getCookieValue = function (name) {
      var match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
      return match ? decodeURIComponent(match[1]) : "";
    };

    var getCitiHeaders = function () {
      return {
        "Accept": "application/json",
        "Accept-language": "en_US",
        "Connection": "keep-alive",
        "Content-Type": "application/json",
        "Origin": "https://online.citi.com",
        "Referer": "https://online.citi.com/US/nga/products-offers/merchantoffers",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "TMXSessionId": getCookieValue("tmx_sessionid"),
        "appVersion":   getCookieValue("appVersion"),
        "businessCode": getCookieValue("businessCode"),
        "channelId":    getCookieValue("channelId"),
        "client_id":    getCookieValue("client_id"),
        "countryCode":  getCookieValue("countryCode"),
        "environmentID": "SuperMarioPROD"
      };
    };

    var cui = document.createElement("div");
    cui.id = "citi-autopilot-ui";
    cui.style.cssText = "position:fixed;bottom:20px;right:20px;width:240px;background:#1c2b36;color:#fff;font-family:sans-serif;font-size:12px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:999999;border:1px solid #455a64;overflow:hidden;";
    cui.innerHTML = '<div style="background:#003B70;padding:10px;font-weight:700;display:flex;justify-content:space-between;align-items:center;"><span>Citi Autopilot</span><span id="citi-close" style="cursor:pointer;font-size:16px;opacity:0.8;">&times;</span></div><div style="padding:12px;"><div style="margin-bottom:8px;color:#90a4ae;">STATUS</div><div id="citi-status" style="color:#4caf50;font-weight:600;margin-bottom:12px;line-height:1.4;">Starting...</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:center;"><div style="background:#263238;padding:6px;border-radius:4px;"><div id="citi-scanned" style="font-weight:700;font-size:14px;">0</div><div style="font-size:10px;color:#78909c;">Found</div></div><div style="background:#263238;padding:6px;border-radius:4px;"><div id="citi-queue" style="font-weight:700;font-size:14px;color:#ffb74d;">0</div><div style="font-size:10px;color:#78909c;">Queue</div></div><div style="background:#263238;padding:6px;border-radius:4px;"><div id="citi-added" style="font-weight:700;font-size:14px;color:#4caf50;">0</div><div style="font-size:10px;color:#78909c;">Enrolled</div></div><div style="background:#263238;padding:6px;border-radius:4px;"><div id="citi-saved" style="font-weight:700;font-size:14px;color:#90a4ae;">0</div><div style="font-size:10px;color:#78909c;">Saved</div></div></div></div>';
    document.body.appendChild(cui);

    var citiStopped = false;
    var setCitiText = function (id, val) { var e = document.getElementById(id); if (e) e.innerText = val; };

    document.getElementById("citi-close").onclick = function () { citiStopped = true; cui.remove(); };

    (async function () {
      try {
        // ---- Phase 0: scroll to bottom until no new offers appear ----
        // Citi lazy-loads offer tiles as the user scrolls; all tiles (and
        // their associated cookies) must be present before the API calls.
        setCitiText("citi-status", "Scrolling to load all offers...");
        var lastHeight = -1, noGrowthTicks = 0;
        while (noGrowthTicks < 3) {
          if (citiStopped) return;
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise(function (r) { setTimeout(r, 800); });
          var newHeight = document.body.scrollHeight;
          if (newHeight === lastHeight) { noGrowthTicks++; } else { noGrowthTicks = 0; }
          lastHeight = newHeight;
        }
        window.scrollTo(0, 0);
        await new Promise(function (r) { setTimeout(r, 400); });

        // ---- Phase 1: fetch eligible accounts ----
        setCitiText("citi-status", "Fetching accounts...");
        var accountsResp = await fetch(
          "https://online.citi.com/gcgapi/prod/public/v1/v2/digital/customers/dashboardTiles/accountDetails",
          { method: "GET", headers: getCitiHeaders(), credentials: "include" }
        );
        if (!accountsResp.ok) {
          setCitiText("citi-status", "Could not load accounts (status " + accountsResp.status + "). Are you logged in?");
          return;
        }
        var accountsData = await accountsResp.json();
        var allAccounts = (accountsData.creditCardAccount && accountsData.creditCardAccount.accountDetails) || [];
        var accounts = allAccounts.filter(function (a) {
          return a.accountId && a.accountName
            && a.accountStatus === "ACTIVE"
            && a.personalAccount === true
            && !(a.productName && a.productName.indexOf("Costco") > -1);
        });

        if (!accounts.length) {
          setCitiText("citi-status", "No eligible Citi accounts found.");
          return;
        }

        // ---- Phase 2: fetch offers per account ----
        var allOffers = [];
        for (var ai = 0; ai < accounts.length; ai++) {
          if (citiStopped) return;
          var acct = accounts[ai];
          setCitiText("citi-status", "Fetching offers (card " + (ai + 1) + " of " + accounts.length + ")...");
          try {
            var offersResp = await fetch(
              "https://online.citi.com/gcgapi/prod/public/v1/digital/customers/creditCards/merchantOffers/retrieve",
              {
                method: "POST",
                headers: getCitiHeaders(),
                body: JSON.stringify({ accountId: acct.accountId }),
                credentials: "include"
              }
            );
            if (!offersResp.ok) continue;
            var offersData = await offersResp.json();
            var merchantGroups = offersData.merchantOffers || [];
            merchantGroups.forEach(function (group) {
              (group.offers || []).forEach(function (offer) {
                allOffers.push({ offer: offer, accountId: acct.accountId, accountName: acct.accountName });
              });
            });
          } catch (e) {}
        }

        var eligible = allOffers.filter(function (item) {
          return item.offer.offerStatus !== "ENROLLED";
        });

        setCitiText("citi-scanned", allOffers.length);
        setCitiText("citi-queue", eligible.length);
        updateLastRun(allOffers.length);

        if (!eligible.length) {
          setCitiText("citi-status", "All offers already enrolled. " + allOffers.length + " total found.");
          return;
        }

        // ---- Phase 3: enroll each eligible offer ----
        var enrolled = 0, saved = 0;
        var primaryUrl   = "https://online.citi.com/gcgapi/prod/public/v1/digital/customers/creditCards/accounts/rewards/specialOffers/enrollMerchantOffer";
        var fallbackUrl  = "https://online.citi.com/gcgapi/prod/public/v1/digital/customers/creditCards/merchantOffers/enrollment";

        for (var oi = 0; oi < eligible.length; oi++) {
          if (citiStopped) return;
          var item   = eligible[oi];
          var offer  = item.offer;
          var acctId = item.accountId;
          var acctName = item.accountName;

          setCitiText("citi-status", "Enrolling " + (oi + 1) + " of " + eligible.length + "...");

          var body = JSON.stringify({ offerId: offer.offerId, accountId: acctId });
          var enrollOk = false;
          var enrollmentId = "";

          try {
            var r1 = await fetch(primaryUrl, { method: "POST", headers: getCitiHeaders(), body: body, credentials: "include" });
            if (r1.status === 404) {
              var r2 = await fetch(fallbackUrl, { method: "POST", headers: getCitiHeaders(), body: body, credentials: "include" });
              if (r2.ok) {
                var d2 = await r2.json();
                enrollmentId = (d2.EnrolledOfferInfo && d2.EnrolledOfferInfo.enrollmentId) || d2.enrollmentId || "";
                enrollOk = !!enrollmentId;
              }
            } else if (r1.ok) {
              var d1 = await r1.json();
              enrollmentId = (d1.EnrolledOfferInfo && d1.EnrolledOfferInfo.enrollmentId) || d1.enrollmentId || "";
              enrollOk = !!enrollmentId;
            }
          } catch (e) {}

          if (enrollOk) enrolled++;

          // Offer value: try multiple likely field names
          var valueText = offer.offerDescription
            || offer.rewardText
            || offer.offerTitle
            || offer.shortDescription
            || offer.benefitText
            || offer.savingsText
            || "";

          var merchantName = offer.merchantName || "Merchant";
          var endDate = offer.offerEndDate || "";

          saveOffer(
            "citi_" + acctId + "_" + offer.offerId,
            merchantName,
            valueText,
            "Citi",
            {
              status: enrollOk ? "added" : "available",
              expiresTs: parseExpiresTs(endDate),
              days: endDate,
              card: acctName + " (Citi)",
              cardId: acctId
            }
          );
          saved++;
          setCitiText("citi-added", enrolled);
          setCitiText("citi-saved", saved);
          updateLastRun(enrolled);
        }

        setCitiText("citi-status", "Done. " + enrolled + " enrolled, " + saved + " saved.");
        setCitiText("citi-queue", 0);
      } catch (err) {
        setCitiText("citi-status", "Error: " + (err && err.message ? err.message : String(err)));
      }
    })();
    return;
  }

  /* ---- No site matched ---- */
  alert("Universal Offer Hub: this site isn't a registered offer source.\nOpen Chase, Amex, Capital One, Walgreens, or Citi and try again.");
})();
