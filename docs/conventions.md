# Conventions

> Read this before writing or changing any `*.ts` file or test, or before branching or committing (see "Git").
> The formatter and linter run by `scripts/verify.sh` are the authority on mechanics. This doc covers what tools
> can't enforce.

## Code style

- **Readability first.** Write for the next reader. Clever code needs a comment explaining why.
- **Small units.** Keep functions to one job. If you can't name it without "and", split it.
- **Names say what, not how.** `pendingInvoices`, not `list2`. Booleans read as questions: `isReady`, `hasAccess`.
- **Comments explain why.** The code already shows what. A TODO must reference a task ID: `TODO(T-012): …`.

## Patterns

- **Keep side effects at the edges.** I/O, network, time, and randomness live in thin adapters. Core logic is pure and testable.
- **Validate at boundaries.** Parse external input into typed values once, at the edge.
- **Errors are explicit.** Fail loudly at boundaries, with messages that say what was expected and what was received.
- **Follow `architecture.md` boundaries.** If a change crosses one, update the doc first.

## Testing

- **Test behavior, not implementation.** Assert on outputs and observable effects.
- **Deterministic or deleted.** No real network, clock, or randomness in fast tests. Inject them.
- **Map acceptance criteria to tests** wherever possible.
- **Fast tests run in `verify.sh`.** Put slow, integration, or e2e tests behind a separate marker or directory.
- **Unit tests are colocated:** `src/core/host.ts` → `src/core/host.test.ts`. Shared helpers (fixture loading,
  `isHidden`, `flush`) live in `tests/helpers/`. Import fixtures with Vite's `?raw` suffix.
- **HTML fixtures** (saved real pages, trimmed) live in `tests/fixtures/<site>/`, with a matching
  `tests/<site>.test.ts`. Each site needs at least one positive fixture (has the AI feature) and one negative fixture.
  Name them `<what>.<locale>.html` (e.g. `ai-overview.fi.html`).
- **How to save:** server-rendered sites (Google) → "Save Page As → Web Page, HTML only". Client-rendered sites
  (YouTube, social media) → **"Web Page, complete"**, because "HTML only" keeps only the empty shell; keep the `.html`,
  ignore the `_files` folder. The sanitizer blanks all media sources (img/video/source), which can include the
  user's avatar.
- **Never commit a raw saved page.** Saves from a logged-in browser contain the account name, email, avatar, and
  session tokens. Always run `scripts/sanitize-fixture.py RAW OUT --redact "<full name>" --redact "<first>" --redact "<last>"`,
  then grep the output for the name and `@` before committing. Keep raw saves outside the repo.
- **Feeds and social pages must use `--strip-text`.** The repo is public, and these pages carry other people's names,
  handles, posts, and photos, which `--redact` can't catch. This covers YouTube, Instagram, Facebook, TikTok, X, and
  any page that shows other people's content. `--strip-text` replaces all text and text attributes with `Text`
  and turns URL paths, query values, and IDs into stable pseudonyms of the same length (`/@SomeChannel` →
  `/@p1xxxxxxxxxx`, the same video ID → the same pseudonym everywhere). It keeps structural path words (`watch`,
  `shorts`, `reel`, `p`, …) so `href` selectors still match. Pass every UI label a rule or test matches with
  `--keep-text` (e.g. `--keep-text Shorts --keep-text "Katso myöhemmin"`) and any other URL part a selector needs
  with `--keep-path`. Then run the site's tests. A failing label lookup means a missing `--keep-text`. Google search
  pages only show your own query, so they don't need it.
- **The sanitizer has a self-test** (`tests/sanitize-fixture/`: an input page and the expected output of each mode),
  run by `scripts/verify.sh`. If you change the script on purpose, regenerate the expected files with the arguments
  in `step_sanitizer` and review the diff line by line.
