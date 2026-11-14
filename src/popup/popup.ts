import { FEATURES, type Features } from '@/core/features';
import { normalizeHost } from '@/core/host';
import { CATEGORIES } from '@/core/rule';
import {
  isBlockingActive,
  isCategoryEnabled,
  isSiteDisabled,
  setCategory,
  setSiteEnabled,
  type Settings,
  withDefaults,
} from '@/core/settings';
import { lockup } from '@/ui/brand';
import { h, switchRow } from '@/ui/dom';
import { strings } from './strings';

/** Minimal storage-item shapes (structurally satisfied by WXT storage items, and easy to fake). */
interface ReadableItem<T> {
  getValue(): Promise<T>;
  watch(callback: (value: T) => void): () => void;
}
interface WritableItem<T> extends ReadableItem<T> {
  setValue(value: T): Promise<void>;
}

export interface ActiveTab {
  readonly id?: number | undefined;
  readonly url?: string | undefined;
}

/** Site access (T-011). Optional so the popup still works in tests that don't care about it. */
export interface PopupAccess {
  has(): Promise<boolean>;
  onChange(callback: (granted: boolean) => void): () => void;
  /** Opens the onboarding page, where the permission prompt can safely run (Firefox closes popups on prompt). */
  openOnboarding(): void;
  /** Bring the toolbar "!" badge in line with current access (see OnboardingDeps.syncBadge for why). */
  syncBadge?(): void;
}

export interface PopupDeps {
  getActiveTab(): Promise<ActiveTab | undefined>;
  readonly access?: PopupAccess;
  readonly settings: WritableItem<Settings>;
  countFor(tabId: number): ReadableItem<number>;
  readonly features?: Features;
}

type Status = 'active' | 'off-site' | 'off-everywhere';

/**
 * Renders the popup into `root` and keeps it in sync with storage. Returns an unmount function.
 * Layout: docs/style-guide.md → Popup layout.
 */
