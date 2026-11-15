# Architecture

> Read this before changing module structure, adding files under `src/`, changing cross-module imports, or
> touching the rule model, the engine, settings, or messaging. Update it in the same change as any structural change.

## Overview

dummify is a Manifest V3 extension with no server and no network access. A **content script** runs at
`document_start` on every page. It picks the **rules** for the current host, then hands them to the **engine**.
The engine hides matches with an injected stylesheet (before first paint) and tags anything it finds in JS with
`data-dummify="<rule id>"`. **Settings** (global and per-site on/off) live in `storage.sync`, and changes apply
live in every open tab. The content script reports a per-tab **blocked count** to the **background** worker,
which keeps it in `storage.session` for the popup and badge (T-010).

## Components

| Component          | Location                              | Responsibility                                                         | May depend on              |
| ------------------ | ------------------------------------- | ---------------------------------------------------------------------- | -------------------------- |
| Rule model         | `src/core/rule.ts`                    | `Rule`/`TextAnchor` types, `rulesForHost`                              | `core/host`                |
| Host handling      | `src/core/host.ts`                    | `normalizeHost` (site key), `hostMatches` (rule host patterns)         | nothing                    |
| Engine             | `src/core/engine.ts`, `src/core/css.ts` | Stylesheet injection, initial scan, MutationObserver, tagging, count | `core/*` only, DOM APIs    |
| Behaviors          | `src/core/behavior.ts`, `src/behaviors/*.ts` | Small DOM-only site code for what CSS can't do (e.g. blocking wheel/keys that advance the Shorts feed); started/stopped by the controller with the same switches as rules (ADR-007) | `core/host`, DOM APIs |
| Heuristics         | `src/core/heuristics.ts`, `src/core/text.ts` | Generic AI-widget detectors (control / region / vendor) + size guard + AI-product host exclusions | `core/host`, DOM APIs |
| Settings (pure)    | `src/core/settings.ts`                | `Settings` shape, defaults, `isBlockingActive`                         | nothing                    |
| Messages           | `src/core/messages.ts`                | Message types + runtime guards                                         | nothing                    |
| Rules              | `src/rules/*.ts`, `src/rules/index.ts` | Per-site rule **data**; `ALL_RULES` registry                          | `core/rule` (types only)   |
| Platform adapters  | `src/platform/*.ts`                   | Everything that touches extension APIs: storage items, content controller, count handler | `core/*`, WXT `storage`/`browser` |
| Popup UI           | `src/popup/*.ts`                      | `mountPopup`: renders the site switch, status, count, and global switches, kept live from storage | `core/*`; storage items are injected |
| UI tokens/styles   | `src/ui/*.css`                        | Design tokens + shared components from docs/style-guide.md             | nothing                    |
| Feature flags      | `src/core/features.ts`                | Hides UI for settings whose feature isn't shipped yet (heuristics)     | nothing                    |
| Site access        | `src/platform/access.ts`              | `<all_urls>` check/request, onboarding-on-install, global "!" badge sync (`browser.permissions` injected) | `platform/badge` |
| Onboarding UI      | `src/onboarding/*.ts`                 | `mountOnboarding`: explains + requests site access, live state         | `ui/dom`; permission calls injected |
| Toolbar icon       | `src/platform/icon.ts`, `public/icon/*.png` | Per-tab icon state (active / dim) from settings, site access, and tab URL; synced on settings, permission, and navigation changes (T-029) | `core/host`, `core/settings` |
| Brand              | `src/assets/brand/mark.svg`, `src/ui/brand.ts` | Tile mark (source for icons) and the `lockup()` helper used in popup + onboarding | `ui/dom` |
| Badge              | `src/platform/badge.ts`               | Per-tab toolbar badge text/colors (`browser.action` injected)          | nothing                    |
| Entrypoints        | `src/entrypoints/*`                   | WXT wiring only: call into `platform/` and `popup/`                    | `platform/*`, `popup/*`, `rules/*` |
| Third-party notices | `scripts/third-party-notices.ts` (build time, via a `wxt.config.ts` hook) | Writes `THIRD_PARTY_NOTICES.txt` (license + copyright of every bundled font and library) into each build (T-032). **Register anything new that ships in the bundle in `BUNDLED_PACKAGES`.** A test fails if a font imported by `src/**/*.css` is missing | node `fs` only, never imported by `src/` |
| Store packaging | `scripts/store-sources.ts` (allowlist for the AMO sources zip, via `wxt.config.ts`), `scripts/check-release.sh` | Builds the store zips. The sources zip takes only allowlisted files, and a test fails if any of them isn't tracked by git. A rebuild from it must be byte-identical (T-013) | node only, never imported by `src/` |

