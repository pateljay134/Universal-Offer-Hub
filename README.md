# Universal-Offer-Hub
> One Chrome / Edge / Brave extension that runs every credit-card offer autopilot you need — Chase, American Express, Capital One, and Walgreens — and keeps a fully local, searchable history of every offer you've ever added across every card.

![License](https://img.shields.io/github/license/pateljay134/Universal-Offer-Hub.svg)
![Manifest](https://img.shields.io/badge/manifest-v3-orange.svg)
![Network calls](https://img.shields.io/badge/network%20calls-zero-brightgreen.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

---

## 🔒 Privacy by design (just like Apple 😉)

This is **not** like the offer extensions you find on the Chrome Web Store, Edge add-ons, or any other marketplace. Most of those:

- Make **network calls to their own servers** with your customer IDs, cookies, session tokens, or scraped account data.
- Auto-update silently with new permissions you didn't approve the first time.
- Ship minified / obfuscated code you can't realistically audit.

Universal Offer Hub is built on privacy by design:

- **Zero network calls.** Not to any server, not to any analytics service, not anywhere. There is no remote backend. Open DevTools' Network tab while the autopilot runs — you'll see nothing leaving the extension.
- **Everything stays on your machine.** All offers live in your own browser's local storage (`chrome.storage.local`), inside your Chrome profile, on your disk. Nobody else — including the author — can see them.
- **Your identity is never read.** No customer IDs, no cookies, no session tokens, no account numbers. The extension only looks at on-screen text and clicks visible buttons — exactly like a human would.
- **Fully transparent source code.** Every file is plain JavaScript / HTML / CSS. No minification, no bundler, no obfuscation. Open any file in a text editor before installing — you can read every line yourself.
- **No silent updates.** Because it's loaded as an unpacked extension from a folder you control, it can't update behind your back. You install only what you've already inspected, and you decide when to replace the folder with a newer version.
- **Minimal permissions.** `manifest.json` requests host access only for the four supported sites (`chase.com`, `americanexpress.com`, `capitalone.com`, `walgreens.com`) plus `storage` for the hub. No `https://*/*` wildcard, no remote scripts.

---

## ⚡ Features

- **Four autopilots, one toolbar icon.** Auto-detects the active tab and shows the right coloured **Run** button for the site you're on.
- **Cross-card hub.** Every offer the autopilot touches is mirrored into a single, searchable database you can open at any time.
- **Multi-card aware.** Same merchant on two different cards = two distinct offers. The extension scopes each entry by card (last-4 / accountId) so running on your Platinum doesn't overwrite your Blue Cash.
- **Harvests history, not just new clicks.** AMEX → opens the "Added to Card → View All" page and reads every existing offer. Chase → opens the Added Offers page and scrapes every tile.
- **Expiry-aware.** Each offer stores its expiration date. The hub shows `42 days left` / `Expires today` / `Expired` chips and can sort by **Expiring soonest**.
- **Reward-based offer typing.** "Spend $30, earn 1,500 miles" is classified as MILES (the reward), not DOLLAR (the trigger).
- **Smart search.** `road runner`, `Road-Runner`, `RoadRunner`, and `roadrunner` all match the same merchant. Spaces, dashes, casing, and punctuation are ignored.
- **One-tap CSV export.**
- **Persists across browser restarts.** Close Chrome, reboot, come back tomorrow — your full offer history is still there.

---

## 📦 Install

Download or clone this repo first (green **Code** button → **Download ZIP**, then extract somewhere stable like `~/Documents/Universal-Offer-Hub`).

### Chrome / Edge / Brave (and other Chromium browsers)

1. Open `chrome://extensions` (or `edge://extensions` / `brave://extensions`).
2. Toggle **Developer mode** on (top-right corner).
3. Click **Load unpacked** and select the extracted folder.
4. Pin the icon to your toolbar so it's one click away.

To **update** later: replace the folder contents with a newer release, then click the circular reload icon on the extension's card in `chrome://extensions`.

To **uninstall**: remove the card from `chrome://extensions`. Note that *removing* the extension deletes its stored offers; *disabling* it keeps them.

### Safari (macOS)

Safari can't load an unpacked extension folder directly the way Chromium does — Apple requires extensions to be wrapped in a small Xcode-built macOS app. The path is a one-time setup:

1. Install **Xcode** from the Mac App Store (free). Open it once so it finishes setup, then quit.
2. Open **Terminal** and run, replacing the path with where you extracted the repo:

   ```bash
   xcrun safari-web-extension-converter ~/Documents/Universal-Offer-Hub
   ```

   Press Enter to accept the defaults when prompted. Xcode will open with a generated wrapper project.
3. In Xcode, press **⌘ R** to build and run. A small wrapper app launches once — click **Quit and Open Safari Extensions Preferences**.
4. In Safari, go to **Safari → Settings → Extensions** and tick **Universal Offer Hub**.
5. If the extension isn't listed, enable the Develop menu first: **Safari → Settings → Advanced → "Show Develop menu in menu bar"**, then in the **Develop** menu turn on **"Allow Unsigned Extensions"** (Safari resets this on every restart, so you'll re-toggle it whenever you fully quit Safari).

To **update** later: replace the contents of the extracted folder with a new release, then re-open the Xcode project and press **⌘ R** again to rebuild the wrapper.

To **uninstall**: untick the extension in Safari → Settings → Extensions, and delete the wrapper app from `/Applications` if you no longer want it.

---

## 🧭 Usage

1. Open Chase / Amex / Capital One / Walgreens. Log in if needed.
2. Click the Universal Offer Hub icon in your toolbar.
3. The popup auto-detects the site and shows a coloured **Run … Autopilot** button. Click it.
4. The on-page autopilot UI takes over — same dashboards you'd recognise from the standalone bookmarklets (Scanned / Queue / Added). It runs to completion.
5. Every offer it touches is mirrored into the hub. Click the toolbar icon any time to search across every card.

The popup also acts as a search hub even when you're not on a supported site. Filter by source / type, search by name, sort by Best match / Expiring soonest / Value / A→Z / Recently saved.

---

## 🔍 Search & sort

Search is intentionally forgiving:

- `samsung 10%` — AND across tokens. Both must match.
- `road runner` / `RoadRunner` / `Road-Runner` / `roadrunner` — all match the same merchant. Spaces, dashes, casing, punctuation are ignored.
- Scoring tier: exact merchant match (6) → merchant prefix (5) → merchant substring (4) → compact-merchant match (3) → value substring (2) → haystack (1).
- Best-match tie-breaker: numeric reward value (high → low), then merchant name.

Sort options:

| Option | Behaviour |
| --- | --- |
| **Best match** | Highest combined token score, then highest value. |
| **Expiring soonest** | Nearest expiry first. Offers without a parsed expiry sink to the bottom. |
| **Value (high → low)** | By numeric reward (`n`). |
| **A → Z** | Alphabetical by merchant. |
| **Recently saved** | Newest writes first. |

---

## 🏗 Folder layout

```
Universal-Offer-Hub/
├── manifest.json
├── lib/
│   └── sources.js          shared source registry (the only file you edit to add a new site)
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js            auto-detect, search engine, filters, CSV export
├── content/
│   ├── bridge.js           ISOLATED-world bridge: persists postMessage offers → chrome.storage
│   └── scraper.js          MAIN-world per-site autopilots (Chase / Amex / Capital One / Walgreens)
├── bookmarklets/
│   ├── chase-original.txt  original Chase script (verbatim)
│   ├── chase-enhanced.txt  Chase script + Added Offers harvest
│   ├── amex.txt            original Amex script (verbatim)
│   └── walgreens.txt       original Walgreens script (verbatim)
└── README.md
```

Capital One has no file in `bookmarklets/` — it is the single longest script and is preserved verbatim inside `content/scraper.js` under the `host.indexOf("capitalone.com")` branch.

---

## 🛠 Adding a new source

Three steps:

1. Add a record to `window.UOH_SOURCES` in `lib/sources.js`:

   ```js
   {
     id: "Target",
     name: "Target Circle Offers",
     shortName: "Target",
     color: "#cc0000",
     hostPatterns: ["target.com"],
     landingUrl: "https://www.target.com/circle",
     blurb: "Adds every available Target Circle offer."
   }
   ```

2. Add a host-permission entry to `manifest.json`:

   ```jsonc
   "host_permissions": [
     ...,
     "*://*.target.com/*"
   ]
   ```

3. In `content/scraper.js`, add a `host.indexOf(...)` branch with the autopilot logic. Call `saveOffer(key, merchant, value, "Target", { ... })` to persist each offer.

The popup's auto-detect, chip filter, and search will pick up the new source on the next reload.

---

## 💾 Storage model

Everything lives in `chrome.storage.local`:

| Key | Shape | Meaning |
| --- | --- | --- |
| `UOH_Database` | `{ [key]: OfferRecord }` | All offers, keyed by `<source>_<cardId>_<sanitised-merchant>` |
| `UOH_LastRunCount` | `number` | How many offers the most recent autopilot run added or clipped |
| `UOH_LastRunAt` | `number` (ms) | Timestamp of the most recent autopilot run |
| `UOH_UIState` | `{ source, type, sort, query }` | Last-used popup filter state, restored on reopen |

`OfferRecord` fields:

| Field | Type | Notes |
| --- | --- | --- |
| `m` | string | Merchant display name |
| `v` | string | Raw offer value text (e.g. `"10% cash back"`, `"Spend $30, earn 1,500 miles"`) |
| `site` | string | Source id (`"Chase"` / `"Amex"` / `"Capital One"` / `"Walgreens"`) |
| `n` | number | Parsed numeric reward |
| `t` | string | `PERCENT` / `DOLLAR` / `MILES` / `MULTI` / `OTHER` (based on **reward**, not spend) |
| `r` | string | Lowercased search haystack (merchant + value + card label) |
| `ts` | number | Last-update timestamp |
| `firstSeen` | number | First-saved timestamp |
| `card` | string | Human-readable card label (e.g. `"Blue Cash Everyday® ••91009"`) |
| `cardId` | string | Stable per-card discriminator used in the storage key |
| `expiresTs` | number? | Parsed expiry timestamp (ms). Used for "Expiring soonest" sort. |
| `days` | string? | Raw expiry text from the page (fallback display) |
| `status` | string? | `available` / `added` / `clipped` (source-dependent) |
| `channel` | string? | `Online` / `In-Store` / `Both` (Capital One only) |
| `badge` | string? | `NEW` / `EXCLUSIVE` / `BONUS` (Capital One only) |

Each autopilot run **upserts** by key, so running the same autopilot twice refreshes existing entries instead of duplicating them. Running on a *different card* under the same issuer creates a separate entry — your Platinum and Blue Cash offers coexist.

---

## 🚧 Roadmap

Open ideas — feedback welcome via the Reddit handle below:

- Cross-card duplicate hinting ("this 10% Best Buy offer is also on your other Amex")
- Expiry reminders / badges for "expiring this week"
- Composite "best value first" sort
- Optional `chrome.storage.sync` mode for cross-device sync (with the per-item size trade-off it implies)

---

## 💬 Feedback / issues

- Bugs / feature requests → [open an issue](../../issues) on this repo.
- Reddit DM or mention → [u/pateljay134](https://www.reddit.com/user/pateljay134/).

All free, no subscriptions, no paywalls, no upsell. If it saves you money, consider buying a friend or family member a coffee ☕

---

## 📜 License

See [`LICENSE`](./LICENSE) in the repo.
