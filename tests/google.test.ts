import { afterEach, describe, expect, it } from 'vitest';
import { TAG_ATTR } from '@/core/css';
import { type Blocker, createBlocker } from '@/core/engine';
import { rulesForHost } from '@/core/rule';
import { ALL_RULES } from '@/rules';
import aiOverviewHtml from './fixtures/google/ai-overview.fi.html?raw';
import noAiOverviewHtml from './fixtures/google/no-ai-overview.fi.html?raw';
import videosTabHtml from './fixtures/google/videos-tab.fi.html?raw';
import { flush, isHidden, loadDocument } from './helpers/dom';

/*
 * Fixtures: real google.com result pages (Finnish UI), trimmed and de-identified.
 *   ai-overview.fi.html     query "how to boil an egg": has an AI Overview + AI Mode tab
 *   no-ai-overview.fi.html  long nonsense query: no AI Overview, AI Mode tab only. The query was shortened to
 *                           "how to boil an egg on a monday" for the public repo (T-031).
 * Individual creators' names and handles are REDACTED (T-031). Brands, sites, and subreddits are kept.
 */

const googleRules = rulesForHost(ALL_RULES, 'google.com');
let blocker: Blocker | undefined;

function block(html: string): Blocker {
  loadDocument(html);
  blocker = createBlocker({ doc: document, rules: googleRules });
  blocker.start();
  return blocker;
}
afterEach(() => {
  blocker?.stop();
  blocker = undefined;
});

const one = (selector: string): Element => {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`fixture has no ${selector}`);
  return el;
};
const aiModeTab = () => one('[role="listitem"]:has(a[href*="udm=50"])');
const shortVideosTab = () => one('[role="listitem"]:has(a[href*="udm=short_vids"])');
const tagged = () => Array.from(document.querySelectorAll(`[${TAG_ATTR}]`));

/** Is this organic result title a YouTube Short? (Those are hidden on purpose, T-027.) */
const isShortResult = (h3: Element) =>
  h3.closest('#rso > div')?.querySelector('a[href*="youtube.com/shorts/"]') != null;

/** Every non-Short organic result and the results container itself must stay visible. */
function expectOrganicResultsVisible(): void {
  expect(isHidden(one('#center_col'))).toBe(false);
  expect(isHidden(one('#rso'))).toBe(false);
  const results = Array.from(document.querySelectorAll('#rso a h3')).filter(
    (h3) => !isShortResult(h3),
  );
  expect(results.length).toBeGreaterThan(3);
  for (const h3 of results) expect(isHidden(h3), h3.textContent).toBe(false);
}

