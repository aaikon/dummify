import { lockup } from '@/ui/brand';
import { h } from '@/ui/dom';
import { strings } from './strings';

export interface OnboardingDeps {
  has(): Promise<boolean>;
  /** Shows the browser's permission prompt. Must run inside the click handler (user gesture). */
  request(): Promise<boolean>;
  /** Notified when access changes elsewhere (e.g. granted in about:addons). Returns an unsubscribe. */
  onChange?(callback: (granted: boolean) => void): () => void;
  /**
   * Bring the toolbar "!" badge in line with the current access. The page does this itself instead of relying
   * on the background's permissions.onAdded listener alone: in the owner's Firefox test the grant succeeded but
   * the badge stayed stale.
   */
  syncBadge?(): void;
}

/**
 * The page opened after install when dummify lacks site access (T-011). It explains why in plain words and
 * offers a single action that triggers the browser's own permission prompt.
 */
export async function mountOnboarding(
  root: HTMLElement,
  deps: OnboardingDeps,
): Promise<() => void> {
  const allow = h('button', { class: 'button button-primary', type: 'button' }, strings.allow);
  const status = h('p', { class: 'onboarding-status', role: 'status', 'aria-live': 'polite' });
  const missing = h(
    'section',
    { class: 'onboarding-step', 'data-testid': 'missing' },
    h('h2', {}, strings.missingTitle),
    h('p', {}, strings.missingBody),
    h(
      'div',
      { class: 'onboarding-hides' },
      h('h3', {}, strings.hidesTitle),
      h('ul', {}, ...strings.hides.map((item) => h('li', {}, item))),
    ),
    h('p', { class: 'muted' }, strings.privacy),
    allow,
    status,
  );
  const granted = h(
    'section',
    { class: 'onboarding-step', 'data-testid': 'granted' },
    h('h2', {}, strings.grantedTitle),
    h('p', {}, strings.grantedBody),
    h('p', { class: 'muted' }, strings.pinHint),
  );

  root.replaceChildren(
    h(
      'main',
      { class: 'onboarding' },
      h(
        'header',
        { class: 'onboarding-hero' },
        h('h1', {}, lockup(40)),
        h('p', { class: 'tagline' }, strings.tagline),
      ),
      missing,
      granted,
    ),
  );

  // Neither state shows until access is known (otherwise both flash together on load).
  missing.hidden = true;
  granted.hidden = true;
  const show = (hasAccess: boolean) => {
    missing.hidden = hasAccess;
    granted.hidden = !hasAccess;
    deps.syncBadge?.();
  };

  allow.addEventListener('click', () => {
    status.textContent = '';
    allow.disabled = true;
    // Call request() synchronously in the handler: browsers require a live user gesture.
    deps
      .request()
      .then((ok) => {
        show(ok);
        if (!ok) status.textContent = strings.denied;
      })
      .catch(() => {
        status.textContent = strings.denied;
      })
      .finally(() => {
        allow.disabled = false;
      });
  });

  show(await deps.has());
  return deps.onChange?.(show) ?? (() => undefined);
}
