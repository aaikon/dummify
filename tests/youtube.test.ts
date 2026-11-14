import { afterEach, describe, expect, it } from 'vitest';
import { TAG_ATTR } from '@/core/css';
import { type Blocker, createBlocker } from '@/core/engine';
import { rulesForHost } from '@/core/rule';
import { ALL_RULES } from '@/rules';
import searchHtml from './fixtures/youtube/search.fi.html?raw';
import { flush, isHidden, loadDocument } from './helpers/dom';

/*
 * Fixture: a real YouTube search page ("how to boil an egg", Finnish UI), saved by the owner as
 * "Web Page, complete" (YouTube renders client-side), then sanitized (no scripts, media, or tracking).
 * It has 4 Shorts shelves between 13 normal video results, a "Shorts" mini-guide entry, and a "Shorts" chip.
 */

const youtubeRules = rulesForHost(ALL_RULES, 'youtube.com');
let blocker: Blocker | undefined;
afterEach(() => {
  blocker?.stop();
  blocker = undefined;
});

function block(html: string, heuristics = false): Blocker {
  loadDocument(html);
  blocker = createBlocker({ doc: document, rules: youtubeRules, heuristics });
  blocker.start();
  return blocker;
}
const all = (selector: string) => Array.from(document.querySelectorAll(selector));
const one = (selector: string) => {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`no ${selector}`);
  return el;
};
const tagged = () => all(`[${TAG_ATTR}]`).map((el) => el.getAttribute(TAG_ATTR));

