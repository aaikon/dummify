# Visual style guide

> Read this before building or changing any UI: the popup (`src/entrypoints/popup/**`), options/onboarding pages,
> any `*.css`, toolbar icon/badge behavior, or store screenshots and icons. Change values **here** first and code
> second.

## Baseline

The look is based on an owner-provided reference page (a modern product landing page, saved 2026-11-13; not
committed, as it's third-party content). From it we adopt:

- a **monochrome ink-on-paper** palette: near-white/near-black surfaces, text as "ink", and primary buttons
  that invert the theme (ink fill, paper text)
- **alpha-based hairlines and fills** (black/white at 4–15%) instead of fixed gray borders
- **compact UI type**: 13px base, medium weight, tight tracking on headings
- **pill-shaped buttons and chips**, 7px controls, 12px panels
- **soft layered shadows** on the one floating surface (the dropdown)
- **quick, smooth motion**: 150–300ms with an ease-out-quint curve and tiny 2px slide-ins

What we deliberately **don't** take:

- its multi-hue brand palette (violet, magenta, cyan … "agent" colors)
- its proprietary font, logo, mascots, and illustrations
- any value that fails WCAG AA. The baseline's focus ring (ink/30%), status green `#00c972`, and red `#e5484d`
  are too faint for text or controls on white, so the darker variants are listed below.

## Brand

From the owner's logo sheet ("Final logo", T-029). Source mark: `src/assets/brand/mark.svg`; PNGs via
`scripts/build-icons.sh` → `public/icon/`.

- **Tile mark:** a crash-test marker (quartered disk, top-left and bottom-right in Crash Yellow) inside a Crash Yellow
  ring on an Ink rounded tile (corner radius ≈ 24% of the tile). Never recolor, rotate, or crop it, and don't add
  effects.
- **Wordmark:** "dummify" in **Bricolage Grotesque ExtraBold (800)**, tracking −3.5%, **always lowercase**. Bundled
  (latin-800 only, OFL). Use the `lockup(size)` helper (`src/ui/brand.ts`): tile + word, gap = 0.24 × type size, one
  accessible label "dummify".
- **On dark:** the ink tile gets a subtle 1px light edge (`.lockup-mark` in dark mode), as on the sheet.
- **Colors:** Crash Yellow `#FFC400`, Ink `#111111`, Paper `#FAFAF7`. Crash Yellow is a fill or an accent on Ink/dark,
  and **never text or an outline on Paper** (1.5:1). Ink on Crash Yellow is 11.8:1.
- **Where the brand appears:** the toolbar icon, the popup header lockup, the onboarding hero (Ink on a Crash Yellow
  panel, like the sheet's "stacked" version), and the count badge (Ink on Crash Yellow). The rest of the UI stays
  monochrome (ink/paper) per the personality below.

## Personality

dummify removes noise, so its own UI must be **quiet, plain, and fast**. It's a utility, not a showcase.

- **Monochrome first:** ink and paper do almost all the work. Color appears only as a small status signal
  (active, warning, error), never as decoration.
- **Honest:** say exactly what happened ("3 hidden on this page"). No hype, no exclamation marks.
- **Anti-AI-aesthetic:** never use the ✨ sparkle, purple/blue AI gradients, "magic" wording, chat-bubble
  motifs, or bot/agent mascots. Those are what we hide, and our heuristics (T-009) look for them.

## Design tokens

Tokens are CSS custom properties defined once in `src/ui/tokens.css` (created with the first UI, T-010) and
used everywhere. **Never hard-code a color, size, or radius in component CSS.** Use a token, or add one here first.
Implement the themes with `color-scheme: light dark` and `@media (prefers-color-scheme: dark)`. Both themes are
required.

### Color

| Token                  | Light       | Dark        | Use                                                       |
| ---------------------- | ----------- | ----------- | --------------------------------------------------------- |
| `--color-bg`           | `#fafaf7`   | `#16161a`   | Popup / page background (brand Paper in light)            |
| `--color-card`         | `#ffffff`   | `#1f1f24`   | Floating surfaces (settings dropdown)                     |
| `--color-fill`         | `#eeeeeb`   | `#2d2d31`   | Subtle control fills: secondary buttons, chips, hovered rows (≈ black 5% / white 10%) |
| `--color-fill-hover`   | `rgb(0 0 0 / 0.07)` | `rgb(255 255 255 / 0.15)` | Hover/pressed state on fills             |
| `--color-hairline`     | `rgb(0 0 0 / 0.10)` | `rgb(255 255 255 / 0.15)` | 1px inset rings and dividers (decorative only) |
| `--color-ink`          | `#111111`   | `#f4f4f5`   | Primary text, icons, switch "on", primary button fill (brand Ink in light) |
| `--color-on-ink`       | `#fafaf7`   | `#16161a`   | Text on an ink fill (primary button)                      |
| `--color-secondary`    | `#60605f`   | `#a9a9ab`   | Secondary text, hostnames, hints (ink at 66%)             |
| `--color-control`      | `#7a7a78`   | `#909092`   | Switch "off" track, checkbox outlines, focus ring (ink at 55%) |
| `--color-ok`           | `#00733f`   | `#3ee09a`   | "Active" status text; light value is also the badge background |
| `--color-ok-bg`        | `#ebfbf4`   | `#132b25`   | Status pill background                                    |
| `--color-ok-dot`       | `#00c972`   | `#00c972`   | Decorative status dot (always next to text)               |
| `--color-danger`       | `#cd2834`   | `#fd5c6a`   | Error text and destructive actions                        |
| `--color-warn`         | `#9a3f0c`   | `#f5a46e`   | Warning banner text                                       |
| `--color-warn-bg`      | `#fcebe2`   | `#452a1e`   | Warning banner background                                 |

Disabled controls use `opacity: 0.5` on the whole control (as in the baseline), never a separate gray.

Measured contrast (WCAG 2.2, computed 2026-11-13; light values re-measured for the brand Ink/Paper in T-029:
ink on paper 18.1, on card 18.9, on fill 16.2; secondary on paper/card/fill 6.0/6.3/5.4; control on paper/card 4.1/4.3;
on-ink 18.1; ok on paper 5.7; danger on paper 5.1). Re-check any changed value:

| Pair                                    | Light         | Dark          | Requirement            |
| --------------------------------------- | ------------- | ------------- | ---------------------- |
| ink on bg / card / fill                 | 18.0 / 18.0 / 16.1 | 16.4 / 14.9 / 12.5 | ≥ 4.5 text   |
| secondary on bg / card / fill           | 5.8 / 5.8 / 5.2 | 7.7 / 7.0 / 5.8 | ≥ 4.5 text          |
| on-ink on ink (primary button)          | 18.0          | 16.4          | ≥ 4.5 text             |
| control on bg / card                    | 4.0 / 4.0     | 5.7 / 5.2     | ≥ 3.0 UI component     |
| ok on ok-bg / on bg                     | 5.6 / 6.0     | 8.8 / 10.6    | ≥ 4.5 text             |
| danger on bg / card                     | 5.3 / 5.3     | 5.9 / 5.4     | ≥ 4.5 text             |
| warn on warn-bg                         | 5.9           | 6.5           | ≥ 4.5 text             |
| badge: white on `#00733f`               | 6.0           | (same)        | ≥ 4.5 text             |

**Never rely on color alone.** Every state also has text, an icon, or a shape change (e.g. the switch knob
position, the "Active" label next to the green dot).

### Typography

- **Font:** `--font-sans: "Geist Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. _Proposed:_
  bundle Geist (SIL OFL) from the `@fontsource-variable/geist` package in T-010. It's packaged with the extension,
  so there are **no remote font requests** (privacy invariant). If bundling isn't worth the ~30–60 kB, drop the
  first entry and the system stack takes over.
  Counts and hostnames may use `--font-mono: "Geist Mono Variable", ui-monospace, monospace`, same rule.
- **Scale** (UI is compact, like the baseline): `--font-2xs: 11px` (badges, fine print) · `--font-xs: 12px`
  (section labels, hints) · `--font-sm: 13px` (**default** UI text, labels, buttons) · `--font-md: 15px` (popup
  title) · `--font-lg: 20px` (the big count).
- **Weights:** 400 for running text, **500 for labels and buttons** (the baseline's default), 600 for the title
  and count. Nothing heavier.
- **Line height:** 18px for 13px single-line labels, 1.6 for multi-line hints. Headings and the count use
  `letter-spacing: -0.01em` (tight).
- **Numbers** use `font-variant-numeric: tabular-nums` so counts don't jitter when they update.
- Render with `-webkit-font-smoothing: antialiased`.

### Spacing, size, shape

- **Spacing scale (2px half-steps, like the baseline):** `--space-0_5: 2px` · `--space-1: 4px` ·
  `--space-1_5: 6px` · `--space-2: 8px` · `--space-2_5: 10px` · `--space-3: 12px` · `--space-4: 16px` ·
  `--space-6: 24px`. Use only these. Most gaps are 6–8px.
- **Control heights:** `--h-chip: 26px` · `--h-button: 30px` · `--h-row: 36px` (setting rows, switch rows).
  All exceed WCAG's 24px minimum target.
- **Radius:** `--radius-control: 7px` (inputs, switch knob track, small icon buttons) · `--radius-panel: 12px`
  (dropdown, banners) · `--radius-pill: 9999px` (buttons, chips, status pill, badge).
- **Popup:** fixed width `320px`, content height ≤ `560px` (browsers cap popups at 800×600), outer padding
  `--space-4`.
- **Borders:** draw them as inset rings, not `border`, so they don't shift layout:
  `box-shadow: inset 0 0 0 1px var(--color-hairline)`.
- **Elevation:** only the settings dropdown floats, with
  `--shadow-popover: 0 0 0 1px rgb(0 0 0 / 0.04), 0 14px 32px -8px rgb(50 50 93 / 0.24), 0 4px 10px -4px rgb(0 0 0 / 0.1)`.
  In dark mode, use `0 0 0 1px rgb(255 255 255 / 0.10), 0 14px 32px -8px rgb(0 0 0 / 0.6), 0 4px 10px -4px rgb(0 0 0 / 0.4)`.
  Nothing else casts a shadow.

### Motion

- `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`.
- Durations: `--duration-fast: 150ms` (color/hover) · `--duration: 200ms` (switch, small UI) ·
  `--duration-slow: 300ms` (dropdown open/close).
- **Entrance:** fade in plus a 2px slide (`translateY(2px)` → `0`), as in the baseline. No bounces or scale-pops.
- Only animate `opacity`, `transform`, and colors. Under `@media (prefers-reduced-motion: reduce)`, set durations
  to `0ms`.
- No looping animations. Nothing in dummify's UI moves unless the user just acted.

### Focus

`outline: none; box-shadow: 0 0 0 3px var(--color-control)` on `:focus-visible`, which matches the baseline's
soft ring at an accessible strength. Combine it with an existing inset ring by listing both shadows. Every
interactive element must show it.

## Components

Build these once and reuse them. Use native elements first, and add ARIA only when the native element can't
express it.

### Popup layout (T-010)

All settings live in the main view. There's no settings dropdown (T-015 dropped by the owner on 2026-11-13: the
popup is uncrowded as it is).

```
┌──────────────────────────────────────┐
│ ■ dummify                            │  header: brand lockup (17px)
│ ⚠ dummify needs access…      (Allow) │  warning banner, only when site access is missing (T-011)
├──────────────────────────────────────┤  hairline divider
│ example.com             ● Active     │  host (secondary) + status pill
│ dummify this site             [━━●]  │  primary switch row (--h-row), the main action
│ 3 / hidden on this page              │  count (--font-lg/600, tabular) + label
├──────────────────────────────────────┤
│ What to hide                         │  section label (--font-xs/500, secondary), h2
│ AI features                   [━━●]  │  one switch row per category, with a one-line hint (ADR-008)
│ Short-form video              [━━●]  │
│ Suggestions                   [━━●]  │
├──────────────────────────────────────┤
│ On everywhere                 [━━●]  │  global switches
│ Detect AI on other sites      [━━●]  │  disabled (greyed) while AI features are off
└──────────────────────────────────────┘
```

- A new kind of content becomes a fourth "What to hide" row. A new global setting goes in the bottom section. If the
  popup outgrows ~560 px, revisit the settings dropdown spec below.
- The **site switch** is the first focusable element after the header.
- **Status pill:** `● Active` (ok dot + ok text on ok-bg) when blocking runs on this site. `Off on this site`
  (secondary text on fill, no dot) when it doesn't.
- **Unsupported pages** (`chrome://`, `about:`, store pages) replace the switch with secondary text: "dummify can't
  run on this page."
- **Zero state:** "Nothing hidden on this page", in secondary text. It's never an error.

### Switch

- Native `<input type="checkbox" role="switch">` with a visible `<label>`. The whole row is clickable.
- Track 32×18px, `--radius-pill`. Knob 14px, `--color-bg`.
- **On:** `--color-ink` track, knob on the right. **Off:** `--color-control` track, knob on the left. The knob
  slides with `--duration` / `--ease-out`.
- Monochrome on purpose: green means "status", not "control".

### Buttons

| Variant   | Look                                                                    | Use                                  |
| --------- | ----------------------------------------------------------------------- | ------------------------------------ |
| Primary   | `--color-ink` fill, `--color-on-ink` text, pill, `--h-button`, 0 12px padding, 13px/500 | At most one per view (e.g. "Allow") |
| Secondary | `--color-fill` fill, `--color-ink` text, pill, hover `--color-fill-hover` | Everything else                   |
| Ghost     | transparent, `--color-secondary` text → `--color-ink` on hover            | Low-emphasis inline actions ("Remove") |
| Icon      | 30×30, `--radius-control`, transparent → `--color-fill` on hover, `aria-label` required | Header settings button |

Hovers transition `background-color` and `color` over `--duration-fast`. Pressed states may scale to `0.98`.

### Settings dropdown (not used; T-015 dropped)

> Kept for reference in case settings outgrow the main view. Not implemented, so don't build it without a new task.


- A **disclosure**, not an ARIA `menu`, because it holds switches and links rather than commands. It's a
  `<button aria-expanded aria-controls>` (the icon button in the header) that toggles a panel inside the popup.
- The panel is `--color-card`, `--radius-panel`, `--shadow-popover`, anchored under the header, right-aligned,
  full popup width minus `--space-2` gutters. It opens with the entrance motion at `--duration-slow`.
- Keyboard: Enter/Space toggles; Esc closes and returns focus to the gear button; Tab moves through the
  controls in order. Clicking outside closes it.
- Contents are grouped under small section labels (`--font-xs`, 500, `--color-secondary`, sentence case):
  "Blocking" (global on/off, heuristics on/off), "Sites" (sites where dummify is off, each with a ghost "Remove"),
  and "Google" (Web results only, T-014).
- Each row is a switch row (`--h-row`). An optional one-line hint goes under the label (`--font-xs`, secondary).
  Separate groups with a hairline divider.

### Warning banner

`--color-warn-bg` background, `--color-warn` text (13px/500), `--radius-panel`, `--space-2_5` padding, a leading
⚠ glyph, and at most one primary action. Use it only for states that stop dummify from working (missing
permission, extension disabled). Never use it for promotion or tips.

### Toolbar icon and badge

| State                         | Icon                     | Badge                                                        |
| ----------------------------- | ------------------------ | ------------------------------------------------------------ |
| Active, something hidden      | full tile mark           | count, Crash Yellow `#FFC400` background, Ink `#111111` text, `99+` cap |
| Active, nothing hidden        | full tile mark           | none                                                         |
| Off for this site / globally  | tile mark at 40% opacity | none                                                         |
| Missing host permission       | tile mark at 40% opacity | `!`, `#9a3f0c` background, white text                        |
| Browser pages (can't run)     | full tile mark (neutral) | none                                                         |

The icon is the brand tile mark (see Brand), shipped as PNGs at 16/32/48/96/128 plus `dim-*` variants at 40% opacity.
States switch per tab (`src/platform/icon.ts`) when settings, site access, or the tab's URL change. The ink tile reads
on light and dark toolbars (checked at 16/32/48 px on #f9f9fb, #2b2a33, #3c3c3c).

## Voice and copy

- **Sentence case** everywhere ("Detect AI on other sites", not "Detect AI On Other Sites").
- Use the verb **"hide"** in UI copy ("3 hidden"), because it's what actually happens and it's reversible.
  "Block" is fine in store copy, and for whole-site blocks (TikTok, T-021).
- **"dummify" as a verb** is the main action: "dummify this site". It names the effect across all three kinds
  of content (AI, short-form video, suggestions), so don't add "AI" to copy that covers everything.
- **Tagline:** dummify takes the "smart" out of the web. Use it verbatim in store listings, onboarding, and the
  manifest description.
- Use digits for numbers ("3 hidden").
- Keep messages short: one sentence, no exclamation marks, no emoji, no blame ("dummify can't run on this
  page", not "You can't use dummify here").
- **Product name:** always lowercase **dummify**, even at the start of a sentence or a title.
- **Localization-ready:** all user-facing strings go through `browser.i18n` / WXT i18n once added. Never
  concatenate translated fragments.

## Accessibility checklist (every UI change)

- [ ] Contrast meets the tables above in **both** themes, and any new pairing has been measured
- [ ] Everything is reachable and operable by keyboard, and the `:focus-visible` ring always shows
- [ ] Every control has an accessible name, and icon-only buttons have `aria-label`
- [ ] No information is conveyed by color alone
- [ ] Works at 200% zoom inside the 320px popup without horizontal scrolling
- [ ] `prefers-reduced-motion` respected
