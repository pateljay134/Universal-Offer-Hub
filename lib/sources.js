/*
 * Universal Offer Hub — Sources Registry
 * ---------------------------------------
 * Single source of truth for every supported site.
 * Adding a new site is a 2-step process:
 *   1. Add a record here (used by the popup for auto-detection + branding).
 *   2. Add a matching `host.includes(...)` block inside content/scraper.js
 *      with the per-site autopilot (use any of the existing four as a template).
 *
 * Schema:
 *   id            stable string id, also stored as `site` on every offer
 *   name          full display name
 *   shortName     short label used on chips / compact UIs
 *   color         brand color used by the popup's "Run" button + tag pill
 *   hostPatterns  one or more substrings matched against window.location.host
 *   landingUrl    the page the user should open to run the autopilot
 *   blurb         one-line description shown beside the Run button
 */
// Distinct, subtle palette. We pick four well-separated hues so the chips,
// tags, and Run button never read as "error red" — and so two adjacent rows
// from different sources are always visually distinguishable.
window.UOH_SOURCES = [
  {
    id: "Chase",
    name: "Chase Offers",
    shortName: "Chase",
    color: "#1565C0", // deep blue
    hostPatterns: ["chase.com"],
    landingUrl: "https://secure.chase.com/web/auth/dashboard#/dashboard/offerhub/list/all",
    blurb: "Adds every available Chase Offer, then harvests your Added Offers history."
  },
  {
    id: "Amex",
    name: "American Express Offers",
    shortName: "Amex",
    color: "#00838F", // teal
    hostPatterns: ["americanexpress.com"],
    landingUrl: "https://global.americanexpress.com/offers/eligible",
    blurb: "Adds every eligible Amex Offer on the current page, then harvests your Added Offers."
  },
  {
    id: "Capital One",
    name: "Capital One Offers",
    shortName: "CapitalOne",
    color: "#558B2F", // forest green (was red → looked like an error state in the hub)
    hostPatterns: ["capitalone.com", "capitaloneoffers.com", "capitaloneshopping.com"],
    landingUrl: "https://myaccounts.capitalone.com/offers",
    blurb: "Loads every Capital One Offer (miles / percent / spend-get) into the hub."
  },
  {
    id: "Walgreens",
    name: "Walgreens Coupons",
    shortName: "Walgreens",
    color: "#6A1B9A", // purple
    hostPatterns: ["walgreens.com"],
    landingUrl: "https://www.walgreens.com/offers/offers.jsp",
    blurb: "Clips every available Walgreens coupon and saves the catalog locally."
  },
  {
    id: "Citi",
    name: "Citi Card Offers",
    shortName: "Citi",
    color: "#003B70", // Citi dark blue
    hostPatterns: ["online.citi.com", "citi.com"],
    landingUrl: "https://online.citi.com/US/nga/products-offers/merchantoffers",
    blurb: "Enrolls every available Citi merchant offer across all your eligible cards."
  }
];

/* Returns the source record for a given URL (or null). */
window.UOH_detectSource = function (url) {
  if (!url) return null;
  try {
    var host = new URL(url).hostname;
    return window.UOH_SOURCES.find(function (s) {
      return s.hostPatterns.some(function (p) { return host.indexOf(p) > -1; });
    }) || null;
  } catch (e) { return null; }
};