## Data flow

```
page load (document_start)
  └─ content.ts → startContentController(doc, url, ALL_RULES)
       ├─ normalizeHost(url) → host            (null → exit: non-web page)
       ├─ rulesForHost(ALL_RULES, host)
       ├─ heuristics allowed? FEATURES.heuristics && !AI-product host
       │     (no rules AND no heuristics → exit: zero cost)
       ├─ createBlocker(rules, heuristics=default on).start()   ← synchronous, BEFORE settings load (no flash)
       │    ├─ inject <style data-dummify-style> with all rule selectors + [data-dummify]
       │    ├─ scan(documentElement) once
       │    └─ MutationObserver(childList, subtree) → scan only added subtrees / text-node parents
       ├─ settingsItem.getValue() / watch()   → setHeuristics(settings.heuristics); active ? start() : stop()
       │     (a change event that arrives before the initial read wins; the stale read is ignored)
       └─ onCount → coalesced (250 ms) → runtime.sendMessage({type: 'dummify:blocked-count'})
background.ts
  ├─ onMessage → handleBlockedCountMessage → storage.session "blocked-count:<tabId>" (top frame only)
  │                                         └→ updateBadge(browser.action, tabId, count)  ("" at 0, "99+" cap)
  └─ tabs.onRemoved → clear that key
popup (popup.html → main.ts → mountPopup)
  ├─ tabs.query(active) → normalizeHost(tab.url)  (no URL / non-web → "dummify can't run on this page")
  ├─ read + watch settingsItem and blocked-count:<tabId> → render
  └─ switch changes → read-modify-write settingsItem (setSiteEnabled / enabled / heuristics)
       └→ storage.onChanged → every tab's content controller start()/stop() (no reload)
```

Settings live in `storage.sync` under `settings` with **schema version 2** (v2 added `heuristics`). Fields
are added with a WXT migration that fills defaults (`withDefaults`), and readers also apply `withDefaults`
defensively.

### How hiding works

- **Selector rules** go into the stylesheet, so they're hidden before first paint. The engine still tags matches
  so they count.
- **Anchor rules** (label text / aria-label, then `closest(container)`) run in JS when nodes are inserted. They can
  flash briefly, so prefer selectors whenever a stable one exists.
- Hiding is **CSS-only**: nodes are never removed or modified apart from the `data-dummify` attribute. `stop()`
  removes the stylesheet, which makes everything visible again with no other cleanup, and is how per-site toggling
  works without a reload.
- Label matching is normalized (whitespace collapsed, lowercased) and **exact** for strings, so "What is an AI
  Overview?" doesn't match the label "AI Overview". Candidates with text longer than 120 chars are skipped.

### Heuristics (T-009)

For sites without a rule, `findAiWidgets(root)` runs on the same scanned subtrees. Hits are tagged
`data-dummify="heuristic.<kind>"`, and their CSS line only exists while heuristics are on. Toggling heuristics
just rewrites the stylesheet (plus one rescan when turned on). Rule hits are tagged with the rule id and are
unaffected.

| Detector  | Hides           | Fires when                                                                                      |
| --------- | --------------- | ----------------------------------------------------------------------------------------------- |
| `control` | the button      | a button-like element (never a real-href link) has an exact AI action label ("Ask AI", "Summarize with AI", "Help me write", fi variants), **or** ≥ 2 weak signals agree: ✨/sparkle icon, AI word in its class/id, AI verb label ("Summarize") |
| `region`  | the box         | the element is AI-marked (class/id words like `ai-summary`, or `aria-label="AI summary"`) **and** contains a standalone disclaimer (short element starting "AI-generated…", "Generated by AI…", "AI responses may…", or an AI-mistakes warning) |
| `vendor`  | the widget      | its id/class names a third-party AI widget: Kapa, Inkeep, Mendable, DocsBot, Chatbase, SiteGPT, Algolia DocSearch Ask AI |

The **size guard** (`isSafeToHide`) rejects `html/head/body/main/article/[role=main|article]`, anything
containing those or an `h1`, and anything covering more than 50% of the viewport. Heuristics are **off on
AI-product hosts** (chatgpt.com, claude.ai, gemini.google.com, perplexity.ai, …), because the user went there for AI.

