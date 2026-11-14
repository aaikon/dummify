import { afterEach, describe, expect, it, vi } from 'vitest';
import { flush } from '../../tests/helpers/dom';
import { mountOnboarding, type OnboardingDeps } from './onboarding';
import { strings } from './strings';

let root: HTMLElement;
let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  unmount = undefined;
});

async function open(deps: Partial<OnboardingDeps> & Pick<OnboardingDeps, 'has'>) {
  root = document.createElement('div');
  document.body.replaceChildren(root);
  const full: OnboardingDeps = { request: vi.fn(() => Promise.resolve(true)), ...deps };
  unmount = await mountOnboarding(root, full);
  return full;
}
const step = (id: 'missing' | 'granted') => {
  const el = root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!el) throw new Error(id);
  return el;
};
const allowButton = () => {
  const b = step('missing').querySelector('button');
  if (!b) throw new Error('no button');
  return b;
};
const status = () => root.querySelector('[role="status"]')?.textContent ?? '';

describe('onboarding page', () => {
  it('explains why access is needed and offers one action when access is missing', async () => {
    await open({ has: () => Promise.resolve(false) });
    expect(step('missing').hidden).toBe(false);
    expect(step('granted').hidden).toBe(true);
    expect(step('missing').textContent).toContain(strings.privacy);
    expect(allowButton().textContent).toBe(strings.allow);
    expect(root.textContent).toContain(strings.tagline);
  });

  it('shows the done state right away when access already exists', async () => {
    await open({ has: () => Promise.resolve(true) });
    expect(step('granted').hidden).toBe(false);
    expect(step('missing').hidden).toBe(true);
  });

  it('requests access synchronously on click (user gesture) and shows success', async () => {
    const request = vi.fn(() => Promise.resolve(true));
    await open({ has: () => Promise.resolve(false), request });
    allowButton().click();
    expect(request).toHaveBeenCalledTimes(1); // called inside the click, before any await
    expect(allowButton().disabled).toBe(true);
    await flush();
    expect(step('granted').hidden).toBe(false);
  });

  it('explains a denial and lets the user try again', async () => {
    await open({ has: () => Promise.resolve(false), request: () => Promise.resolve(false) });
    allowButton().click();
    await flush();
    expect(step('missing').hidden).toBe(false);
    expect(status()).toBe(strings.denied);
    expect(allowButton().disabled).toBe(false);
  });

  it('treats a failed request like a denial', async () => {
    await open({
      has: () => Promise.resolve(false),
      request: () => Promise.reject(new Error('no gesture')),
    });
    allowButton().click();
    await flush();
    expect(status()).toBe(strings.denied);
    expect(allowButton().disabled).toBe(false);
  });

  it('updates when access is granted elsewhere (e.g. about:addons)', async () => {
    let notify: (granted: boolean) => void = () => undefined;
    await open({
      has: () => Promise.resolve(false),
      onChange: (cb) => {
        notify = cb;
        return () => undefined;
      },
    });
    notify(true);
    expect(step('granted').hidden).toBe(false);
  });

  it('uses the tagline and keeps privacy copy honest (no claims beyond the invariants)', async () => {
    await open({ has: () => Promise.resolve(false) });
    expect(strings.privacy).toMatch(/doesn’t collect or send anything/);
  });

  it('updates the toolbar badge itself after a successful grant (regression: badge stayed "!")', async () => {
    const syncBadge = vi.fn();
    await open({
      has: () => Promise.resolve(false),
      request: () => Promise.resolve(true),
      syncBadge,
    });
    syncBadge.mockClear();
    allowButton().click();
    await flush();
    expect(step('granted').hidden).toBe(false);
    expect(syncBadge).toHaveBeenCalled();
  });

  it('also syncs the badge when access changes elsewhere', async () => {
    const syncBadge = vi.fn();
    let notify: (granted: boolean) => void = () => undefined;
    await open({
      has: () => Promise.resolve(false),
      syncBadge,
      onChange: (cb) => {
        notify = cb;
        return () => undefined;
      },
    });
    syncBadge.mockClear();
    notify(true);
    expect(syncBadge).toHaveBeenCalledTimes(1);
  });

  it('shows neither state until access is known (no double flash on load)', async () => {
    let resolveHas: (v: boolean) => void = () => undefined;
    root = document.createElement('div');
    document.body.replaceChildren(root);
    const mounted = mountOnboarding(root, {
      has: () => new Promise<boolean>((r) => (resolveHas = r)),
      request: () => Promise.resolve(true),
    });
    await flush();
    expect(step('missing').hidden).toBe(true);
    expect(step('granted').hidden).toBe(true);
    resolveHas(false);
    unmount = await mounted;
    expect(step('missing').hidden).toBe(false);
  });
});