export async function mountPopup(root: HTMLElement, deps: PopupDeps): Promise<() => void> {
  const features = deps.features ?? FEATURES;
  const [tab, storedSettings, hasAccess] = await Promise.all([
    deps.getActiveTab(),
    deps.settings.getValue(),
    deps.access?.has() ?? Promise.resolve(true),
  ]);
  const host = tab?.url ? normalizeHost(tab.url) : null;
  const tabId = tab?.id;

  let settings = withDefaults(storedSettings);
  let count = 0;

  /** Read-modify-write so concurrent changes from other tabs aren't overwritten with stale state. */
  const update = async (change: (current: Settings) => Settings) => {
    await deps.settings.setValue(change(withDefaults(await deps.settings.getValue())));
  };

  // ── site section ──────────────────────────────────────────────────────────
  const site = host === null ? null : buildSiteSection(host);
  site?.toggle.input.addEventListener('change', () => {
    const enabled = site.toggle.input.checked;
    void update((s) => setSiteEnabled(s, host ?? '', enabled));
  });

  // ── what to hide (ADR-008) ───────────────────────────────────────────────
  const categoryRows = CATEGORIES.map((category) => {
    const { label, hint } = strings.categories[category];
    const row = switchRow(`category-${category}`, label, hint);
    row.input.addEventListener('change', () => {
      const on = row.input.checked;
      void update((s) => setCategory(s, category, on));
    });
    return { category, ...row };
  });

  // ── global section ────────────────────────────────────────────────────────
  const everywhere = switchRow('on-everywhere', strings.onEverywhere, strings.onEverywhereHint);
  everywhere.input.addEventListener('change', () => {
    const enabled = everywhere.input.checked;
    void update((s) => ({ ...s, enabled }));
  });
  const heuristics = features.heuristics
    ? switchRow('heuristics', strings.heuristics, strings.heuristicsHint)
    : null;
  heuristics?.input.addEventListener('change', () => {
    const on = heuristics.input.checked;
    void update((s) => ({ ...s, heuristics: on }));
  });

  // ── access banner (T-011) ─────────────────────────────────────────────────
  const allowButton = h(
    'button',
    { class: 'button button-primary', type: 'button' },
    strings.accessAllow,
  );
  allowButton.addEventListener('click', () => {
    deps.access?.openOnboarding();
  });
  const banner = h(
    'div',
    { class: 'section', 'data-testid': 'access-banner' },
    h(
      'div',
      { class: 'banner', role: 'alert' },
      h('span', { 'aria-hidden': 'true' }, '⚠'),
      h('span', { class: 'banner-text' }, strings.accessMissing),
      allowButton,
    ),
  );
  banner.hidden = hasAccess;
  deps.access?.syncBadge?.();

  root.replaceChildren(
    h(
      'div',
      { class: 'popup' },
      h('header', { class: 'header' }, lockup(17)),
      banner,
      h('hr', { class: 'divider' }),
      site?.section ??
        h(
          'p',
          { class: 'section muted', 'data-testid': 'unsupported' },
          // A tab without a URL means the browser withheld it (missing permission), not a browser page.
          tab && !tab.url ? strings.noAccess : strings.unsupported,
        ),
      h('hr', { class: 'divider' }),
      h(
        'section',
        { class: 'section', 'aria-labelledby': 'what-to-hide' },
        h('h2', { class: 'section-label', id: 'what-to-hide' }, strings.whatToHide),
        ...categoryRows.map((r) => r.row),
      ),
      h('hr', { class: 'divider' }),
      h('section', { class: 'section' }, everywhere.row, heuristics?.row),
    ),
  );

  function render(): void {
    everywhere.input.checked = settings.enabled;
    for (const r of categoryRows) r.input.checked = isCategoryEnabled(settings, r.category);
    if (heuristics) {
      heuristics.input.checked = settings.heuristics;
      // Heuristics are part of AI features: they can't run while that category is off.
      heuristics.input.disabled = !isCategoryEnabled(settings, 'ai');
    }
    if (!site || host === null) return;

    site.toggle.input.checked = !isSiteDisabled(settings, host);
    const status: Status = !settings.enabled
      ? 'off-everywhere'
      : isBlockingActive(settings, host)
        ? 'active'
        : 'off-site';
    site.setStatus(status);
    site.setCount(status === 'active' ? count : 0);
  }
  render();

  const unwatchSettings = deps.settings.watch((value) => {
    settings = withDefaults(value);
    render();
  });
  let unwatchCount: () => void = () => undefined;
  if (site && tabId !== undefined) {
    const countItem = deps.countFor(tabId);
    count = await countItem.getValue();
    render();
    unwatchCount = countItem.watch((value) => {
      count = value;
      render();
    });
  }

  const unwatchAccess =
    deps.access?.onChange((granted) => {
      banner.hidden = granted;
      deps.access?.syncBadge?.();
    }) ?? (() => undefined);

  return () => {
    unwatchSettings();
    unwatchCount();
    unwatchAccess();
  };
}

function buildSiteSection(host: string) {
  const toggle = switchRow('site-enabled', strings.hideOnSite);
  const statusText = h('span', {});
  const status = h('span', { class: 'status', 'data-testid': 'status' }, statusText);
  const dot = h('span', { class: 'status-dot', 'aria-hidden': 'true' });
  const countNum = h('span', { class: 'count-num' });
  const countLabel = h('span', { class: 'count-label' });
  const countEl = h(
    'p',
    { class: 'count', 'aria-live': 'polite', 'data-testid': 'count' },
    countNum,
    countLabel,
  );

  const section = h(
    'section',
    { class: 'section' },
    h('div', { class: 'site-head' }, h('span', { class: 'host', title: host }, host), status),
    toggle.row,
    countEl,
  );

  return {
    section,
    toggle,
    setStatus(state: Status) {
      status.dataset.state = state;
      statusText.textContent =
        state === 'active'
          ? strings.statusActive
          : state === 'off-site'
            ? strings.statusOffSite
            : strings.statusOffEverywhere;
      if (state === 'active') status.prepend(dot);
      else dot.remove();
    },
    setCount(value: number) {
      countNum.textContent = value > 0 ? String(value) : '';
      countNum.hidden = value === 0;
      countLabel.textContent = value > 0 ? strings.hiddenOnPage : strings.nothingHidden;
    },
  };
}