Deliberately not signals: "AI" in prose, headings, or navigation links. "Powered by AI" (marketing copy).
Generic support-chat launchers such as Intercom (can't be told apart from human support without verified markup).

**Cost** (happy-dom, slower than browsers): a full scan of a real 1,846-element Google page takes 0.55 ms, a
synthetic 10,000-element page 24.5 ms, and a 22-element insertion about 14 µs. Full scans happen only on
`start()` and when heuristics are turned on. At document_start the page is nearly empty, so most work is
spread over insertions.

## Boundaries & invariants

The rules that must stay true. Breaking one needs a decision record below.

- `src/core/` never uses extension APIs (`browser`, `storage`). It only uses the standard DOM, so it runs unchanged
  in happy-dom tests.
- `src/rules/` holds **data only**: no logic and no imports apart from types. All behavior belongs to the engine.
- Entrypoints are thin. Logic in them can't be tested, so it moves to `platform/`.
- The engine never tags `<html>`, `<head>`, or `<body>`, and never removes nodes.
- After `start()`, the engine never scans the whole document again. Mutation work is limited to the added
  subtrees, and a test checks this.
- The content script exits immediately when a host has no rules **and** heuristics are unavailable there
  (feature off or an AI-product host). Otherwise heuristics run on every page within the cost budget above.
- Heuristic precision is defended by tests: a negative corpus (`tests/fixtures/heuristics/negative/`, plus the
  real Google pages) must produce **zero** heuristic hits, and every protection (≥ 2 weak signals, size guard,
  disclaimer requirement, no real-href links) has a test that fails if it's removed.
- Only the top frame is handled for now (no `all_frames`). Embedded widgets are a later decision.
- No network: the only cross-context channel is `runtime.sendMessage` from content to background. The built
  bundle contains a `fetch` only in Vite's module-preload helper (it loads the popup's own chunks) and URLs only
  inside WXT error-message strings. Re-check with `grep -r fetch .output/` when adding dependencies.
- The popup never writes stale state: every switch does a read-modify-write of the latest stored settings.
- UI for unshipped features is hidden behind `src/core/features.ts`. Never show a switch that does nothing.

## Error handling

- Rules are validated structurally in `src/rules/rules.test.ts`: id format, unique ids, parseable selectors,
  non-empty hosts. Each selector is its own CSS rule, so a selector a browser can't parse only drops itself.
- `runtime.sendMessage` from the content script can reject while the extension is reloading or updating. We
  ignore it on purpose, and the next coalesced report recovers.
- Messages are validated with type guards (`isBlockedCountMessage`) before use. Unknown messages are ignored.
- Settings fall back to `DEFAULT_SETTINGS` (everything on) when storage is empty.

## Known limitations

- Heuristic vendor selectors (Kapa, Inkeep, Mendable, DocsBot, Algolia Ask AI) and the label lists come from
  public conventions, not from saved real pages. They're validated only against synthetic fixtures until
  real pages are added.
- Text changed in place (`characterData`) isn't observed. A heading whose text node is edited from something
  else to "AI Overview" won't match. Insertions are handled.
- The count is cumulative per document. SPA navigations within one document don't reset it.
- Elements matched by both a selector rule and an anchor container may be counted twice when they nest.

## Decision records

Newest first. Context → decision → consequences.

### ADR-008: Per-category switches (supersedes ADR-004's "one combined switch")
- **Date:** 2026-11-13
- **Context:** The owner asked for popup switches so users can customize what dummify hides. They chose per-category
  switches over per-feature or category-plus-details.
- **Decision:**
  - **Categories:** three, `ai`, `short-form`, `suggestions` (`CATEGORIES` in `src/core/rule.ts`). Every rule and
    behavior declares one (validated in `rules.test.ts`). Generic heuristics belong to AI: they run only while AI
    features are on, and they also keep their own "Detect AI on other sites" switch.
  - **Settings v3:** adds `categories` (missing entry = on), with a WXT migration so existing users keep everything
    on. "On everywhere" and the per-site switch still override all categories.
  - **Engine:** every hidden element is tagged with its group (`data-dummify-group`: a category or `heuristic`), and
    the stylesheet only contains lines for enabled groups. Toggling rewrites the stylesheet (content reappears with no
    DOM changes) and re-scans once when a group is turned on. Counts are kept per group.
  - **Content controller:** passes enabled categories to the engine and starts/stops each behavior with its category.
