import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import negativeHtml from '../../tests/fixtures/engine/negative.html?raw';
import positiveHtml from '../../tests/fixtures/engine/positive.html?raw';
import {
  byId,
  flush,
  isHidden,
  loadDocument,
  resetDocument,
  TEST_RULES,
} from '../../tests/helpers/dom';
import { groupTagged, STYLE_ATTR, TAG_ATTR } from './css';
import { type Blocker, createBlocker } from './engine';
import type { Rule } from './rule';

describe('createBlocker', () => {
  let blocker: Blocker;
  let counts: number[];

  beforeEach(() => {
    resetDocument();
    counts = [];
    blocker = createBlocker({ doc: document, rules: TEST_RULES, onCount: (c) => counts.push(c) });
  });
  afterEach(() => {
    blocker.stop();
  });

  const styleEl = () => document.querySelector(`style[${STYLE_ATTR}]`);

  it('injects the hiding stylesheet synchronously, even before <head>/<body> exist', () => {
    expect(document.documentElement.childElementCount).toBe(0);
    blocker.start();
    expect(styleEl()?.textContent).toContain('[data-ai-panel]');
    expect(styleEl()?.textContent).toContain(groupTagged('ai'));
  });

  describe('positive fixture', () => {
    beforeEach(() => {
      loadDocument(positiveHtml);
      blocker.start();
    });

    it('hides every element marked data-expect="hidden" and nothing else', () => {
      for (const el of document.querySelectorAll('[data-expect]')) {
        const expected = el.getAttribute('data-expect') === 'hidden';
        expect(isHidden(el), `#${el.id}`).toBe(expected);
      }
    });

    it('tags hidden elements with the matching rule id', () => {
      expect(byId('panel').getAttribute(TAG_ATTR)).toBe('test.panel');
      expect(byId('overview').getAttribute(TAG_ATTR)).toBe('test.overview');
      expect(byId('aria-only').getAttribute(TAG_ATTR)).toBe('test.overview');
      expect(byId('organic').hasAttribute(TAG_ATTR)).toBe(false);
    });

    it('counts hidden elements', () => {
      expect(blocker.count).toBe(4);
      expect(counts.at(-1)).toBe(4);
    });
  });

  describe('negative fixture', () => {
    it('hides nothing on a page that only talks about AI', () => {
      loadDocument(negativeHtml);
      blocker.start();
      expect(document.querySelectorAll(`[${TAG_ATTR}]`)).toHaveLength(0);
      expect(isHidden(byId('article'))).toBe(false);
      expect(isHidden(byId('no-container'))).toBe(false);
      expect(blocker.count).toBe(0);
    });
  });

  describe('dynamic content', () => {
    beforeEach(() => {
      loadDocument('<html><head></head><body><main id="main"></main></body></html>');
      blocker.start();
    });

    it('hides AI blocks inserted after start', async () => {
      byId('main').insertAdjacentHTML(
        'beforeend',
        '<div class="result-block" id="late"><h2>AI Overview</h2></div><aside data-ai-panel id="late-panel"></aside>',
      );
      await flush();
      expect(isHidden(byId('late'))).toBe(true);
      expect(isHidden(byId('late-panel'))).toBe(true);
      expect(counts.at(-1)).toBe(2);
    });

    it('hides a block whose label text arrives after the heading element (streamed HTML)', async () => {
      byId('main').insertAdjacentHTML(
        'beforeend',
        '<div class="result-block" id="streamed"><h2 id="h"></h2></div>',
      );
      await flush();
      expect(isHidden(byId('streamed'))).toBe(false);

      byId('h').append(document.createTextNode('AI Overview'));
      await flush();
      expect(isHidden(byId('streamed'))).toBe(true);
    });

    it('scans only inserted subtrees, never the whole document', async () => {
      const docSpy = vi.spyOn(document, 'querySelectorAll');
      const rootSpy = vi.spyOn(document.documentElement, 'querySelectorAll');
      const bodySpy = vi.spyOn(document.body, 'querySelectorAll');
      byId('main').insertAdjacentHTML('beforeend', '<div class="result-block"><p>hello</p></div>');
      await flush();
      expect(docSpy).not.toHaveBeenCalled();
      expect(rootSpy).not.toHaveBeenCalled();
      expect(bodySpy).not.toHaveBeenCalled();
    });

    it('re-injects its stylesheet if the page removes it', async () => {
      styleEl()?.remove();
      byId('main').append(document.createElement('div'));
      await flush();
      expect(styleEl()?.isConnected).toBe(true);
    });
  });

  describe('start/stop', () => {
    beforeEach(() => {
      loadDocument(positiveHtml);
      blocker.start();
    });

    it('stop() shows everything again and reports 0', () => {
      blocker.stop();
      expect(styleEl()).toBeNull();
      expect(isHidden(byId('panel'))).toBe(false);
      expect(isHidden(byId('overview'))).toBe(false);
      expect(counts.at(-1)).toBe(0);
    });

    it('stop() stops reacting to insertions', async () => {
      blocker.stop();
      byId('results').insertAdjacentHTML(
        'beforeend',
        '<aside data-ai-panel id="after-stop"></aside>',
      );
      await flush();
      expect(byId('after-stop').hasAttribute(TAG_ATTR)).toBe(false);
    });

    it('start() after stop() hides again, including content added while stopped', () => {
      blocker.stop();
      byId('results').insertAdjacentHTML(
        'beforeend',
        '<div class="result-block" id="while-off"><h2>AI Overview</h2></div>',
      );
      blocker.start();
      expect(isHidden(byId('overview'))).toBe(true);
      expect(isHidden(byId('while-off'))).toBe(true);
      expect(counts.at(-1)).toBe(5);
    });

    it('is idempotent', () => {
      blocker.start();
      expect(document.querySelectorAll(`style[${STYLE_ATTR}]`)).toHaveLength(1);
      blocker.stop();
      blocker.stop();
      expect(blocker.active).toBe(false);
    });
  });

  it('never tags <html> or <body>, even if an anchor container resolves to them', () => {
    loadDocument('<html><body><h2>AI Overview</h2></body></html>');
    const greedy = createBlocker({
      doc: document,
      rules: [
        {
          id: 'test.greedy',
          category: 'ai',
          description: 'container resolves to body / html',
          hosts: ['example.com'],
          anchors: [
            { selector: 'h2', labels: ['AI Overview'], container: 'body' },
            { selector: 'h2', labels: ['AI Overview'], container: 'html' },
          ],
        },
      ],
    });
    greedy.start();
    expect(document.body.hasAttribute(TAG_ATTR)).toBe(false);
    expect(document.documentElement.hasAttribute(TAG_ATTR)).toBe(false);
    expect(greedy.count).toBe(0);
    greedy.stop();
  });
});