describe('google rules', () => {
  it('apply to google.<tld> search, not other Google products', () => {
    expect(googleRules.map((r) => r.id)).toEqual([
      'google.ai-overview',
      'google.ai-mode',
      'google.people-also-ask',
      'google.related-searches',
      'google.refinement-chips',
      'google.autocomplete',
      'google.short-videos',
    ]);
    expect(rulesForHost(ALL_RULES, 'google.fi')).toHaveLength(7);
    expect(rulesForHost(ALL_RULES, 'google.co.uk')).toHaveLength(7);
    expect(rulesForHost(ALL_RULES, 'mail.google.com')).toHaveLength(0);
    expect(rulesForHost(ALL_RULES, 'docs.google.com')).toHaveLength(0);
  });

  describe('results page WITH an AI Overview', () => {
    it('hides the whole AI Overview block, header included', () => {
      block(aiOverviewHtml);
      const overview = one('[role="main"] > div:has(#eKIzJc)');
      expect(isHidden(overview)).toBe(true);
      expect(overview.getAttribute(TAG_ATTR)).toBe('google.ai-overview');
      expect(overview.textContent).toContain('AI-yhteenveto');
    });

    it('hides the AI Mode and Short videos tabs but no other navigation tabs', () => {
      block(aiOverviewHtml);
      expect(isHidden(aiModeTab())).toBe(true);
      expect(isHidden(shortVideosTab())).toBe(true);
      // Navigation tabs only (the hidden Short videos carousel also contains role="listitem" cards, and the hidden
      // refinement chips under the tabs are list items in the navigation too, T-034).
      const otherTabs = Array.from(
        document.querySelectorAll('[role="navigation"] [role="listitem"]'),
      ).filter(
        (li) => !li.querySelector('a[href*="udm=50"], a[href*="udm=short_vids"], a[href*="uds="]'),
      );
      expect(otherTabs.length).toBeGreaterThan(2);
      for (const li of otherTabs) expect(isHidden(li), li.textContent).toBe(false);
    });

    it('keeps every organic result visible', () => {
      block(aiOverviewHtml);
      expectOrganicResultsVisible();
    });

    it('hides exactly: AI Mode + Short videos tabs, refinement chips, overview, People also ask, Shorts carousel, 2 Shorts in Videos, 1 Shorts result, related searches', () => {
      const b = block(aiOverviewHtml);
      expect(tagged().map((el) => el.getAttribute(TAG_ATTR))).toEqual([
        'google.ai-mode',
        'google.short-videos',
        'google.refinement-chips',
        'google.ai-overview',
        'google.people-also-ask',
        'google.short-videos',
        'google.short-videos',
        'google.short-videos',
        'google.short-videos',
        'google.related-searches',
      ]);
      expect(b.count).toBe(10);
    });

    it('still hides the block by its heading if Google drops the structural markers', () => {
      const stripped = aiOverviewHtml
        .replaceAll('data-subtree="aimc"', '')
        .replaceAll('id="eKIzJc"', '');
      block(stripped);
      const overview = one('[role="main"] > div:not(#center_col)');
      expect(isHidden(overview)).toBe(true);
      expect(overview.getAttribute(TAG_ATTR)).toBe('google.ai-overview');
      expectOrganicResultsVisible();
    });
  });

  describe('AI Overview loaded after the page (lazy / streamed)', () => {
    it('hides the real overview block when it is inserted later', async () => {
      // Extract the real overview block from the AI fixture…
      loadDocument(aiOverviewHtml);
      const overviewHtml = one('[role="main"] > div:has(#eKIzJc)').outerHTML;
      // …then start on the page without one, and insert it like Google's streaming does.
      block(noAiOverviewHtml);
      one('#center_col').insertAdjacentHTML('beforebegin', overviewHtml);
      await flush();
      const overview = one('[role="main"] > div:has(#eKIzJc)');
      expect(isHidden(overview)).toBe(true);
      expect(overview.getAttribute(TAG_ATTR)).toBe('google.ai-overview');
      expectOrganicResultsVisible();
    });
  });

  describe('results page WITHOUT an AI Overview', () => {
    it('hides exactly: AI Mode + Short videos tabs, People also ask, 3 Shorts results (related-searches box is empty)', () => {
      const b = block(noAiOverviewHtml);
      expect(isHidden(aiModeTab())).toBe(true);
      expect(tagged().map((el) => el.getAttribute(TAG_ATTR))).toEqual([
        'google.ai-mode',
        'google.short-videos',
        'google.short-videos',
        'google.people-also-ask',
        'google.short-videos',
        'google.short-videos',
      ]);
      expect(b.count).toBe(6);
      expectOrganicResultsVisible();
    });
  });

  describe('search suggestions (T-024)', () => {
    const paa = () => one('#rso > div:has([data-initq])');

    it.each([
      ['with AI Overview', () => aiOverviewHtml],
      ['without AI Overview', () => noAiOverviewHtml],
    ])('hides the whole "People also ask" block, header included (%s)', (_name, html) => {
      block(html());
      expect(isHidden(paa())).toBe(true);
      expect(paa().getAttribute(TAG_ATTR)).toBe('google.people-also-ask');
      expect(paa().textContent).toContain('Ihmiset kysyvät myös');
      expect(paa().querySelectorAll('.related-question-pair').length).toBeGreaterThan(2);
      expectOrganicResultsVisible();
    });

    it('hides "People also search for" but keeps pagination', () => {
      block(aiOverviewHtml);
      expect(isHidden(one('#bres'))).toBe(true);
      expect(one('#bres').textContent).toContain('Ihmiset hakevat myös näitä');
      expect(isHidden(one('#pnnext'))).toBe(false);
      expect(isHidden(one('#botstuff'))).toBe(false);
    });

    it('does not count an empty related-searches placeholder', () => {
      block(noAiOverviewHtml);
      expect(one('#bres').hasAttribute(TAG_ATTR)).toBe(false);
      expect(isHidden(one('#pnnext'))).toBe(false);
    });

    it('hides the autocomplete dropdown when Google inserts it, and leaves the search box usable', async () => {
      block(noAiOverviewHtml);
      const box = one('textarea[aria-controls]');
      expect(box.getAttribute('aria-controls')).toBe('Alh6id');
      // Google builds the dropdown when the user types. Simulate both known shapes.
      one('form[role="search"]').insertAdjacentHTML(
        'beforeend',
        '<div id="Alh6id"><ul role="listbox"><li role="option">how to boil an egg</li></ul></div>',
      );
      await flush();
      expect(isHidden(one('#Alh6id'))).toBe(true);
      expect(isHidden(box)).toBe(false);
      expect(isHidden(one('form[role="search"]'))).toBe(false);
    });

    it('the listbox fallback only applies inside the search form', async () => {
      block(noAiOverviewHtml);
      one('form[role="search"]').insertAdjacentHTML(
        'beforeend',
        '<div class="sbox"><ul role="listbox" id="in-form"></ul></div>',
      );
      one('#rso').insertAdjacentHTML('afterbegin', '<ul role="listbox" id="in-results"></ul>');
      await flush();
      expect(isHidden(one('#in-form'))).toBe(true);
      expect(isHidden(one('#in-results'))).toBe(false);
    });

    it('a People-also-ask selector never matches a block holding organic results', () => {
      loadDocument(noAiOverviewHtml);
      // Put an organic result into the PAA block's wrapper, as a defensive check of the :not(:has(h3)) guard.
      one('#rso > div:has([data-initq])').insertAdjacentHTML(
        'beforeend',
        '<div class="g"><a href="https://example.org/"><h3 id="organic-in-paa">Result</h3></a></div>',
      );
      blocker = createBlocker({
        doc: document,
        rules: googleRules
          .filter((r) => r.id === 'google.people-also-ask')
          .map((r) => ({
            ...r,
            selectors: (r.selectors ?? []).slice(0, 1),
          })),
      });
      blocker.start();
      expect(isHidden(one('#organic-in-paa'))).toBe(false);
    });
  });

  describe('refinement chips (T-034)', () => {
    const chipBar = () => one('#hdtb-sc');
    const chipList = () => one('#hdtb-sc [role="list"]');
    const chips = () => Array.from(document.querySelectorAll('#hdtb-sc a[href*="uds="]'));
    /** The search tabs: list items in the navigation outside the chip bar. */
    const tabs = () =>
      Array.from(document.querySelectorAll('[role="navigation"] [role="listitem"]')).filter(
        (li) => !li.closest('#hdtb-sc'),
      );

    it('hides the whole chip list (fixture: 5 chips like "Lisää From cold water")', () => {
      block(aiOverviewHtml);
      expect(chips()).toHaveLength(5);
      expect(chips()[0]?.getAttribute('aria-label')).toMatch(/^Lisää /);
      expect(isHidden(chipList())).toBe(true);
      expect(chipList().getAttribute(TAG_ATTR)).toBe('google.refinement-chips');
      for (const chip of chips()) expect(isHidden(chip), chip.textContent).toBe(true);
    });

    it('keeps the search tabs, the chip bar itself, and the results visible', () => {
      block(aiOverviewHtml);
      // Only the list is hidden, never the bar, so anything else Google renders in it stays. (The Tools button is
      // built by script and isn't in saved pages; in the live page it sits in the tab row, outside the bar.)
      expect(isHidden(chipBar())).toBe(false);
      const visibleTabs = tabs().filter(
        (li) => !li.querySelector('a[href*="udm=50"], a[href*="udm=short_vids"]'),
      );
      expect(visibleTabs.length).toBeGreaterThan(2);
      for (const li of visibleTabs) expect(isHidden(li), li.textContent).toBe(false);
      expectOrganicResultsVisible();
    });

    it('hides chips Google adds after load', async () => {
      block(aiOverviewHtml);
      // Google fills the list's empty slots from a script after the page loads.
      chipList().insertAdjacentHTML(
        'beforeend',
        '<div role="listitem"><a id="late-chip" href="/search?q=x&amp;uds=ABC" aria-label="Add For ramen">For ramen</a></div>',
      );
      await flush();
      expect(isHidden(one('#late-chip'))).toBe(true);
    });

    it('hides the chip bar when it is inserted after the page (and only its list)', async () => {
      loadDocument(aiOverviewHtml);
      const barHtml = chipBar().outerHTML;
      block(noAiOverviewHtml);
      expect(document.querySelector('#hdtb-sc')).toBeNull();
      one('#rso').insertAdjacentHTML('beforebegin', barHtml);
      await flush();
      expect(chipList().getAttribute(TAG_ATTR)).toBe('google.refinement-chips');
      expect(isHidden(chipList())).toBe(true);
      expect(isHidden(chipBar())).toBe(false);
    });

    it('still hides each chip if the list loses its role (fallback selector)', () => {
      block(aiOverviewHtml.replace('class="IUOThf" role="list"', 'class="IUOThf"'));
      expect(document.querySelector('#hdtb-sc [role="list"]')).toBeNull();
      expect(chips()).toHaveLength(5);
      for (const chip of chips()) {
        expect(isHidden(chip), chip.textContent).toBe(true);
        expect(chip.closest(`[${TAG_ATTR}]`)?.getAttribute(TAG_ATTR)).toBe(
          'google.refinement-chips',
        );
      }
    });

    it('never hides a tab whose link carries a refinement (uds) outside the chip bar', () => {
      // After a refinement, Google can keep `uds` on the other tabs' links.
      loadDocument(aiOverviewHtml);
      const link = tabs()
        .map((li) => li.querySelector('a[href*="udm=vids"]'))
        .find((a) => a !== null);
      if (!link) throw new Error('fixture has no Videos tab');
      link.setAttribute('href', `${link.getAttribute('href') ?? ''}&uds=ABC`);
      blocker = createBlocker({ doc: document, rules: googleRules });
      blocker.start();
      const tab = link.closest('[role="listitem"]');
      expect(tab).not.toBeNull();
      if (tab) expect(isHidden(tab)).toBe(false);
      expect(link.hasAttribute(TAG_ATTR)).toBe(false);
    });
  });

  describe('short videos (T-027)', () => {
    const shortsCarousel = () => one('#rso > div:has(a[href*="udm=short_vids"])');
    const videosCarousel = () => one('#rso > div:has(a[href*="udm=vids"])');

    it('hides the whole Short videos carousel, heading included', () => {
      block(aiOverviewHtml);
      expect(isHidden(shortsCarousel())).toBe(true);
      expect(shortsCarousel().getAttribute(TAG_ATTR)).toBe('google.short-videos');
      expect(shortsCarousel().textContent).toContain('Lyhyet videot');
      expect(
        shortsCarousel().querySelectorAll('a[href*="youtube.com/shorts/"]').length,
      ).toBeGreaterThan(0);
    });

    it('hides individual Shorts inside the Videos section, but keeps the section and its other videos', () => {
      block(aiOverviewHtml);
      const cards = Array.from(videosCarousel().querySelectorAll('[data-vid]'));
      expect(cards).toHaveLength(3);
      const shorts = cards.filter((c) => c.querySelector('a[href*="youtube.com/shorts/"]'));
      const videos = cards.filter((c) => !c.querySelector('a[href*="youtube.com/shorts/"]'));
      expect(shorts).toHaveLength(2);
      for (const c of shorts) {
        expect(isHidden(c), c.textContent).toBe(true);
        expect(c.getAttribute(TAG_ATTR)).toBe('google.short-videos');
      }
      expect(videos).toHaveLength(1);
      expect(isHidden(videos[0] ?? document.body)).toBe(false);
      expect(isHidden(videosCarousel())).toBe(false);
    });

    it.each([
      ['with AI Overview', () => aiOverviewHtml, 1],
      ['without AI Overview', () => noAiOverviewHtml, 3],
    ])(
      'hides search results that are Shorts, and only those (%s)',
      (_name, html, expectedShorts) => {
        block(html());
        const titles = Array.from(document.querySelectorAll('#rso a h3'));
        const shorts = titles.filter(isShortResult);
        expect(shorts).toHaveLength(expectedShorts);
        for (const h3 of shorts) {
          expect(isHidden(h3), h3.textContent).toBe(true);
          // Hidden by the short-videos rule, at the result's card or its block.
          expect(h3.closest(`[${TAG_ATTR}]`)?.getAttribute(TAG_ATTR)).toBe('google.short-videos');
        }
        expectOrganicResultsVisible();
      },
    );

    it('keeps the regular Videos tab and Videos carousel', () => {
      block(aiOverviewHtml);
      expect(isHidden(one('[role="listitem"]:has(a[href*="udm=vids"])'))).toBe(false);
      expect(isHidden(videosCarousel())).toBe(false);
      expect(videosCarousel().textContent).toContain('Videot');
      expectOrganicResultsVisible();
    });

    it('still hides the carousel by its heading if the "view all" link disappears', () => {
      // Remove the short_vids marker from the carousel only (the tab keeps its own link).
      loadDocument(aiOverviewHtml);
      for (const a of one('#rso').querySelectorAll('a[href*="udm=short_vids"]')) a.remove();
      blocker = createBlocker({ doc: document, rules: googleRules });
      blocker.start();
      const carousel = one('#rso > div:has([role="heading"])');
      const heading = Array.from(document.querySelectorAll('#rso [role="heading"]')).find(
        (el) => el.textContent.trim() === 'Lyhyet videot',
      );
      expect(heading).toBeDefined();
      const container = heading?.closest('#rso > div');
      expect(container?.getAttribute(TAG_ATTR)).toBe('google.short-videos');
      expect(isHidden(container ?? carousel)).toBe(true);
      expectOrganicResultsVisible();
    });

    it('the carousel selector never matches a block holding an organic result', () => {
      loadDocument(aiOverviewHtml);
      shortsCarousel().insertAdjacentHTML(
        'beforeend',
        '<div class="g"><a href="https://example.org/"><h3 id="organic-in-shorts">Result</h3></a></div>',
      );
      blocker = createBlocker({
        doc: document,
        rules: googleRules
          .filter((r) => r.id === 'google.short-videos')
          .map((r) => ({ ...r, selectors: (r.selectors ?? []).slice(1, 2), anchors: [] })),
      });
      blocker.start();
      expect(isHidden(one('#organic-in-shorts'))).toBe(false);
    });

    it('a youtube.com/shorts link inside the regular Videos carousel does not hide it', () => {
      loadDocument(aiOverviewHtml);
      videosCarousel().insertAdjacentHTML(
        'beforeend',
        '<a href="https://www.youtube.com/shorts/abc123">A short in the Videos block</a>',
      );
      blocker = createBlocker({ doc: document, rules: googleRules });
      blocker.start();
      expect(isHidden(videosCarousel())).toBe(false);
    });
  });

  describe('Videos tab (udm=vids) page', () => {
    // Real page (fi), saved by the owner: all 10 results share ONE #rso child; 4 of them are Shorts.
    const titles = () => Array.from(document.querySelectorAll('#rso h3'));
    /** Per result, not per block: here every result shares one block, so decide by the result's own card. */
    const isShortCard = (h3: Element) =>
      h3.closest('[data-vid]')?.querySelector('a[href*="youtube.com/shorts/"]') != null;

    it('hides each Short, card by card', () => {
      block(videosTabHtml);
      const shorts = titles().filter(isShortCard);
      expect(shorts).toHaveLength(4);
      for (const h3 of shorts) {
        expect(isHidden(h3), h3.textContent).toBe(true);
        expect(h3.closest(`[${TAG_ATTR}]`)?.getAttribute(TAG_ATTR)).toBe('google.short-videos');
      }
    });

    it('never hides the list itself or any non-Short video (regression: whole list hidden)', () => {
      block(videosTabHtml);
      expect(isHidden(one('#rso > div'))).toBe(false);
      const others = titles().filter((h3) => !isShortCard(h3));
      expect(others).toHaveLength(6);
      for (const h3 of others) expect(isHidden(h3), h3.textContent).toBe(false);
    });

    it('hides exactly the 4 Short cards (plus the AI Mode and Short videos tabs)', () => {
      const b = block(videosTabHtml);
      const ids = tagged().map((el) => el.getAttribute(TAG_ATTR));
      expect(ids.filter((id) => id === 'google.short-videos').length).toBeGreaterThanOrEqual(4);
      expect(document.querySelectorAll(`#rso [${TAG_ATTR}]`)).toHaveLength(4);
      expect(b.count).toBe(ids.length);
    });
  });

  describe('Shorts loaded later / outside #rso (owner: "still some Shorts")', () => {
    /** A real Short card from the Videos tab fixture, as HTML. */
    const realShortCard = () => {
      loadDocument(videosTabHtml);
      const card = document.querySelector('[data-vid]:has(a[href*="youtube.com/shorts/"])');
      if (!card) throw new Error('fixture has no Short card');
      return card.outerHTML;
    };

    it('hides a real Short card appended outside #rso after load (infinite scroll)', async () => {
      const cardHtml = realShortCard();
      block(videosTabHtml);
      one('#rso').insertAdjacentHTML('afterend', `<div id="more-results">${cardHtml}</div>`);
      await flush();
      const card = one('#more-results [data-vid]');
      expect(isHidden(card)).toBe(true);
      expect(isHidden(one('#more-results'))).toBe(false);
    });

    it('hides a card-less result by its "youtube.com › shorts" breadcrumb (redirect link, no data-vid)', async () => {
      block(videosTabHtml);
      one('#rso').insertAdjacentHTML(
        'afterend',
        `<div id="more"><div data-hveid="late1" id="late-short">
           <a href="/url?q=https://example.invalid/redirect"><h3>Late short</h3></a>
           <cite>www.youtube.com › shorts › abc123</cite></div>
         <div data-hveid="late2" id="late-video">
           <a href="/url?q=https://example.invalid/v"><h3>Late normal video</h3></a>
           <cite>www.youtube.com › watch</cite></div></div>`,
      );
      await flush();
      expect(isHidden(one('#late-short'))).toBe(true);
      expect(one('#late-short').getAttribute(TAG_ATTR)).toBe('google.short-videos');
      expect(isHidden(one('#late-video'))).toBe(false);
      expect(isHidden(one('#more'))).toBe(false);
    });

    it('hides a result whose Short link is URL-encoded in a Google redirect', async () => {
      block(videosTabHtml);
      one('#rso').insertAdjacentHTML(
        'afterend',
        `<div id="more"><div data-vid="x" id="encoded">
           <a href="/url?q=https%3A%2F%2Fwww.youtube.com%2Fshorts%2Fabc123"><h3>Encoded short</h3></a></div></div>`,
      );
      await flush();
      expect(isHidden(one('#encoded'))).toBe(true);
    });

    it('a breadcrumb in a card-less Short never hides a list of video cards around it', () => {
      block(videosTabHtml);
      // Strip data-vid from one real Short card so only its breadcrumb identifies it, inside the grouped list.
      const card = one('[data-vid]:has(a[href*="youtube.com/shorts/"])');
      card.removeAttribute('data-vid');
      card.removeAttribute(TAG_ATTR);
      for (const a of card.querySelectorAll('a')) a.setAttribute('href', '/url?q=redirect');
      blocker?.stop();
      blocker = createBlocker({ doc: document, rules: googleRules });
      blocker.start();
      expect(isHidden(one('#rso > div'))).toBe(false);
      const others = Array.from(document.querySelectorAll('#rso [data-vid]')).filter(
        (c) => !c.querySelector('a[href*="youtube.com/shorts/"]'),
      );
      for (const c of others) expect(isHidden(c), c.textContent).toBe(false);
    });

    it('never hides a list of video cards when a card-less Short sits directly inside it', async () => {
      block(videosTabHtml);
      // The Short's nearest data-hveid ancestor IS the list, which also holds normal video cards.
      one('#rso').insertAdjacentHTML(
        'afterend',
        `<div id="more"><div data-hveid="list" id="list">
           <div data-vid="a" id="normal-card"><a href="/url?q=v"><h3>Normal video</h3></a><cite>www.youtube.com › watch</cite></div>
           <div id="bare-short"><a href="/url?q=s"><h3>Bare short</h3></a><cite>www.youtube.com › shorts</cite></div>
         </div></div>`,
      );
      await flush();
      expect(isHidden(one('#list'))).toBe(false);
      expect(isHidden(one('#normal-card'))).toBe(false);
    });

    it('the breadcrumb text in ordinary prose is not a Short', () => {
      block(noAiOverviewHtml);
      one('#rso').insertAdjacentHTML(
        'afterbegin',
        '<div data-hveid="p1" id="prose"><p>Paste www.youtube.com › shorts into the box.</p><h3>Article</h3></div>',
      );
      blocker?.stop();
      blocker = createBlocker({ doc: document, rules: googleRules });
      blocker.start();
      expect(isHidden(one('#prose'))).toBe(false);
    });
  });

  describe('safety', () => {
    it('never hides the results column, even if an "AI Overview" heading appears inside it', () => {
      loadDocument(noAiOverviewHtml);
      one('#rso').insertAdjacentHTML(
        'afterbegin',
        '<div id="inside"><div role="heading">AI Overview</div><div data-subtree="x">text</div></div>',
      );
      blocker = createBlocker({ doc: document, rules: googleRules });
      blocker.start();
      expect(isHidden(one('#inside'))).toBe(false);
      expectOrganicResultsVisible();
    });

    it('does not hide organic results that merely mention AI Overviews', () => {
      loadDocument(noAiOverviewHtml);
      one('#rso').insertAdjacentHTML(
        'afterbegin',
        '<div class="g" id="article"><a href="https://example.org/"><h3>AI Overview explained</h3></a><span>How Google AI Overview works</span></div>',
      );
      blocker = createBlocker({ doc: document, rules: googleRules });
      blocker.start();
      expect(isHidden(one('#article'))).toBe(false);
    });
  });
});