- **Consequences:** Users can keep, say, recommendations while hiding AI. The popup grows a "What to hide" section
  (6 switches total; checked to fit in about 480 px of the 560 px limit). If more switches are ever needed, revisit
  the dropdown spec (T-015). Rejected: per-feature switches (about 10 today and growing; would crowd the popup).

### ADR-007: Site behaviors for what CSS rules can't express
- **Date:** 2026-11-13
- **Context:** T-028 has to stop YouTube's Shorts player from advancing into suggested Shorts. CSS can hide the
  Next/Previous buttons and the queued reels, but not the mouse wheel or arrow keys, which YouTube's scripts turn into
  navigation. If the next reel were only hidden, the user would land on a blank page with their Short stopped.
- **Decision:** Add **behaviors** (`src/core/behavior.ts`, registry `src/behaviors/index.ts`):
  `{ id, hosts, start({doc, win, path}) → cleanup }`. The content controller starts the behaviors whose hosts match,
  while blocking is active on that host (same global and per-site switches as rules), and stops them otherwise and on
  dispose.
  - Rules: DOM only, event listeners only (no polling).
  - Decide at event time (the path is a function, for SPAs).
  - Always fully reversible.
  - First behavior: `youtube.shorts-feed-lock` intercepts wheel and ArrowUp/Down/PageUp/PageDown on `/shorts/` pages
    in the window capture phase (registered at document_start, before YouTube) and calls `preventDefault` +
    `stopImmediatePropagation`. It leaves typing, side panels (comments, description), menus, horizontal scroll,
    modifier shortcuts, and all other keys alone.
- **Consequences:** Rules stay the norm and behaviors are the exception, so prefer CSS whenever possible. A behavior is
  code running on real pages, so each needs real-page tests that it blocks what it should and nothing else, plus an
  owner live check. Rejected: hiding next reels with CSS alone (lands on a blank page), and patching YouTube's page
  scripts (fragile, and it would need page-world injection).

### ADR-006: Direct links to short-form content open normally
- **Date:** 2026-11-13
- **Context:** T-019 had to decide what happens when the user opens a `/shorts/` URL directly. The owner's principle:
  "the whole point of the extension is to avoid mindlessly clicking on algorithmically suggested short form content.
  Having the option to open one short form video a friend sends you doesn't defeat the point."
- **Decision:** dummify blocks the **algorithmic entry points** to short-form content (shelves, feeds, tabs,
  recommendations, search verticals), **not the content itself.** A direct link to a single Short/Reel/TikTok opens
  and plays normally. Rules must never hide the Shorts player on a `/shorts/<id>` page.
- **Consequences:**
  - T-019: closed. /shorts/ URLs play normally, and a regression test guards the player.
  - T-021 (TikTok) must follow this: direct video links (`tiktok.com/@user/video/<id>`) open, while the For You feed
    and browsing are blocked. "Block the whole site" was written before this decision.
  - Open question for a follow-up: past the linked Short, the Shorts player's "next Short" feed is itself
    algorithmic and could be hidden while the linked one plays.

### ADR-005: Declare `<all_urls>` host permission, plus onboarding for missing access
- **Date:** 2026-11-13
- **Context:** Firefox treats MV3 host permissions as optional. During the owner's tests nothing ran until
  "Always allow" or "Access your data for all websites" was granted by hand. Chrome users can also restrict
  site access. Without access, dummify silently does nothing.
- **Decision:**
  - Declare `host_permissions: ['<all_urls>']` in both browsers, so `permissions.contains/request` can target it.
  - On `runtime.onInstalled` with reason `install`, open `onboarding.html` **only if access is missing** (so
    Chrome users, who are granted at install, never see it).
  - The popup shows a warning banner with **Allow**, which opens the onboarding page rather than prompting
    from the popup, because Firefox closes the popup when a permission prompt opens and the request fails.
  - The background keeps a global `!` badge while access is missing (`permissions.onAdded/onRemoved` + every
    service-worker start).
- **Consequences:** No new install warning (the `<all_urls>` content script already shows "all websites"), no
  network capability, and the `permissions` API needs no extra permission. Rejected: prompting from the popup
  (fails in Firefox), and opening onboarding on every install (needless for Chrome users).

### ADR-004: Scope covers AI features, short-form video, and automated suggestions, under one switch
> **Partly superseded by ADR-008** (2026-11-13): each category now has its own switch. The scope part still stands.
- **Date:** 2026-11-13
- **Context:** The owner broadened dummify from AI features to also cover short-form video (YouTube Shorts,
  Instagram/Facebook Reels, TikTok) and automated suggestions (recommendation feeds/autoplay, search suggestions,
  writing suggestions). Pitch: "dummify takes the 'smart' out of the web."