describe('createBlocker with heuristics', () => {
  const page =
    '<html><body><main id="main"><aside data-ai-panel id="panel"></aside><button id="ask">Ask AI</button><button id="later"></button></main></body></html>';
  let blocker: Blocker;
  let counts: number[];

  beforeEach(() => {
    loadDocument(page);
    counts = [];
    blocker = createBlocker({
      doc: document,
      rules: TEST_RULES,
      heuristics: true,
      onCount: (c) => counts.push(c),
    });
    blocker.start();
  });
  afterEach(() => {
    blocker.stop();
  });

  it('hides heuristic hits alongside rule hits and counts both', () => {
    expect(byId('ask').getAttribute(TAG_ATTR)).toBe('heuristic.control');
    expect(isHidden(byId('ask'))).toBe(true);
    expect(isHidden(byId('panel'))).toBe(true);
    expect(blocker.count).toBe(2);
  });

  it('turning heuristics off shows their hits again but keeps rule hits hidden', () => {
    blocker.setHeuristics(false);
    expect(isHidden(byId('ask'))).toBe(false);
    expect(isHidden(byId('panel'))).toBe(true);
    expect(counts.at(-1)).toBe(1);
  });

  it('turning heuristics back on rescans, including content added while off', () => {
    blocker.setHeuristics(false);
    byId('main').insertAdjacentHTML('beforeend', '<button id="added">Summarize with AI</button>');
    blocker.setHeuristics(true);
    expect(isHidden(byId('ask'))).toBe(true);
    expect(isHidden(byId('added'))).toBe(true);
    expect(counts.at(-1)).toBe(3);
  });

  it('ignores heuristic insertions while heuristics are off', async () => {
    blocker.setHeuristics(false);
    byId('main').insertAdjacentHTML('beforeend', '<button id="off">Ask AI</button>');
    await flush();
    expect(byId('off').hasAttribute(TAG_ATTR)).toBe(false);
  });

  it('a rule can still hide an element nested in a disabled heuristic hit', async () => {
    blocker.setHeuristics(false);
    byId('ask').insertAdjacentHTML('beforeend', '<span data-ai-panel id="nested"></span>');
    await flush();
    expect(byId('nested').getAttribute(TAG_ATTR)).toBe('test.panel');
    expect(isHidden(byId('nested'))).toBe(true);
  });

  it('catches a button whose label text arrives after the button (streamed / framework render)', async () => {
    byId('later').append(document.createTextNode('Ask AI'));
    await flush();
    expect(isHidden(byId('later'))).toBe(true);
  });

  it('setHeuristics while stopped applies on the next start', () => {
    blocker.stop();
    blocker.setHeuristics(false);
    blocker.start();
    expect(isHidden(byId('ask'))).toBe(false);
    expect(blocker.heuristics).toBe(false);
  });
});

