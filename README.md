# dummify

dummify takes the "smart" out of the web.

A browser extension for Chrome and Firefox that hides the features that try to think for you. Known features are
hidden before the page draws them, so nothing flashes on screen.

## What it hides

- **AI features:** AI Overviews and AI Mode in Google Search, plus "Ask AI" and "Summarize with AI" buttons and AI
  chat widgets on other sites.
- **Short-form video:** YouTube Shorts across YouTube, and Google's "Short videos". A Short opened from a link
  plays, but the feed of more Shorts doesn't.
- **Automated suggestions:** "People also ask", related searches, suggested refinements under the search
  tabs, and search autocomplete in Google Search.

More sites are on the way: Instagram and Facebook Reels, TikTok, YouTube recommendations, Bing, and DuckDuckGo.

The popup has a switch for each kind of content, turns dummify on or off for the current site or everywhere, and
shows how much was hidden on the page.

## Private by design

dummify makes no network requests and collects no data. Your settings stay in your browser. It asks for access to
all sites only so it can hide things on them.

The full [privacy policy](PRIVACY.md) is short.

## Install

Store listings for Chrome and Firefox are coming. Until then, build it from source with Node.js 22 or newer:

```bash
npm install
npm run build            # Chrome:  .output/chrome-mv3
npm run build:firefox    # Firefox: .output/firefox-mv3
```

- **Chrome:** open `chrome://extensions`, turn on Developer mode, choose "Load unpacked", and pick
  `.output/chrome-mv3`.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, choose "Load Temporary Add-on", and pick
  `.output/firefox-mv3/manifest.json`.

## Store packages

To build the zips uploaded to the Chrome Web Store and Firefox Add-ons:

```bash
npm ci
npm run zip              # .output/dummify-<version>-chrome.zip
npm run zip:firefox      # .output/dummify-<version>-firefox.zip and the -sources.zip for Firefox Add-ons review
```

A rebuild from the sources zip (`npm ci && npm run zip:firefox`) gives an identical extension.
`scripts/check-release.sh` builds all three zips and checks this.

## Development

```bash
npm run dev              # Chrome with the extension loaded, reloads on change
npm run dev:firefox      # the same in Firefox
scripts/verify.sh        # typecheck, lint, and tests
```

How it works, and the conventions for site rules and tests, are in [`docs/`](docs/).

## License

[MIT](LICENSE). The bundled fonts, Geist and Bricolage Grotesque, are under the SIL Open Font License 1.1. Every
build includes their notices in `THIRD_PARTY_NOTICES.txt`.