- **happy-dom quirk: no combinators inside `:has()`.** happy-dom evaluates `:has(a h3)` like `:has(a)`, so a rule
  using it passes or fails differently in tests than in browsers. Keep every `:has()` argument to one compound
  selector (`:has(h3)`, `:has([data-x])`, lists of compounds are fine). `src/rules/rules.test.ts` enforces this.
- **Prove each detection path separately.** When a rule has several ways of finding a feature (selectors and an
  anchor fallback), test each one alone. Simulate the other path breaking, e.g. strip the markers from the fixture.
- **Environment:** Vitest + happy-dom. Use WXT's fake `browser` (from `wxt/testing`) for extension APIs.
  Never hit the real network.

## Anti-patterns

| Don't                                                 | Do instead                                      |
| ----------------------------------------------------- | ----------------------------------------------- |
| Swallow exceptions (`catch {}` / `except: pass`)      | Handle meaningfully or let it propagate         |
| Leave commented-out code or dead code                 | Delete it; git remembers                        |
| Skip, delete, or loosen a failing test to go green    | Fix the code, or open a task explaining why     |
| Fix unrelated things while you're in the area          | Add a task to the backlog                       |
| Use global mutable state or hidden singletons         | Pass dependencies explicitly                    |
| Copy-paste a block a third time                       | Extract it (two copies are fine)                |
| Add a dependency for a few lines of code              | Write the few lines                             |

## Git

Hooks in `.githooks/` enforce this section. Run `scripts/install-hooks.sh` once per clone.

### Branch flow

| Branch | Role                                     | Receives work from                    |
| ------ | ---------------------------------------- | ------------------------------------- |
| `main` | **Production.** Always deployable.       | `dev` (releases), `hotfix/*`          |
| `dev`  | **Integration.** Next release builds up here. | `feature/*`, `bugfix/*`, `chore/*`, back-merges from `main` |

```
feature/t-005-x ──┐
bugfix/t-012-y  ──┼──▶ dev ──(release)──▶ main
chore/t-004-z   ──┘                        ▲
                         hotfix/t-020-z ───┘ (then merge main back into dev)
```

- **Never commit directly to `main` or `dev`.** They only receive merges. The `pre-commit` hook blocks direct commits.
- **On GitHub,** a ruleset ("Protect main and dev") blocks force pushes and deletion of `main` and `dev` for everyone,
  the owner included. Merges pushed on top still work. Never rewrite either branch's history.
- Work branches are cut **from `dev`** and merged back into `dev`.
- **Releases:** merge `dev` into `main` (optionally through a `release/vX.Y.Z` branch for final fixes), then tag `vX.Y.Z`.
  Then build and check the store zips from the tag: docs/store-listing.md → Release checklist.
- **Hotfixes:** branch from `main`, merge into `main`, then merge `main` back into `dev` so the fix isn't lost.
- Use `git merge --no-ff` into `dev` and `main` so each task shows up as one unit in the history.

### Branch names: [Conventional Branch](https://conventional-branch.github.io/)

Format: `<type>/<description>`

| Type        | Use for                                     | Example                              |
| ----------- | ------------------------------------------- | ------------------------------------ |
| `feature/`  | New functionality                           | `feature/t-005-csv-export`           |
| `bugfix/`   | Fixing a bug                                | `bugfix/t-012-empty-input-crash`     |
| `hotfix/`   | Urgent fix against a release                | `hotfix/t-020-null-config`           |
| `release/`  | Preparing a release                         | `release/v1.2.0`                     |
| `chore/`    | Non-code work (deps, docs, tooling, CI)     | `chore/t-004-ci-pipeline`            |

- Description: lowercase `a-z`, `0-9`, and `-` only. No consecutive, leading, or trailing hyphens.
  Dots are allowed only in `release/` versions.
- **Include the task ID** when there is one: `feature/t-005-…`.
- One branch per task. The `pre-commit` hook rejects commits on branches that don't follow this naming.

### Commits: [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)

The `commit-msg` hook rejects messages that don't follow these rules. It also warns, without blocking, when there's no `Refs:` footer.

