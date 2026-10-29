# Universal Offer Hub

A Chrome extension that adds every available card offer (Chase, American Express, Capital One) and clips every store coupon (Walgreens, Safeway) for you, then keeps all of them in one searchable hub on your own computer. Nothing is stored or sent anywhere else, except to an AI you connect, for your own questions.

![License](https://img.shields.io/github/license/pateljay134/Universal-Offer-Hub.svg)
![Manifest](https://img.shields.io/badge/manifest-v3-orange.svg)
![Servers](https://img.shields.io/badge/servers-none-brightgreen.svg)

---

## What it does

- **One-click autopilots** for Chase, Amex, Capital One, Walgreens and Safeway. Open the site, click the toolbar icon, press **Run**. Every offer it touches is saved to the hub, per card.
- **Amex auto-add (opt-in).** When you open Amex while signed in, it reads every credit card on that login in a background tab and adds each offer to the right card. Details below.
- **Dashboard.** A full-page table of every active offer. Click a column title to sort; the ▾ beside it filters by card (an issuer's cards all at once, or one at a time), offer type, category or expiry. Views for New this week and Expiring soon, and card nicknames ("Mom Plat").
- **Ask AI.** A chat about your offers, answered by ChatGPT, Claude or Gemini with your own key (or by plain rules without one). Follow-ups such as "only Chase" or "as CSV" build on the last answer, and every reply lists all its matches.
- **Use your offers in AI apps.** One click hands them to ChatGPT, Claude or Gemini in the browser, and a one-time setup lets the Claude Desktop app read them live. **Copy** takes any list you narrow down.
- **Offer reminders.** Visit `adidas.com` or `bestbuy.com` and a small note lists the offers you already have there and which card holds them.

## Privacy

**Offer Hub keeps your offers on your computer and never stores or sends them anywhere else, except to the AI you connect yourself (ChatGPT, Claude or Gemini), and only for the questions you ask.**

- No server, no account, no analytics. Your offers live in Chrome (`chrome.storage.local`) and, if you turn on the live copy, in the folder you pick.
- Ask AI: each question sends the AI you connected (OpenAI, Anthropic or Google) your question and the offers that match it: store, offer, card name and ending, expiry and category. Your key stays in this browser and goes only to its own company. With no AI connected, nothing leaves the browser.
- Open AI chat and the Claude Desktop app work only when you use them. You give the chat site the file yourself, and Claude Desktop reads the live copy on your computer and sends what it looks up to Anthropic as part of your chat. Anything you copy into another app goes wherever that app sends it.
- Amex auto-add opens Amex's own website in a background tab: the same pages you'd open yourself, with your existing sign-in.
- Plain, unminified JavaScript. You install it unpacked from a folder you control, so it can't update itself behind your back.
- The `<all_urls>` permission exists for offer reminders. The service worker reads only the hostname of the page you're on and compares it with your saved offers. Turn reminders off in the popup and it stops.

## Install

1. Download this repo (**Code → Download ZIP**) and unzip `Universal-Offer-Hub.zip` somewhere stable, such as `~/Documents/Universal-Offer-Hub`.
2. Open `chrome://extensions` (also works in Edge and Brave) and turn on **Developer mode**.
3. Click **Load unpacked** and pick the extracted `Universal-Offer-Hub` folder.
4. Pin the icon.

To update, replace the folder's contents with a newer release and click the reload icon on the extension's card. Moving the folder or removing the extension deletes its saved offers; disabling it keeps them.

## Use

1. Open Chase, Amex, Capital One, Walgreens or Safeway and sign in.
2. Click the toolbar icon. It detects the site and shows **Run … Autopilot**. Click it; the on-page panel shows progress.
3. Search everything from the popup, or click **Dashboard** for the full view.

The popup and the dashboard count offers the same way: an offer saved on two cards counts once, and expired offers are left out (the popup says how many) until **Clean expired** removes them. An offer that ends today counts until midnight.

Search ignores spaces, dashes and case (`road runner`, `RoadRunner` and `Road-Runner` all match) and also matches card nicknames and categories.

## Amex auto-add

Turn on **Auto-add Amex offers when I sign in** in the popup. It is off by default; while it's off, nothing runs on its own.

- **What it does.** When you open Amex while signed in, Offer Hub opens the offers page in a background tab (a small grey **Offer Hub** tab group at the end of your tabs) and clicks **+** on every offer, card by card, top card first, the same way **Run Amex Autopilot** does. The tab closes itself when it's done. Stay signed in until then.
- **The first time on a login, you choose.** Offer Hub reads that login's cards, then opens **Cards** on its own. Leave **Add** on for the cards that should get offers, drag them into order (or use the arrows) and press **Confirm and add offers**. Adding starts right away.
- **After that, it just adds.** Later sign-ins add offers with no questions. It asks again only when a new card shows up on the login.
- **Why the order matters.** Since August 2026, Amex keeps each offer on one card per login: add it to one card and it disappears from your others. So the top card gets every offer it has, the next card gets what's left, and so on.
- **A card you replaced or closed.** Remove it in **Cards** with **×**. Its saved offers go with it; nothing changes at Amex.
- **Which accounts.** Credit and charge cards, including business cards. It skips checking, savings, loans, Business Blueprint and canceled accounts.
- **Limits.** At most once every 2 hours per login. A run that stops early still counts: you press Stop or close its tab, you sign out or switch to another family member's login mid-run, or Amex stops confirming adds. Only a run whose offers page never loaded tries again sooner, on a visit 15 minutes later.
- **Run it now.** **Add offers now** in **Cards**, or **Add offers on all cards** in the popup on an Amex page.

The popup's **Run Amex Autopilot** button still works as before: it adds every offer to the card on screen. Chase auto-add is planned.

## Use your offers with AI

Everything here is a button in the dashboard. Nothing needs a terminal.

**Ask AI** (top right) opens a chat about your offers; **X** closes it and clears it. The **Character** menu at the top of the chat picks the Ask AI character, from 12; your choice is saved and you can change it any time. For answers from ChatGPT, Claude or Gemini, click **Connect ChatGPT, Claude or Gemini** under the chat box, pick one, click **Get a key**, paste the key and press **Connect**. Each company charges per question, and Gemini has a free tier. Paid chat plans such as ChatGPT Plus or Claude Pro don't include a key. Without a key, the chat still finds offers by plain rules. Ask sends the AI only the offers that match, and every offer it mentions comes from your saved data.

Follow-ups such as "only Chase", "3 days?", "sort by value" or "as CSV" narrow the last answer until **New chat**; a new topic ("best hotel offer") searches everything again. Replies list every match, with **Download CSV** and **Copy**. **Expand** gives the chat more room.

**Open AI chat ↗** continues in ChatGPT, Claude or Gemini on their own sites, with your free or paid account there and no key. Pick one: Offer Hub downloads your active offers, copies a starter message and opens the chat. Add the downloaded file to the chat, paste, and ask. That company receives the file you give it.

**Claude Desktop app**, in the same menu, lets the Claude app on your computer look up your offers while you chat. Set it up once:

1. **Choose a folder** for a live copy of your offers: a new folder such as `Offer Hub` in your home folder, not one synced to iCloud, OneDrive or Google Drive. Chrome won't use the home, Documents, Desktop or Downloads folders themselves, only folders inside them.
2. **Download plugin** saves `Offer Hub.mcpb`.
3. Open that file. Claude Desktop shows an install screen and asks for a folder: pick the same one.

Claude Desktop includes everything the plugin needs. Then ask Claude, for example, "Using Offer Hub, what's my best hotel offer, and which card is it on?" If Chrome later asks about the folder, click **Keep updating** and choose **Allow on every visit**, so the copy stays current while the dashboard is closed. The footer shows the live copy's status.

**Copy** (beside the offer count) copies the offers the table shows, with your view, filters and search applied, as plain text, up to 500.

<details><summary>For developers</summary>

The plugin is `mcp/offer-hub-mcp.js`, a read-only MCP server over the live copy's `offers.json` (Node 18 or later, no dependencies). The dashboard packs it with `lib/offers.js` and `lib/categories.js` into an MCP Bundle (`lib/mcpb.js`). Its tools are `search_offers`, `list_cards` and `offers_overview`. Other MCP apps run it directly:

- Claude Code: `claude mcp add offer-hub -- node /path/to/Universal-Offer-Hub/mcp/offer-hub-mcp.js --dir "/path/to/Offer Hub"`
- Gemini CLI (`~/.gemini/settings.json`) and Cursor (`~/.cursor/mcp.json`): an `mcpServers` entry, `"offer-hub": {"command": "node", "args": ["/path/to/Universal-Offer-Hub/mcp/offer-hub-mcp.js", "--dir", "/path/to/Offer Hub"]}`

ChatGPT connects only to plugins hosted on the internet, so it can't use this one.
</details>

## Request a new site

[Open an issue](../../issues/new) with the offers page URL and a copy of the page:

1. Open the offers page (signed in) and scroll until all offers have loaded.
2. Save it with **Cmd+S** (Mac) or **Ctrl+S** (Windows), choosing **Webpage, HTML Only**.
3. Search the file for your name, card numbers and email and replace them with `XXXX`.
4. Zip the `.html` file and attach the zip to the issue. GitHub limits issue text to 65,536 characters, so pasting the page into the issue box doesn't work.

## Add a source yourself

1. Add a record to `UOH_SOURCES` in `lib/sources.js` (id, name, colors, host patterns, landing URL).
2. Add a `host.indexOf("site.com") > -1` branch in `content/scraper.js` that calls `saveOffer(key, merchant, value, "Site", { card, cardId, expiresTs, status })` for each offer.
3. Add the site's host permission in `manifest.json`.

Pull requests are welcome at [github.com/pateljay134/Universal-Offer-Hub](https://github.com/pateljay134/Universal-Offer-Hub/).

## Folder layout

```
manifest.json
background.js          service worker: offer reminders, the one writer of saved data, Amex auto-add host
lib/sources.js         supported sites (popup detection, colors)
lib/offers.js          shared helpers: search, parsing, expiry, card labels, exports
lib/categories.js      merchant categories (brand list + word rules)
lib/autorun.js         Amex auto-add: scan cards, assign offers, add, harvest
lib/livefile.js        the live copy: offers.json / offers.csv in the folder you pick
lib/ai.js              Ask AI: ChatGPT, Claude or Gemini (dashboard)
lib/mcpb.js            builds the Claude Desktop plugin file, Offer Hub.mcpb (dashboard)
lib/theme.css          shared look
content/scraper.js     the per-site autopilots (page context)
content/bridge.js      passes autopilot saves to the service worker
content/amex-auto.js   drives the background Amex tab; notes in your Amex tab
popup/                 toolbar popup
dashboard/             full-page dashboard
bookmarklets/          the original bookmarklet scripts
mcp/offer-hub-mcp.js   the plugin: lets AI apps on this computer search offers.json (Node 18+, no dependencies)
tests/                 node --test tests/*.test.js (no dependencies)
```

## Saved data

Everything is in `chrome.storage.local`:

| Key | What it holds |
| --- | --- |
| `UOH_Database` | Every offer, keyed `<source>_<card>_<merchant>`: merchant, offer text, source, card, expiry, status, first and last seen |
| `UOH_Settings` | Toggles, card nicknames, card order and the Ask AI character |
| `UOH_AutoState` | Amex auto-add history (last run, per-card times) |
| `UOH_Categories` | Categories saved for merchants the built-in lists don't cover |
| `UOH_LiveFile` | Live copy status |
| `UOH_AIConfig` | Ask AI: the AI in use, your keys and chosen models (never exported) |
| `UOH_LastRunCount`, `UOH_LastRunAt`, `UOH_UIState` | Last autopilot run and popup filters |

**Clear all** in the popup deletes every saved offer, the last auto-add summary and the categories, and empties the live copy. Settings, nicknames, card order, the 2-hour auto-add timers and your Ask AI keys stay.

## Feedback

Bugs and requests: [open an issue](../../issues), or message [u/pateljay134](https://www.reddit.com/user/pateljay134/) on Reddit. Free, no subscriptions.

## License

See [`LICENSE`](./LICENSE).
