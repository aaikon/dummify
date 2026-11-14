import { afterEach, describe, expect, it } from 'vitest';
import { TAG_ATTR } from '@/core/css';
import { type Blocker, createBlocker } from '@/core/engine';
import { rulesForHost } from '@/core/rule';
import { ALL_RULES } from '@/rules';
import googleAiHtml from './fixtures/google/ai-overview.fi.html?raw';
import googleNoAiHtml from './fixtures/google/no-ai-overview.fi.html?raw';
import landingHtml from './fixtures/heuristics/negative/ai-product-landing.html?raw';
import docsMentionHtml from './fixtures/heuristics/negative/docs-mention-ai.html?raw';
import newsAboutAiHtml from './fixtures/heuristics/negative/news-about-ai.html?raw';
import docsAskAiHtml from './fixtures/heuristics/positive/docs-ask-ai.html?raw';
import newsSummarizeHtml from './fixtures/heuristics/positive/news-summarize.html?raw';
import shopHtml from './fixtures/heuristics/positive/shop-review-summary.html?raw';
import vendorHtml from './fixtures/heuristics/positive/vendor-widgets.html?raw';
import webmailHtml from './fixtures/heuristics/positive/webmail-assistant.html?raw';
import { isHidden, loadDocument } from './helpers/dom';

/*
 * Generic heuristics against the fixture corpus (T-009).
 *   positive/  synthetic pages with AI widgets, every relevant element marked data-expect="hidden|visible"
 *   negative/  synthetic pages that only TALK about AI: must hide nothing
 *   google/    real result pages: heuristics must add nothing beyond the Google site rules
 */

let blocker: Blocker | undefined;
afterEach(() => {
  blocker?.stop();
  blocker = undefined;
});

function runHeuristics(html: string, rules = rulesForHost(ALL_RULES, 'example.com')): Blocker {
  loadDocument(html);
  blocker = createBlocker({ doc: document, rules, heuristics: true });
  blocker.start();
  return blocker;
}
const heuristicTags = () =>
  Array.from(document.querySelectorAll(`[${TAG_ATTR}^="heuristic."]`)).map(
    (el) => `${el.tagName.toLowerCase()}#${el.id}.${[...el.classList].join('.')}`,
  );

describe('positive corpus: AI widgets are hidden, everything else stays', () => {
  it.each([
    ['docs-ask-ai', docsAskAiHtml],
    ['shop-review-summary', shopHtml],
    ['news-summarize', newsSummarizeHtml],
    ['webmail-assistant', webmailHtml],
    ['vendor-widgets', vendorHtml],
  ])('%s', (_name, html) => {
    runHeuristics(html);
    const marked = document.querySelectorAll('[data-expect]');
    expect(marked.length).toBeGreaterThan(2);
    for (const el of marked) {
      const label = `${el.tagName.toLowerCase()}#${el.id}.${[...el.classList].join('.')}`;
      expect(isHidden(el), label).toBe(el.getAttribute('data-expect') === 'hidden');
    }
  });

  it('tags each hit with the detector that found it', () => {
    runHeuristics(docsAskAiHtml);
    const kinds = Object.fromEntries(
      Array.from(document.querySelectorAll(`[${TAG_ATTR}]`)).map((el) => [
        el.id || el.className,
        el.getAttribute(TAG_ATTR),
      ]),
    );
    expect(kinds).toMatchObject({
      'ask-ai': 'heuristic.control',
      'ask-ai-icon': 'heuristic.control',
      'kapa-widget-container': 'heuristic.vendor',
      'DocSearch-AskAiScreen': 'heuristic.vendor',
    });
  });
});

describe('negative corpus: pages that only talk about AI', () => {
  it.each([
    ['news-about-ai', newsAboutAiHtml],
    ['ai-product-landing', landingHtml],
    ['docs-mention-ai', docsMentionHtml],
  ])('%s hides nothing', (_name, html) => {
    const b = runHeuristics(html);
    expect(heuristicTags()).toEqual([]);
    expect(b.count).toBe(0);
  });
});

describe('real google pages', () => {
  const google = rulesForHost(ALL_RULES, 'google.com');

  it('the page without an AI Overview gets no heuristic hits', () => {
    runHeuristics(googleNoAiHtml, google);
    expect(heuristicTags()).toEqual([]);
  });

  it('the page with an AI Overview keeps every organic result visible (except Shorts, hidden by T-027)', () => {
    runHeuristics(googleAiHtml, google);
    const results = Array.from(document.querySelectorAll('#rso a h3')).filter(
      (h3) => h3.closest('#rso > div')?.querySelector('a[href*="youtube.com/shorts/"]') == null,
    );
    expect(results.length).toBeGreaterThan(3);
    for (const h3 of results) expect(isHidden(h3), h3.textContent).toBe(false);
    expect(isHidden(document.querySelector('#center_col') ?? document.body)).toBe(false);
  });
});
