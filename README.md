# Universal Offer Hub

A Chrome extension that adds every available card offer (Chase, American Express, Capital One), clips every store coupon (Walgreens, Safeway) and saves every store reward on Capital One Shopping for you, then keeps all of them in one searchable hub on your own computer. Nothing is stored or sent anywhere else, except to an AI you connect, for your own questions.

![License](https://img.shields.io/github/license/pateljay134/Universal-Offer-Hub.svg)
![Manifest](https://img.shields.io/badge/manifest-v3-orange.svg)
![Servers](https://img.shields.io/badge/servers-none-brightgreen.svg)

**Latest version: 3.4.2 (22 Nov 2026).** What changed in each version: [CHANGELOG.md](./CHANGELOG.md).

---

## What it does

- **One-click autopilots** for Chase, Amex, Capital One, Capital One Shopping, Walgreens and Safeway. Open the site, click the toolbar icon, press **Run**. Every offer it touches is saved to the hub, per card.
- **Auto-add on sign-in (opt-in).** When you open Amex or Chase while signed in, it adds every offer to the cards you picked, in a background tab. For Capital One it loads and saves every offer on each card, and for Capital One Shopping every store's reward. Details below.
- **Dashboard.** A full-page table of every active offer. Click a column title to sort; the funnel beside it filters by card (an issuer's cards all at once, one person's, or one card at a time), offer type, category, source or expiry. When Amex or Capital One names who is signed in, the card filter lists each issuer's cards by owner. Views for New this week and Expiring soon, and card nicknames ("Mom Plat").
- **Ask AI.** A chat about your offers, answered by ChatGPT, Claude or Gemini with your own key (or by plain rules without one). Follow-ups such as "only Chase" or "as CSV" build on the last answer, and every reply lists all its matches.
- **Use your offers in AI apps.** One click hands them to ChatGPT, Claude or Gemini in the browser, and a one-time setup lets the Claude Desktop app read them live. **Copy** takes any list you narrow down.
- **Offer reminders.** Visit `adidas.com` or `bestbuy.com` and a small note lists the offers you already have there and which card holds them.

## Privacy

**Offer Hub keeps your offers on your computer and never stores or sends them anywhere else, except to the AI you connect yourself (ChatGPT, Claude or Gemini), and only for the questions you ask.**

- No server, no account, no analytics. Your offers live in Chrome (`chrome.storage.local`) and, if you turn on the live copy, in the folder you pick.
- Ask AI: each question sends the AI you connected (OpenAI, Anthropic or Google) your question and the offers that match it: store, offer, card name and ending, expiry and category. Your key stays in this browser and goes only to its own company. With no AI connected, nothing leaves the browser.
- Open AI chat and the Claude Desktop app work only when you use them. You give the chat site the file yourself, and Claude Desktop reads the live copy on your computer and sends what it looks up to Anthropic as part of your chat. Anything you copy into another app goes wherever that app sends it.
- Auto-add opens the site's own pages (Amex, Chase, Capital One or Capital One Shopping) in a background tab: the same pages you'd open yourself, with your existing sign-in.
- Plain, unminified JavaScript. You install it unpacked from a folder you control, so it can't update itself behind your back.
- The `<all_urls>` permission exists for offer reminders. The service worker reads only the hostname of the page you're on and compares it with your saved offers. Turn reminders off in the popup and it stops.

## Install

1. Download this repo (**Code → Download ZIP**) and unzip `Universal-Offer-Hub.zip` somewhere stable, such as `~/Documents/Universal-Offer-Hub`.
2. Open `chrome://extensions` (also works in Edge and Brave) and turn on **Developer mode**.
3. Click **Load unpacked** and pick the extracted `Universal-Offer-Hub` folder.
4. Pin the icon.

To update, replace the folder's contents with a newer release and click the reload icon on the extension's card; [CHANGELOG.md](./CHANGELOG.md) says what changed. Moving the folder or removing the extension deletes its saved offers; disabling it keeps them.

## Use

1. Open Chase, Amex, Capital One, Capital One Shopping, Walgreens or Safeway and sign in.
2. Click the toolbar icon. It detects the site and shows **Run … Autopilot**. Click it; the on-page panel shows progress.
3. Search everything from the popup, or click **Dashboard** for the full view.

The popup and the dashboard count offers the same way: an offer saved on two cards counts once, and expired offers are left out (the popup says how many) until **Clean expired** removes them. An offer that ends today counts until midnight.

Search ignores spaces, dashes and case (`road runner`, `RoadRunner` and `Road-Runner` all match) and also matches card nicknames and categories.

## Capital One Shopping

Capital One Shopping (capitaloneshopping.com) is Capital One's shopping rewards site, separate from the card offers at Capital One Offers. Its rewards belong to your Capital One Shopping account rather than a card, so the hub saves them without one, like Walgreens and Safeway coupons.

Open the home page signed in and click the toolbar icon. Beside **Run CapitalOne Shopping Autopilot**, choose how long it reads (5 minutes until you change it; the hub keeps your choice), then press Run. Its panel opens in Chrome's side panel, beside the page: the same status and counts as the other autopilots' panels, the time left and **Stop and save**. The toolbar icon shows how many stores it has read. Nothing of the hub goes on the page itself, because Capital One Shopping stops adding offers when something else is on its page: in tests on a signed-in home page, runs with the panel on the page ended after 88 to 598 offers, and without it a run read to the page's own end at 1,020.

The page keeps adding offers as you scroll, so the autopilot reads it as you would: a quick swipe to where the offers end, a wait while the page loads its next batch of 25, a 2.5-second pause once it's in (on a slow connection the page may still be adding to it), and on. It doesn't go down to the store list and footer under the offers, because the page loads the next batch only while its last offers are on screen. If nothing new comes for 10 seconds, it looks around: down to the bottom of the page, then back up past the last 11 offers, at most twice. It stops when the page has no more offers to add (nothing new for 30 seconds after its last batch), when its time is up (and says if the page was still adding offers, so you know to choose more minutes next time), or when you press **Stop and save**, and saves what it read. Keep the tab in front, because a background tab you open yourself loads nothing. It doesn't press anything: you earn a reward by shopping through Capital One Shopping.

**Auto-load when you open it (opt-in).** With **Auto-load Capital One Shopping offers when I open it** on in the popup (off by default), opening capitaloneshopping.com with its offers showing starts the same autopilot in a background tab (the grey **Offer Hub** tab group), on the home page, for the minutes chosen beside Run. That tab closes itself when it's done, at most once every 2 hours. Your own tab stays as it is: nothing is added to it, clicked or scrolled, and no note shows there; the popup and the toolbar icon say how the run went. A background tab draws nothing and the page gets no scroll events there, so in that tab the autopilot moves straight to where the offers end and sends the page the scroll event itself, which is what makes the page load its next batch. In a test on the live site, a hidden tab loaded a batch every 5 seconds this way, from 76 to 401 offers in 65 seconds. There are no cards to choose. **Stop** in the popup saves what was read first, and **Load offers in a background tab** in the popup on the site runs it now.

- **Every rate.** A store can show several rates (2% in Rewards Offers, 4% in Exclusive Offers); each is an entry of its own, with the offer's own words ("Save at Walmart", an event's name) and its box's label ("Exclusive Offer") in the CSV's Badge column. The same rate in two boxes is one entry. Price Drop products aren't saved, but their rate counts for the store.
- **Home Page Activation Bonus.** An offer such as "Get $100 back when you spend $330" (limit one per user) is saved as "$100 back when you spend $330", next to the store's other rates.
- **Event rates.** A rate shown only with an end date, such as "Exclusive rates for next 1 day", expires when the event ends, counted to the end of that day.
- **Open.** Each offer has an **Open** link in the popup and the dashboard. It opens the offer's own link from the page with what the page adds to it when you click the offer there, so the reward is activated the same way. Once that link has run out, or for an offer without one, it opens the store's page on Capital One Shopping instead. Each run saves fresh links.
- **Caps.** Every offer ends in "($1,000 max)", so the hub drops that. Other caps stay: "Up to 7.5% back ($500 max)".
- **Left out.** Mobile game bonuses, event banners that name no store, the referral card and the strip of upcoming Top Offers.
- **Reminders.** Each entry keeps the store's site, read from its logo's address, so a reminder finds offers whose name doesn't match the site: "T-Mobile Home Internet" shows on t-mobile.com.
- **Offers that drop off.** **Clean expired** removes an offer that a run more than 6 hours later didn't find. The first run after the update to one entry per rate removes each store's single entry from before.

When it's done, the side panel says how many offers it saved, how many have an end date and how many it couldn't read. If it can't read a single reward in its first 15 seconds, it stops, saves nothing and says Capital One Shopping may have changed its page.

## Auto-add on sign-in

Each bank has a toggle in the popup: **Auto-add Amex offers when I sign in**, **Auto-add Chase offers when I sign in** and **Auto-load Capital One offers when I sign in**. All are off by default; while one is off, nothing runs on its own for that bank. The **Cards** link on each toggle's line opens **Cards** in the dashboard at that bank's cards. Capital One Shopping has a toggle too (see Capital One Shopping above).

- **What it does.** When you open that bank's site while signed in, Offer Hub opens its offers page in a background tab (a small grey **Offer Hub** tab group at the end of your tabs) and runs that bank's **Run … Autopilot** on each card, top card first. It is the popup button's own code: it clicks **+** on every offer, then reads the card's Added list (Capital One's loads and saves every offer instead). The tab closes itself when it's done. Stay signed in until then.
- **The first time on a login, you choose.** Offer Hub reads only that login's list of cards, then opens **Cards** on its own. Leave **Add** on for the cards that should get offers and press **Confirm and add offers**. Adding starts right away.
- **After that, it just adds.** Later sign-ins add offers with no questions. It asks again only when a new card shows up on the login. Cards with **Add** off are skipped.
- **A card you replaced or closed.** Remove it in **Cards** with **×**. Its saved offers go with it; nothing changes at the bank.
- **Limits.** At most once every 2 hours per login. A run that stops early still counts: you press Stop or close its tab, you sign out or switch to another family member's login mid-run, or the autopilot can't run on two cards in a row. Only a run whose offers page never loaded tries again sooner, on a visit 15 minutes later. Open the bank inside that wait and a small note on its page says when Offer Hub last ran for the login and when the next run can start.
- **One bank at a time.** Sign in to Chase while an Amex run is working and the Chase run starts when the Amex one ends.
- **Run it now.** **Add offers now** in **Cards** or in that note, or **Add offers on all cards** in the popup on that bank's page (**Load offers now** and **Load offers on all cards** for Capital One).

The popup's **Run Amex Autopilot**, **Run Chase Autopilot** and **Run CapitalOne Autopilot** buttons work as before: they run on the card on screen. Auto-add runs the same code. Chrome slows the timers of a tab you can't see, so in the background tab Offer Hub gives the autopilot each step itself, at the pace its own timer keeps (every 0.25 seconds for Amex and Capital One, 0.4 for Chase).

### Amex

- **Where it starts.** On any Amex page that shows your cards: the card in the account switcher, or the accounts listed on **Overview**, where Amex lands after you sign in. Moving between Amex pages counts too.
- **Why the order matters.** Since August 2026, Amex keeps each offer on one card per login: add it to one card and it disappears from your others. So the top card gets every offer it has, the next card gets what's left, and so on. Set the order in **Cards** by dragging (or with the arrows).
- **Which accounts.** Credit and charge cards, including business cards. It skips checking, savings, loans, Business Blueprint and canceled accounts.
- **Whose cards.** Auto-add's own tab opens your Profile page first: its "Select Card Member Account" list names each card's member by Amex's id for the card, and who is signed in. Then it goes on to the offers page. Overview's greeting ("Good morning, …") names who is signed in too. Pages you open yourself are only read, never clicked or moved. The card filter then lists Amex cards by owner.
- **Cards with the same last digits.** Each card is kept under Amex's own id for it, not its last digits, so two cards that end the same (yours, or one in a family member's login) keep their own offers, nickname and place in the order. Offers saved before this move to the card's id the first time it runs.
- **When Amex changes its pages.** Offers are read from the page's layout and text, not from Amex's style names, which it renames now and then. Each card's **Added to Card (N)** count is checked against what was read. If some offers can't be read, the run says how many it got (for example, "Read 0 of the 120 offers on this card's Added page") in the popup's last-run line instead of finishing as if all went well.

### Chase

- **Every card gets every offer.** Chase keeps a separate copy of an offer on each card: adding it to one card doesn't take it off another, and each card earns it on its own purchases. The order in **Cards** only sets which card is listed first; **Add** decides which cards get offers.
- **Which accounts.** Everything in the **Choose account** list on Chase Offers, debit cards included. Turn **Add** off for any you don't want offers on.
- **Opening each card.** Run Chase Autopilot saves offers under the account id in the page address, so Offer Hub opens Chase Offers with the card's id there. If Chase shows another card, or puts the open card's id back into the address, Offer Hub picks the right card in **Choose account** and sets the address again. If the address still doesn't name the card, it skips that card rather than save its offers under the wrong one.
- **How it adds.** Run Chase Autopilot clicks **+** on one offer per step; Chase opens that offer's page and the autopilot goes back to the list. In the background tab Chase can be slow, so Offer Hub adds two waits around the autopilot's steps: it lets it press Back once per offer page (a second press only after 5 seconds), and when the list shows no offer left to add, it looks twice more, a second apart, before the autopilot moves on to the Added list.
- **Carousels.** Chase also shows offers in carousels such as "Grateful for great deals", a few at a time with arrows. The autopilot presses each one that isn't added yet, then presses the carousel's right arrow and waits for the next set, until it has seen every offer the carousel counts ("1 of 12" to "12 of 12"). This works whether a press adds the offer where it is or opens the offer's page.
- **When Chase Offers has trouble.** If "It looks like we're having trouble with Chase Offers" shows before a card's run, it waits 5 seconds and presses **Try again**, twice at most, then reloads the page once. If the message stays, it moves on to the next card.

### Capital One

- **Loads, doesn't add.** Run CapitalOne Autopilot loads every offer on a card ("View More Offers" until there are no more) and saves it to the hub. It doesn't activate any offer, so the card-linked offers in Capital One's **Added to Card** box stay as they are. Auto-load runs the same code on each card, and the run's summary says how many offers it saved.
- **Where it runs.** Signing in at myaccounts.capitalone.com starts it. The run opens your Capital One home page in the background tab and presses **View all offers** in its shopping box, which opens Capital One Offers (capitaloneoffers.com/feed?viewInstanceId=…) with your existing sign-in. Opened directly, without that address, Capital One Offers shows its sign-in page or an empty page. If pressing the button leaves the tab where it was, the run opens the address the box's offers name. Opening Capital One Offers yourself doesn't start a run.
- **Which cards.** Everything in the card menu at the top of Capital One Offers ("Apply my offer to:"), Discover cards included. Each card has its own offers, so the order in **Cards** only sets which card is listed first.
- **Opening each card.** Offer Hub picks the card in that menu, waits until the page names it and shows its offers, then starts the autopilot. Capital One ignores a pick made with events a script sends, so Offer Hub plays the click through the page's own React handlers, as Run CapitalOne Autopilot does for "View More Offers". The autopilot saves offers under the card the page names when it starts, so if the page never names the card, Offer Hub skips it rather than save its offers under another card, and the run's notes say what was tried. Capital One Offers names a card only by its last 4, so Offer Hub reads each card's Capital One id from the account tiles on your home page and keeps the card's offers under it (as a fingerprint, never shown), so two people's cards that end the same stay apart. Two of one login's cards that end the same can't be told apart there, so they're run once.

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
4. In `background.js`, add the site's domain to `UOH_SOURCE_DOMAINS` (no reminder on the offer site itself) and its color to the reminder's `SOURCE_COLORS` (a test checks it matches). Add its name to `SOURCE_WORDS` in `lib/offers.js` and to the `source` list in `mcp/offer-hub-mcp.js`, so Ask AI and the plugin can filter by it.

Pull requests are welcome at [github.com/pateljay134/Universal-Offer-Hub](https://github.com/pateljay134/Universal-Offer-Hub/).

## Folder layout

```
manifest.json
CHANGELOG.md           what changed in each version
background.js          service worker: offer reminders, the one writer of saved data, auto-add host
lib/sources.js         supported sites (popup detection, colors)
lib/offers.js          shared helpers: search, parsing, expiry, card labels, exports
lib/categories.js      merchant categories (brand list + word rules)
lib/autorun.js         auto-add: the background tab, its jobs, card order and timers; one bank at a time
lib/issuers/amex.js    what Amex auto-add needs: its pages, how cards are read, its autopilot's pace
lib/issuers/chase.js   the same for Chase, plus the readers for its account and offer labels
lib/issuers/capitalone.js  the same for Capital One, plus the readers for its card labels
lib/issuers/capitaloneshopping.js  the same for Capital One Shopping: no cards, one run of its autopilot
lib/livefile.js        the live copy: offers.json / offers.csv in the folder you pick
lib/ai.js              Ask AI: ChatGPT, Claude or Gemini (dashboard)
lib/mcpb.js            builds the Claude Desktop plugin file, Offer Hub.mcpb (dashboard)
lib/theme.css          shared look
content/scraper.js     the per-site autopilots (page context); auto-add runs the bank and Capital One Shopping ones too
content/bridge.js      passes autopilot saves to the service worker
content/auto-core.js   auto-add in the page, for every bank: the background tab's link to the service worker, running the bank's autopilot step by step, notes in your tab
content/amex-auto.js   Amex steps: read and switch cards, then Run Amex Autopilot
content/chase-auto.js  Chase steps: the accounts page, Choose account, then Run Chase Autopilot with its two waits
content/capitalone-auto.js  Capital One steps: View all offers on the home page, the card menu, then Run CapitalOne Autopilot on each card
content/capitalone-main.js  from the page: View all offers opens in the run's tab; Capital One's card menu takes a pick only through React's own handlers, this plays one
content/capitaloneshopping-auto.js  Capital One Shopping steps: wait for the offers, then Run CapitalOne Shopping Autopilot; nothing goes on either page
popup/                 toolbar popup
sidepanel/             a run's panel in Chrome's side panel (Capital One Shopping), beside the page it reads
dashboard/             full-page dashboard
bookmarklets/          the original bookmarklet scripts
mcp/offer-hub-mcp.js   the plugin: lets AI apps on this computer search offers.json (Node 18+, no dependencies)
tests/                 node --test tests/*.test.js (no dependencies)
tests/browser/         node tests/browser/chase-auto.check.js (and amex-auto.check.js, capitalone-auto.check.js): auto-add with the real autopilots on made-up pages in headless Chrome
                       capitaloneshopping.check.js: Run CapitalOne Shopping Autopilot on a made-up home page that adds offers as it scrolls, and auto-load in a hidden background tab
```

## Saved data

Everything is in `chrome.storage.local`:

| Key | What it holds |
| --- | --- |
| `UOH_Database` | Every offer, keyed `<source>_<card>_<merchant>` (the card: Amex's own id for it, Chase's account id, Capital One's last 4): merchant, offer text, source, card, expiry, status, first and last seen, and for Capital One Shopping the store's site |
| `UOH_Settings` | Toggles, card nicknames, card owners, card order, the Ask AI character and the minutes a Capital One Shopping run reads |
| `UOH_AutoState` | Auto-add history (last run, per-card times) |
| `UOH_Categories` | Categories saved for merchants the built-in lists don't cover |
| `UOH_LiveFile` | Live copy status |
| `UOH_AIConfig` | Ask AI: the AI in use, your keys and chosen models (never exported) |
| `UOH_LastRunCount`, `UOH_LastRunAt`, `UOH_UIState` | Last autopilot run and popup filters |

While Chrome is open, `chrome.storage.session` also holds what each bank's home page showed this session: who is signed in and, for Capital One, each account's last 4 with its fingerprint. Chrome clears it when it closes.

**Clear all** in the popup deletes every saved offer, the last auto-add summary and the categories, and empties the live copy. Settings, nicknames, card order, the 2-hour auto-add timers and your Ask AI keys stay.

## Feedback

Bugs and requests: [open an issue](../../issues), or message [u/pateljay134](https://www.reddit.com/user/pateljay134/) on Reddit. Free, no subscriptions.

## License

See [`LICENSE`](./LICENSE).