describe('createBlocker with categories (ADR-008)', () => {
  const rules = [
    { id: 'x.ai', category: 'ai', description: '', hosts: ['x.com'], selectors: ['.ai'] },
    {
      id: 'x.short',
      category: 'short-form',
      description: '',
      hosts: ['x.com'],
      selectors: ['.short'],
    },
    {
      id: 'x.sugg',
      category: 'suggestions',
      description: '',
      hosts: ['x.com'],
      anchors: [{ selector: 'h2', labels: ['People also ask'], container: '.box' }],
    },
  ] as const satisfies readonly Rule[];
  let blocker: Blocker;
  let counts: number[];

  beforeEach(() => {
    loadDocument(
      '<html><body><main id="main"><div class="ai" id="ai"></div><div class="short" id="short"></div><div class="box" id="box"><h2>People also ask</h2></div></main></body></html>',
    );
    counts = [];
    blocker = createBlocker({ doc: document, rules, onCount: (c) => counts.push(c) });
    blocker.start();
  });
  afterEach(() => {
    blocker.stop();
  });

  it('hides all categories by default and tags each element with its group', () => {
    expect(isHidden(byId('ai'))).toBe(true);
    expect(isHidden(byId('short'))).toBe(true);
    expect(isHidden(byId('box'))).toBe(true);
    expect(byId('short').getAttribute('data-dummify-group')).toBe('short-form');
    expect(blocker.count).toBe(3);
  });

  it('turning a category off shows only its content, live, and updates the count', () => {
    blocker.setCategories(['ai', 'suggestions']);
    expect(isHidden(byId('short'))).toBe(false);
    expect(isHidden(byId('ai'))).toBe(true);
    expect(isHidden(byId('box'))).toBe(true);
    expect(counts.at(-1)).toBe(2);
    expect(blocker.categories).toEqual(['ai', 'suggestions']);
  });

  it('turning it back on hides it again, including content added while it was off', () => {
    blocker.setCategories(['ai']);
    byId('main').insertAdjacentHTML('beforeend', '<div class="short" id="late"></div>');
    blocker.setCategories(['ai', 'short-form', 'suggestions']);
    expect(isHidden(byId('short'))).toBe(true);
    expect(isHidden(byId('late'))).toBe(true);
    expect(isHidden(byId('box'))).toBe(true);
    expect(counts.at(-1)).toBe(4);
  });

  it('ignores insertions for a disabled category', async () => {
    blocker.setCategories(['ai']);
    byId('main').insertAdjacentHTML('beforeend', '<div class="short" id="off"></div>');
    await flush();
    expect(byId('off').hasAttribute(TAG_ATTR)).toBe(false);
    expect(isHidden(byId('off'))).toBe(false);
  });

  it('an enabled rule can still hide an element nested in a disabled category hit', async () => {
    blocker.setCategories(['ai', 'suggestions']);
    byId('short').insertAdjacentHTML('beforeend', '<span class="ai" id="nested"></span>');
    await flush();
    expect(isHidden(byId('nested'))).toBe(true);
    expect(byId('nested').getAttribute('data-dummify-group')).toBe('ai');
  });

  it('with every category off nothing is hidden, and heuristics are independent', () => {
    blocker.setCategories([]);
    for (const id of ['ai', 'short', 'box']) expect(isHidden(byId(id)), id).toBe(false);
    expect(blocker.count).toBe(0);
    blocker.setHeuristics(true);
    expect(blocker.heuristics).toBe(true);
    expect(blocker.categories).toEqual([]);
  });
});