```
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

| Type       | Use for                                           |
| ---------- | ------------------------------------------------- |
| `feat`     | New user-facing functionality (→ minor version)   |
| `fix`      | Bug fix (→ patch version)                         |
| `docs`     | Documentation only                                |
| `refactor` | Code change that's neither a fix nor a feature    |
| `perf`     | Performance improvement                           |
| `test`     | Adding or fixing tests                            |
| `build`    | Build system or dependencies                      |
| `ci`       | CI configuration                                  |
| `style`    | Formatting only, no behavior change               |
| `chore`    | Anything else (tooling, project state files)      |
| `revert`   | Reverts a previous commit                         |

- **Description:** imperative, lowercase, no trailing period, ≤ 72 chars. `feat(parser): support nested lists`.
- **Scope:** optional. Use a module or component name from `architecture.md`.
- **Breaking changes:** add `!` after the type/scope **and** a `BREAKING CHANGE: <what and how to migrate>` footer.
- **Body:** explains *why*, not *what*. Wrap at 72 chars.
- **Footers:** reference the task with `Refs: T-NNN`.
- **Atomic commits:** one logical change per commit. `scripts/verify.sh` must pass at each commit.
- Commit backlog and progress updates together with the work they describe.

Example:

```
fix(config): reject negative timeout values

Negative timeouts were silently treated as "no timeout", which hid
misconfiguration in production.

Refs: T-012
```

### Public history

The public repo starts from a single commit of a cleaned tree. Earlier history is archived privately and never
pushed, because early test fixtures held other people's names. Never push history from anywhere else into it.

## TypeScript & extension specifics

- **Strict mode:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Don't use `any`, and avoid
  `as` casts. Narrow with type guards instead. Typed ESLint (`strictTypeChecked`) enforces most of this.
- **Imports:** `import type` for type-only imports (`consistent-type-imports`), and relative paths within `src/`.
  WXT auto-imports `browser`, `defineContentScript`, `defineBackground`, and `storage`. Don't import them manually.
- **Async:** no floating promises. `await` them, or `void` them with a comment saying why.
- **Layout:**
  - `src/entrypoints/`: WXT entrypoints only (content script, background, popup). Keep them thin, just wiring.
  - `src/core/`: browser-agnostic logic (rule engine, matching, host handling). Must be testable with no
    extension APIs at all.
  - `src/platform/`: adapters around extension APIs (storage items, messaging handlers, the content controller).
    Test them with WXT's `fakeBrowser`, and call `fakeBrowser.reset()` in `beforeEach`.
  - `src/rules/`: one file per site/platform, exporting rule **data** only, registered in `src/rules/index.ts`.
  - `src/behaviors/`: site behaviors (ADR-007), only when CSS can't do the job. DOM only, listeners only, path checked
    at event time, full cleanup. Test what they block AND what they leave alone.
  - `src/popup/`: popup UI logic (`mountPopup`, `h()` builder, `strings.ts`). All user-facing text lives in
    `strings.ts`. Inject dependencies so it stays testable with no real browser.
  - `src/ui/`: `tokens.css` (design tokens, mirrors docs/style-guide.md), `components.css` (switch, buttons,
    banner, status pill), and `dom.ts` (the `h()` builder shared by popup and onboarding). Component CSS uses
    tokens only.
  - `src/onboarding/`: onboarding page logic. Like the popup, it gets its browser dependencies injected.
- **Browser APIs:** use the `browser` global (promise-based, works on both targets) and never `chrome.*`.
  For per-browser differences, branch on `import.meta.env.BROWSER`, and only in entrypoints.
- **Content scripts run on every page.** Avoid top-level work beyond setup, bound the cost of every
  MutationObserver callback, and never use `setInterval` polling.
- **Manifest:** edit `wxt.config.ts`, never a generated manifest. Adding a permission is a product decision:
  it needs an ADR and must be justified in the store listing.
