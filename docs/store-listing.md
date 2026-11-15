# Store listing

> Read this before changing store copy, the manifest description, onboarding text, or before submitting a release
> to the Chrome Web Store or Firefox Add-ons (AMO). Voice: docs/style-guide.md → Voice and copy.

**Rule:** every listing names only features that have shipped. When a feature ships, update this file, the
manifest description (`package.json` → `description`), the popup and onboarding strings, and the `UNSHIPPED`
list in `scripts/store-copy.test.ts`, all in the same change.

## Name

dummify

## Short description / summary

Used as the manifest description (Chrome shows it as the summary; ≤ 132 characters) and as the AMO summary.
Its source of truth is `package.json` → `description`.

> dummify takes the "smart" out of the web: hides AI answers, YouTube Shorts, and algorithmic search suggestions.

## Long description

Plain text, so it reads the same in both stores (Chrome shows no formatting).

```text
dummify takes the "smart" out of the web.

It quietly hides the features that try to think for you:

• AI features: AI Overviews and AI Mode in Google Search, plus "Ask AI" and "Summarize with AI" buttons and AI chat widgets on other sites.
• Short-form video: YouTube Shorts across YouTube, and the short videos in Google Search. A Short someone sends you still plays, but the endless feed of more Shorts doesn't.
• Search suggestions: "People also ask", related searches, suggested refinements, and autocomplete in Google Search.

Known features are hidden before the page draws them, so nothing flashes on screen.

The toolbar button shows how much was hidden on the page. From there you can choose what to hide, and turn dummify off for one site or everywhere.

Private by design: dummify makes no network requests and collects no data. Your settings stay in your browser.

Open source under the MIT license.
```

## Links

- **Homepage / source:** https://github.com/aaikon/dummify
- **Support:** https://github.com/aaikon/dummify/issues
- **Privacy policy:** https://github.com/aaikon/dummify/blob/main/PRIVACY.md (`PRIVACY.md`)

These links work only once the repository is public.

## Graphics

| Asset                                   | Size                      | Source                                       |
| --------------------------------------- | ------------------------- | -------------------------------------------- |
| Store icon (Chrome, required)           | 128×128 PNG               | `public/icon/128.png`                        |
| Add-on icon (AMO)                       | from the manifest         | `public/icon/*.png`                          |
| Screenshots (Chrome: 1–5, required)     | 1280×800 PNG, no alpha    | kept outside the repo, see below             |
| Screenshots (AMO, optional but shown)   | same files                |                                              |
| Small promo tile (Chrome)               | 440×280 PNG, no alpha     | `store/promo-small.png`, from `store/promo-small.html` (render command inside) |

**Screenshots (0.1.x):** four shots, uploaded in this order:

1. Google, "How to boil an egg?", dummify on: no AI Overview, AI Mode tab, refinement chips, or "People also ask".
2. The same search with dummify off.
3. YouTube search, dummify on: no Shorts shelf or Shorts filter.
4. The same search with dummify off.

They show other people's thumbnails, faces, and channel names, so they're **never committed** to this public repo.

**How they're made** (repeat this when retaking them):

- **Capture:** a real browser window. Any theme works (the current set is dark). On Google, sign out or crop away
  the account avatar.
- **Crop:** to the page content just below the browser toolbar, which drops the tabs, the add-on icons, and the
  avatar, at the 1280×800 ratio (16:10). Then scale to exactly 1280×800.
- **Cursor:** paint over the screenshot tool's cursor with the flat background color.
- **Label:** a pill in the top-right corner, Geist 600 16px, rendered with headless Chromium. "With dummify" is Ink
  on Crash Yellow with the tile mark. "Without dummify" is Ink on Paper. Without the labels, the "off" shots would
  show an AI Overview in dummify's own listing.

Follow docs/style-guide.md: no sparkle or AI imagery in captions or framing, and no hype.

## Chrome Web Store: Privacy practices tab

- **Single purpose:** dummify hides "smart" features on the web pages the user visits (AI answers and AI widgets,
  short-form video feeds, and algorithmic suggestions) so they see a calmer, less algorithmic web.
- **`storage`:** saves the user's settings (which kinds of content to hide, and the sites where dummify is off)
  and the per-tab count of hidden items shown on the toolbar badge. Nothing leaves the browser.
- **`activeTab`:** when the user opens the popup, dummify reads the current tab's address so it can show and
  change the setting for that site.
- **Host permission (`<all_urls>`):** hiding these features is the extension's single purpose, and they appear on
  any site. The content script must run at document_start on every page to hide them before they're drawn. Site
  rules cover major platforms (Google Search, YouTube). Generic detectors find AI widgets, such as "Ask AI" buttons
  and AI chat widgets, on other sites. The script reads the page structure in the browser only to decide what to
  hide. It hides elements by adding a stylesheet and a data attribute, and never stores or sends page content.
  The extension makes no network requests.
- **Remote code:** No, I am not using remote code. All code ships in the package.
- **Data usage:** collects none of the listed data types. Certify all three statements (not sold to third parties,
  not used for unrelated purposes, not used for creditworthiness or lending).
- **Category:** Tools (or Well-being).

## Firefox Add-ons (AMO)

- **Upload:** `.output/dummify-<version>-firefox.zip`, "On this site" (listed).
- **Source code:** Yes, required, because the code is bundled. Upload `.output/dummify-<version>-sources.zip`.
- **Notes to reviewer** (fill in the versions that `scripts/check-release.sh` prints):

  ```text
  Built with WXT (Vite) from the attached sources zip. Build environment: Linux, Node.js <node>, npm <npm>.
  To rebuild: npm ci && npm run zip:firefox
  Output: .output/firefox-mv3/ (unpacked) and .output/dummify-<version>-firefox.zip, identical to the upload.
  The add-on makes no network requests and collects no data (data_collection_permissions: none).
  ```

- **Categories:** Search Tools, Social & Communication.
- **License:** MIT. **Privacy policy:** paste `PRIVACY.md`.
- **Minimum versions:** Firefox 140 on desktop, 142 on Android (`gecko_android`), the first versions that support
  `data_collection_permissions`. Android isn't tested yet, so leave it unticked at upload until it is.

## Release checklist

1. Merge `dev` into `main` (`git merge --no-ff`) and tag `v<version>` on `main`.
2. From a clean checkout of the tag, run `scripts/check-release.sh`. It builds the three zips into `.output/`,
   checks that the sources zip contains only files tracked by git, and checks that a rebuild from it is identical
   to the Firefox zip.
3. Run Mozilla's linter: `npx web-ext lint --source-dir .output/firefox-mv3`. It must report no errors.
4. Upload `dummify-<version>-chrome.zip` to the Chrome Web Store, and the Firefox zip plus the sources zip to AMO,
   using the copy and answers above.
