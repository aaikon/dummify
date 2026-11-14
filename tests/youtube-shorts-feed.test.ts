import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { youtubeShortsFeed } from '@/behaviors/youtube-shorts-feed';
import { TAG_ATTR } from '@/core/css';
import { type Blocker, createBlocker } from '@/core/engine';
import { rulesForHost } from '@/core/rule';
import { startContentController } from '@/platform/content-controller';
import { settingsItem } from '@/platform/settings';
import { ALL_RULES } from '@/rules';
import shortsHtml from './fixtures/youtube/shorts-player.fi.html?raw';
import { flush, isHidden, loadDocument } from './helpers/dom';

/*
 * T-028 (ADR-006): on a Short opened from a link, the Short plays but the algorithmic "next Short" feed is cut off.
 * Fixture: a real /shorts/ page (Finnish UI) saved by the owner ("Web Page, complete"), sanitized; no comments rendered.
 */

const SHORTS_PATH = '/shorts/UUISYtIMYhc';
const one = (selector: string) => {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`no ${selector}`);
  return el;
};

let blocker: Blocker | undefined;
let cleanup: (() => void) | undefined;
afterEach(() => {
  blocker?.stop();
  blocker = undefined;
  cleanup?.();
  cleanup = undefined;
});

describe('youtube.shorts-feed (CSS) on a real Shorts page', () => {
  beforeEach(() => {
    loadDocument(shortsHtml);
    blocker = createBlocker({ doc: document, rules: rulesForHost(ALL_RULES, 'youtube.com') });
    blocker.start();
  });

  it('keeps the linked Short and its player visible', () => {
    expect(isHidden(one('ytd-reel-video-renderer'))).toBe(false);
    expect(isHidden(one('#shorts-player'))).toBe(false);
    expect(isHidden(one('#shorts-inner-container > div[id="0"]'))).toBe(false);
    // The player containers around the reels must never be hidden either.
    expect(isHidden(one('#initial-player-container'))).toBe(false);
    expect(isHidden(one('#overlay-initial-container'))).toBe(false);
  });

  it('keeps the Short’s own actions (share, watch later) usable', () => {
    for (const label of ['Jaa', 'Katso myöhemmin']) {
      const el = document.querySelector(`ytd-reel-video-renderer [aria-label="${label}"]`);
      expect(el, label).not.toBeNull();
      expect(isHidden(el ?? document.body), label).toBe(false);
    }
  });

  it('hides the Next and Previous buttons', () => {
    expect(isHidden(one('#navigation-button-down'))).toBe(true);
    expect(isHidden(one('#navigation-button-up'))).toBe(true);
  });

  it('hides the suggested-Shorts carousel in the info panel', () => {
    expect(isHidden(one('yt-reel-carousel-view-model'))).toBe(true);
  });

  it('hides the queued next Shorts (div#1…#20 on the real page)', () => {
    const reels = Array.from(document.querySelectorAll('#shorts-inner-container > div')).filter(
      (d) => /^\d+$/.test(d.id),
    );
    expect(reels.length).toBeGreaterThan(10);
    for (const r of reels) expect(isHidden(r), `div#${r.id}`).toBe(r.id !== '0');
  });

  it('hides a next Short that YouTube adds later', async () => {
    one('#shorts-inner-container').insertAdjacentHTML(
      'beforeend',
      '<div id="21"><ytd-reel-video-renderer id="late-reel"></ytd-reel-video-renderer></div>',
    );
    await flush();
    expect(isHidden(one('#late-reel'))).toBe(true);
    expect(isHidden(one('#shorts-inner-container > div[id="0"]'))).toBe(false);
  });

  it('does not hide the comments or description panels', () => {
    for (const panel of document.querySelectorAll('ytd-engagement-panel-section-list-renderer')) {
      expect(panel.closest(`[${TAG_ATTR}]`), panel.getAttribute('target-id') ?? '').toBeNull();
    }
  });
});