- **Decision:**
  - One combined switch (global + per site). There are no per-category settings, by owner choice.
  - The rule model is unchanged: each rule file's header comment states which kind of content it covers.
  - Generic heuristics stay AI-only. Short-form and suggestions are handled by site rules.
  - UI copy names the effect, not the category: "dummify this site". Product invariants are generalized from
    "AI content" to "blocked content", with no weakening.
- **Consequences:** Simpler settings and UI, but users can't keep, say, recommendations while hiding AI. That
  could be revisited with per-category toggles in the settings dropdown (T-015) if users ask. Whole-site blocking
  (TikTok) needs a new mechanism (T-021). Rejected: separate category switches (owner preferred one switch).

### ADR-003: `activeTab` permission so the popup can read the current tab's URL
- **Date:** 2026-11-13
- **Context:** The owner's first Firefox test of the popup showed "dummify can't run on this page" on Google.
  `tabs.Tab.url` is only present with the `tabs` permission or a host permission for that tab. In Firefox MV3,
  host permissions aren't granted automatically (T-011), so the URL was withheld. Chrome was unaffected because
  `<all_urls>` content-script matches grant host access there.
- **Decision:** Add `activeTab`. When the user opens the popup, it grants temporary access to the active tab,
  which includes its URL. The popup also tells a withheld URL ("doesn't have access") apart from a non-web page
  ("can't run").
- **Consequences:** No install-time warning in either browser (`activeTab` isn't shown as a permission prompt), and
  no network capability. Rejected: `tabs` (shows "read your browsing history" at install, and gives access to
  every tab's URL all the time). Firefox still needs T-011 for the content script itself to run without the
  manual "Always allow".

### ADR-002: Popup in plain TypeScript + DOM, with a bundled Geist font
- **Date:** 2026-11-13
- **Context:** The popup (T-010) is small: one view, a few switches, a live count, and later a dropdown (T-015).
  The style guide (based on the owner's reference page) uses a Geist-like sans.
- **Decision:**
  - **No UI framework.** A tiny `h()` element builder (`src/popup/dom.ts`) plus targeted updates in `render()`.
  - Dependencies (active tab, settings item, count item, feature flags) are injected into `mountPopup`, so it's
    tested in happy-dom with WXT's fake storage.
  - **Geist Variable** (SIL OFL) is bundled from `@fontsource-variable/geist` (normal style, 5 unicode-range
    subsets, ~76 kB, only the needed subset loads). It's packaged in the extension, so there are no remote
    requests, with a system-ui fallback.
- **Consequences:** zero runtime dependencies and a ~15 kB popup chunk. If the UI grows well beyond T-015
  (an options page with many views), revisit with Preact. Rejected: React/Svelte (bundle size and build
  complexity for one small view); system font only (less faithful to the owner's chosen look).

### ADR-001: Manifest V3 extension built with WXT + TypeScript
- **Date:** 2026-11-12
- **Context:** dummify must run only as a browser extension, on both Chromium-based browsers and Firefox, from
  one codebase. Rules will grow into many per-site modules, so we need types and fast DOM-level tests.
- **Decision:**
  - **WXT** (0.21) for build, dev server, manifest generation, and per-browser output (`chrome-mv3`, `firefox-mv3`).
  - **TypeScript** (strict; pinned to 6.0.x because typescript-eslint doesn't support 7.x yet).
  - **Vitest** + **happy-dom** for tests, with WXT's fake-browser for the extension APIs.
  - **ESLint** (typescript-eslint, strict type-checked) + **Prettier**.
  - **npm** as package manager.
  - Firefox gets a fixed add-on ID and `data_collection_permissions: none` in `wxt.config.ts`.
- **Consequences:**
  - One source tree in `src/` (WXT `srcDir`), with entrypoints in `src/entrypoints/`.
  - Browser differences go through WXT's `browser` global and `import.meta.env.BROWSER`.
  - MV3 constraints apply: no remotely hosted code (fits the no-network invariant) and an event-driven background.
  - Rejected: Plasmo (React-centric, heavier); plain Vite (hand-maintained manifests per browser);
    vanilla JS (no types for a growing rule set).

### ADR-000: Template
- **Date:** YYYY-MM-DD
- **Context:** What forced a choice.
- **Decision:** What we picked.
- **Consequences:** What this makes easier or harder. Which alternatives we rejected and why.
