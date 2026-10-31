# Universal Offer Hub

A Chrome extension that adds every available card offer (Chase, American Express, Capital One) and clips every store coupon (Walgreens, Safeway) for you, then keeps all of them in one searchable hub on your own computer. Nothing is stored or sent anywhere else, except to an AI you connect, for your own questions.

![License](https://img.shields.io/github/license/pateljay134/Universal-Offer-Hub.svg)
![Manifest](https://img.shields.io/badge/manifest-v3-orange.svg)
![Servers](https://img.shields.io/badge/servers-none-brightgreen.svg)

---

## What it does

- **One-click autopilots** for Chase, Amex, Capital One, Walgreens and Safeway. Open the site, click the toolbar icon, press **Run**. Every offer it touches is saved to the hub, per card.
- **Amex and Chase auto-add (opt-in).** When you open Amex or Chase while signed in, it adds every offer to the cards you picked, in a background tab. Details below.
- **Dashboard.** A full-page table of every active offer. Click a column title to sort; the ▾ beside it filters by card (an issuer's cards all at once, or one at a time), offer type, category or expiry. Views for New this week and Expiring soon, and card nicknames ("Mom Plat").
- **Ask AI.** A chat about your offers, answered by ChatGPT, Claude or Gemini with your own key (or by plain rules without one). Follow-ups such as "only Chase" or "as CSV" build on the last answer, and every reply lists all its matches.
- **Use your offers in AI apps.** One click hands them to ChatGPT, Claude or Gemini in the browser, and a one-time setup lets the Claude Desktop app read them live. **Copy** takes any list you narrow down.
- **Offer reminders.** Visit `adidas.com` or `bestbuy.com` and a small note lists the offers you already have there and which card holds them.

## Privacy

**Offer Hub keeps your offers on your computer and never stores or sends them anywhere else, except to the AI you connect yourself (ChatGPT, Claude or Gemini), and only for the questions you ask.**

- No server, no account, no analytics. Your offers live in Chrome (`chrome.storage.local`) and, if you turn on the live copy, in the folder you pick.
- Ask AI: each question sends the AI you connected (OpenAI, Anthropic or Google) your question and the offers that match it: store, offer, card name and ending, expiry and category. Your key stays in this browser and goes only to its own company. With no AI connected, nothing leaves the browser.
- Open AI chat and the Claude Desktop app work only when you use them. You give the chat site the file yourself, and Claude Desktop reads the live copy on your computer and sends what it looks up to Anthropic as part of your chat. Anything you copy into another app goes wherever that app sends it.
- Auto-add opens the bank's own website (Amex or Chase) in a background tab: the same pages you'd open yourself, with your existing sign-in.
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

## Auto-add on sign-in

Amex and Chase each have a toggle in the popup: **Auto-add Amex offers when I sign in** and **Auto-add Chase offers when I sign in**. Both are off by default; while one is off, nothing runs on its own for that bank. The **Cards** link on each toggle's line opens **Cards** in the dashboard at that bank's cards.

- **What it does.** When you open that bank's site while signed in, Offer Hub opens its offers page in a background tab (a small grey **Offer Hub** tab group at the end of your tabs) and runs that bank's **Run … Autopilot** on each card, top card first. It is the popup button's own code: it clicks **+** on every offer, then reads the card's Added list. The tab closes itself when it's done. Stay signed in until then.
- **The first time on a login, you choose.** Offer Hub reads only that login's list of cards, then opens **Cards** on its own. Leave **Add** on for the cards that should get offers and press **Confirm and add offers**. Adding starts right away.
- **After that, it just adds.** Later sign-ins add offers with no questions. It asks again only when a new card shows up on the login. Cards with **Add** off are skipped.
- **A card you replaced or closed.** Remove it in **Cards** with **×**. Its saved offers go with it; nothing changes at the bank.
- **Limits.** At most once every 2 hours per login. A run that stops early still counts: you press Stop or close its tab, you sign out or switch to another family member's login mid-run, or the autopilot can't run on two cards in a row. Only a run whose offers page never loaded tries again sooner, on a visit 15 minutes later. Open the bank inside that wait and a small note on its page says when Offer Hub last ran for the login and when the next run can start.
- **One bank at a time.** Sign in to Chase while an Amex run is working and the Chase run starts when the Amex one ends.
- **Run it now.** **Add offers now** in **Cards** or in that note, or **Add offers on all cards** in the popup on that bank's page.

The popup's **Run Amex Autopilot** and **Run Chase Autopilot** buttons work as before: they add every offer to the card on screen. Auto-add runs the same code. Chrome slows the timers of a tab you can't see, so in the background tab Offer Hub gives the autopilot each step itself, at the pace its own timer keeps (every 0.25 seconds for Amex, 0.4 for Chase).

### Amex

- **Why the order matters.** Since August 2026, Amex keeps each offer on one card per login: add it to one card and it disappears from your others. So the top card gets every offer it has, the next card gets what's left, and so on. Set the order in **Cards** by dragging (or with the arrows).
- **Which accounts.** Credit and charge cards, including business cards. It skips checking, savings, loans, Business Blueprint and canceled accounts.

### Chase

- **Every card gets every offer.** Chase keeps a separate copy of an offer on each card: adding it to one card doesn't take it off another, and each card earns it on its own purchases. The order in **Cards** only sets which card is listed first; **Add** decides which cards get offers.
- **Which accounts.** Everything in the **Choose account** list on Chase Offers, debit cards included. Turn **Add** off for any you don't want offers on.
- **Opening each card.** Run Chase Autopilot saves offers under the account id in the page address, so Offer Hub opens Chase Offers with the card's id there. If Chase shows another card, or puts the open card's id back into the address, Offer Hub picks the right card in **Choose account** and sets the address again. If the address still doesn't name the card, it skips that card rather than save its offers under the wrong one.
- **How it adds.** Run Chase Autopilot clicks **+** on one offer per step; Chase opens that offer's page and the autopilot goes back to the list. In the background tab Chase can be slow, so Offer Hub adds two waits around the autopilot's steps: it lets it press Back once per offer page (a second press only after 5 seconds), and when the list shows no offer left to add, it looks twice more, a second apart, before the autopilot moves on to the Added list.
- **When Chase Offers has trouble.** If "It looks like we're having trouble with Chase Offers" shows before a card's run, it waits 5 seconds and presses **Try again**, twice at most, then reloads the page once. If the message stays, it moves on to the next card.

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
background.js          service worker: offer reminders, the one writer of saved data, auto-add host
lib/sources.js         supported sites (popup detection, colors)
lib/offers.js          shared helpers: search, parsing, expiry, card labels, exports
lib/categories.js      merchant categories (brand list + word rules)
lib/autorun.js         auto-add: the background tab, its jobs, card order and timers; one bank at a time
lib/issuers/amex.js    what Amex auto-add needs: its pages, how cards are read, its autopilot's pace
lib/issuers/chase.js   the same for Chase, plus the readers for its account and offer labels
lib/livefile.js        the live copy: offers.json / offers.csv in the folder you pick
lib/ai.js              Ask AI: ChatGPT, Claude or Gemini (dashboard)
lib/mcpb.js            builds the Claude Desktop plugin file, Offer Hub.mcpb (dashboard)
lib/theme.css          shared look
content/scraper.js     the per-site autopilots (page context); auto-add runs the Amex and Chase ones too
content/bridge.js      passes autopilot saves to the service worker
content/auto-core.js   auto-add in the page, for every bank: the background tab's link to the service worker, running the bank's autopilot step by step, notes in your tab
content/amex-auto.js   Amex steps: read and switch cards, then Run Amex Autopilot
content/chase-auto.js  Chase steps: the accounts page, Choose account, then Run Chase Autopilot with its two waits
popup/                 toolbar popup
dashboard/             full-page dashboard
bookmarklets/          the original bookmarklet scripts
mcp/offer-hub-mcp.js   the plugin: lets AI apps on this computer search offers.json (Node 18+, no dependencies)
tests/                 node --test tests/*.test.js (no dependencies)
tests/browser/         node tests/browser/chase-auto.check.js (and amex-auto.check.js): auto-add with the real autopilots on made-up pages in headless Chrome
```

## Saved data

Everything is in `chrome.storage.local`:

| Key | What it holds |
| --- | --- |
| `UOH_Database` | Every offer, keyed `<source>_<card>_<merchant>`: merchant, offer text, source, card, expiry, status, first and last seen |
| `UOH_Settings` | Toggles, card nicknames, card order and the Ask AI character |
| `UOH_AutoState` | Auto-add history (last run, per-card times) |
| `UOH_Categories` | Categories saved for merchants the built-in lists don't cover |
| `UOH_LiveFile` | Live copy status |
| `UOH_AIConfig` | Ask AI: the AI in use, your keys and chosen models (never exported) |
| `UOH_LastRunCount`, `UOH_LastRunAt`, `UOH_UIState` | Last autopilot run and popup filters |

**Clear all** in the popup deletes every saved offer, the last auto-add summary and the categories, and empties the live copy. Settings, nicknames, card order, the 2-hour auto-add timers and your Ask AI keys stay.

## Feedback

Bugs and requests: [open an issue](../../issues), or message [u/pateljay134](https://www.reddit.com/user/pateljay134/) on Reddit. Free, no subscriptions.

## License

See [`LICENSE`](./LICENSE).