describe('youtube.shorts-feed-lock (behavior)', () => {
  let path = SHORTS_PATH;
  /** Stand-ins for YouTube's own listeners, registered after ours (like the real page). */
  let pageWheel: Mock<(e: Event) => void>;
  let pageKey: Mock<(e: Event) => void>;

  beforeEach(() => {
    loadDocument(shortsHtml);
    path = SHORTS_PATH;
    cleanup = youtubeShortsFeed.start({ doc: document, win: window, path: () => path });
    pageWheel = vi.fn<(e: Event) => void>();
    pageKey = vi.fn<(e: Event) => void>();
    window.addEventListener('wheel', pageWheel, true);
    window.addEventListener('keydown', pageKey, true);
    document.addEventListener('wheel', pageWheel);
    document.addEventListener('keydown', pageKey);
  });
  afterEach(() => {
    window.removeEventListener('wheel', pageWheel, true);
    window.removeEventListener('keydown', pageKey, true);
    document.removeEventListener('wheel', pageWheel);
    document.removeEventListener('keydown', pageKey);
  });

  const wheel = (target: Element, deltaY = 120, deltaX = 0) => {
    const e = new WheelEvent('wheel', { deltaY, deltaX, bubbles: true, cancelable: true });
    target.dispatchEvent(e);
    return e;
  };
  const key = (target: Element, k: string, extra: KeyboardEventInit = {}) => {
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra });
    target.dispatchEvent(e);
    return e;
  };

  it('blocks the wheel over the Short before YouTube sees it', () => {
    const e = wheel(one('ytd-reel-video-renderer'));
    expect(e.defaultPrevented).toBe(true);
    expect(pageWheel).not.toHaveBeenCalled();
  });

  it.each(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'])('blocks the %s key', (k) => {
    const e = key(document.body, k);
    expect(e.defaultPrevented).toBe(true);
    expect(pageKey).not.toHaveBeenCalled();
  });

  it.each([' ', 'k', 'm', 'ArrowLeft', 'ArrowRight', 'f'])(
    'leaves the %j key alone (play/pause, mute, seek…)',
    (k) => {
      const e = key(document.body, k);
      expect(e.defaultPrevented).toBe(false);
      expect(pageKey).toHaveBeenCalled();
    },
  );

  it('leaves browser shortcuts alone (Ctrl/Alt/Meta + arrows)', () => {
    expect(key(document.body, 'ArrowDown', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(key(document.body, 'ArrowDown', { altKey: true }).defaultPrevented).toBe(false);
  });

  it('leaves scrolling inside the comments panel alone', () => {
    const panel = one(
      'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"]',
    );
    const e = wheel(panel);
    expect(e.defaultPrevented).toBe(false);
    expect(pageWheel).toHaveBeenCalled();
  });

  it('leaves typing alone (e.g. arrow keys in the comment box)', () => {
    document.body.insertAdjacentHTML('beforeend', '<textarea id="comment"></textarea>');
    expect(key(one('#comment'), 'ArrowDown').defaultPrevented).toBe(false);
  });

  it('leaves horizontal scrolling alone', () => {
    expect(wheel(one('ytd-reel-video-renderer'), 5, 120).defaultPrevented).toBe(false);
  });

  it('does nothing on other YouTube pages (checked at event time, single-page navigation)', () => {
    path = '/watch';
    expect(wheel(one('ytd-reel-video-renderer')).defaultPrevented).toBe(false);
    expect(key(document.body, 'ArrowDown').defaultPrevented).toBe(false);
    path = SHORTS_PATH;
    expect(wheel(one('ytd-reel-video-renderer')).defaultPrevented).toBe(true);
  });

  it('removes its listeners on cleanup', () => {
    cleanup?.();
    cleanup = undefined;
    expect(wheel(one('ytd-reel-video-renderer')).defaultPrevented).toBe(false);
    expect(key(document.body, 'ArrowDown').defaultPrevented).toBe(false);
  });
});

describe('behaviors follow the dummify switches (content controller)', () => {
  let dispose: (() => void) | null = null;
  beforeEach(() => {
    fakeBrowser.reset();
    loadDocument(shortsHtml);
  });
  afterEach(() => {
    dispose?.();
    dispose = null;
  });

  const run = () =>
    startContentController({
      doc: document,
      url: 'https://www.youtube.com/shorts/UUISYtIMYhc',
      rules: ALL_RULES,
      behaviors: [youtubeShortsFeed],
      path: () => SHORTS_PATH,
      report: () => undefined,
      features: { heuristics: false },
    });
  const wheelBlocked = () => {
    const e = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true });
    one('ytd-reel-video-renderer').dispatchEvent(e);
    return e.defaultPrevented;
  };

  it('runs immediately, and stops/restarts with the per-site switch', async () => {
    dispose = run();
    expect(wheelBlocked()).toBe(true);

    await settingsItem.setValue({
      enabled: true,
      heuristics: true,
      disabledSites: ['youtube.com'],
    });
    await flush();
    expect(wheelBlocked()).toBe(false);

    await settingsItem.setValue({ enabled: true, heuristics: true, disabledSites: [] });
    await flush();
    expect(wheelBlocked()).toBe(true);
  });

  it('stops with the global switch and on dispose', async () => {
    dispose = run();
    await settingsItem.setValue({ enabled: false, heuristics: true, disabledSites: [] });
    await flush();
    expect(wheelBlocked()).toBe(false);
    await settingsItem.setValue({ enabled: true, heuristics: true, disabledSites: [] });
    await flush();
    expect(wheelBlocked()).toBe(true);
    dispose?.();
    dispose = null;
    expect(wheelBlocked()).toBe(false);
  });
});