describe('youtube rules', () => {
  it('apply to youtube.com and its subdomains only', () => {
    expect(youtubeRules.map((r) => r.id)).toEqual([
      'youtube.shorts-shelf',
      'youtube.shorts-item',
      'youtube.shorts-nav',
      'youtube.shorts-feed',
    ]);
    expect(rulesForHost(ALL_RULES, 'm.youtube.com').map((r) => r.id)).toContain(
      'youtube.shorts-item',
    );
    expect(rulesForHost(ALL_RULES, 'google.com').some((r) => r.id.startsWith('youtube.'))).toBe(
      false,
    );
    expect(rulesForHost(ALL_RULES, 'notyoutube.com')).toEqual([]);
  });

  describe('real search page', () => {
    it('hides every Shorts shelf and every Shorts tile', () => {
      block(searchHtml);
      const shelves = all('grid-shelf-view-model');
      expect(shelves).toHaveLength(4);
      for (const s of shelves) expect(isHidden(s), s.textContent.slice(0, 40)).toBe(true);
      const tiles = all('ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2');
      expect(tiles.length).toBeGreaterThan(20);
      for (const t of tiles) expect(isHidden(t)).toBe(true);
      expect(all('a[href*="/shorts/"]').filter((a) => !isHidden(a))).toEqual(
        // Only the hidden mini-guide link would remain if it weren't hidden: so none visible at all.
        [],
      );
    });

    it('keeps every normal video result and the results list', () => {
      block(searchHtml);
      const videos = all('ytd-video-renderer');
      expect(videos).toHaveLength(13);
      for (const v of videos) expect(isHidden(v), v.textContent.slice(0, 40)).toBe(false);
      expect(isHidden(one('ytd-item-section-renderer'))).toBe(false);
    });

    it('hides the Shorts mini-guide entry but keeps Home, Subscriptions, and You', () => {
      block(searchHtml);
      for (const entry of all('ytd-mini-guide-entry-renderer')) {
        const title = entry.querySelector('a')?.getAttribute('title');
        expect(isHidden(entry), title ?? '').toBe(title === 'Shorts');
      }
    });

    it('hides only the "Shorts" search filter chip', () => {
      block(searchHtml);
      const chips = all('yt-chip-cloud-chip-renderer');
      expect(chips.length).toBeGreaterThan(3);
      for (const c of chips) {
        const label = c.textContent.replace(/\s+/g, ' ').trim();
        expect(isHidden(c), label).toBe(label === 'Shorts');
      }
    });

    it('hides exactly: 4 shelves, the mini-guide entry, and the chip', () => {
      const b = block(searchHtml);
      expect(tagged().sort()).toEqual(
        [
          'youtube.shorts-nav',
          'youtube.shorts-nav',
          'youtube.shorts-shelf',
          'youtube.shorts-shelf',
          'youtube.shorts-shelf',
          'youtube.shorts-shelf',
        ].sort(),
      );
      expect(b.count).toBe(6);
    });

    it('generic AI heuristics hide nothing on this real page (precision check)', () => {
      block(searchHtml, true);
      expect(all(`[${TAG_ATTR}^="heuristic."]`)).toEqual([]);
    });
  });

  describe('places this page does not show (simulated markup; unverified until real pages)', () => {
    const page = (body: string) =>
      block(`<html><body><ytd-app><div id="content">${body}</div></ytd-app></body></html>`);

    it.each([
      [
        'search result',
        '<ytd-video-renderer id="x"><a href="/shorts/abc">t</a></ytd-video-renderer>',
      ],
      [
        'Up next sidebar',
        '<ytd-compact-video-renderer id="x"><a href="/shorts/abc">t</a></ytd-compact-video-renderer>',
      ],
      [
        'home grid',
        '<ytd-rich-item-renderer id="x"><a href="/shorts/abc">t</a></ytd-rich-item-renderer>',
      ],
      [
        'subscriptions grid',
        '<ytd-grid-video-renderer id="x"><a href="/shorts/abc">t</a></ytd-grid-video-renderer>',
      ],
      [
        'new lockup',
        '<yt-lockup-view-model id="x"><a href="/shorts/abc">t</a></yt-lockup-view-model>',
      ],
      ['home Shorts shelf', '<ytd-rich-shelf-renderer id="x" is-shorts></ytd-rich-shelf-renderer>'],
      ['older Shorts shelf', '<ytd-reel-shelf-renderer id="x"></ytd-reel-shelf-renderer>'],
      ['channel Shorts tab', '<yt-tab-shape id="x" tab-title="Shorts"></yt-tab-shape>'],
      [
        'full guide entry',
        '<ytd-guide-entry-renderer id="x"><a href="/shorts/" title="Shorts">Shorts</a></ytd-guide-entry-renderer>',
      ],
    ])('hides a Short in the %s', (_where, html) => {
      page(html);
      expect(isHidden(one('#x'))).toBe(true);
    });

    it('hides Shorts inserted later (single-page navigation)', async () => {
      page('<div id="list"></div>');
      one('#list').insertAdjacentHTML(
        'beforeend',
        '<grid-shelf-view-model id="late"><ytm-shorts-lockup-view-model-v2><a href="/shorts/z">s</a></ytm-shorts-lockup-view-model-v2></grid-shelf-view-model>',
      );
      await flush();
      expect(isHidden(one('#late'))).toBe(true);
    });
  });

  describe('direct links play (ADR-006)', () => {
    it('never hides the Shorts player on a /shorts/<id> page (simulated player markup)', () => {
      block(`<html><body><ytd-app><ytd-page-manager>
        <ytd-shorts id="shorts"><div id="shorts-inner-container">
          <ytd-reel-video-renderer id="reel" is-active><div id="player-container"><video></video></div>
            <ytd-reel-player-overlay-renderer><a href="/shorts/abc">Title</a></ytd-reel-player-overlay-renderer>
          </ytd-reel-video-renderer></div></ytd-shorts>
        </ytd-page-manager></ytd-app></body></html>`);
      expect(isHidden(one('#shorts'))).toBe(false);
      expect(isHidden(one('#reel'))).toBe(false);
      expect(isHidden(one('#player-container'))).toBe(false);
    });
  });

  describe('safety', () => {
    const page = (body: string) =>
      block(`<html><body><ytd-app><div id="content">${body}</div></ytd-app></body></html>`);

    it.each([
      [
        'a normal video result',
        '<ytd-video-renderer id="x"><a href="/watch?v=abc">t</a></ytd-video-renderer>',
      ],
      [
        'a normal Up next video',
        '<ytd-compact-video-renderer id="x"><a href="/watch?v=a">t</a></ytd-compact-video-renderer>',
      ],
      [
        'a shelf of normal videos',
        '<grid-shelf-view-model id="x"><ytd-video-renderer><a href="/watch?v=a">t</a></ytd-video-renderer></grid-shelf-view-model>',
      ],
      [
        'a video whose title mentions shorts',
        '<ytd-video-renderer id="x"><a href="/watch?v=a">Best running shorts 2026</a></ytd-video-renderer>',
      ],
      [
        'a home shelf that is not Shorts',
        '<ytd-rich-shelf-renderer id="x"><a href="/watch?v=a">t</a></ytd-rich-shelf-renderer>',
      ],
      ['another channel tab', '<yt-tab-shape id="x" tab-title="Videos"></yt-tab-shape>'],
      [
        'the Subscriptions guide entry',
        '<ytd-guide-entry-renderer id="x"><a href="/feed/subscriptions" title="Subscriptions">S</a></ytd-guide-entry-renderer>',
      ],
      [
        'a chip that merely contains the word',
        '<yt-chip-cloud-chip-renderer id="x">Shorts tutorials</yt-chip-cloud-chip-renderer>',
      ],
    ])('keeps %s', (_what, html) => {
      page(html);
      expect(isHidden(one('#x'))).toBe(false);
    });
  });
});
