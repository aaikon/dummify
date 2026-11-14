import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import positiveHtml from '../../tests/fixtures/engine/positive.html?raw';
import { byId, flush, isHidden, loadDocument, TEST_RULES } from '../../tests/helpers/dom';
import { startContentController } from './content-controller';
import { settingsItem } from './settings';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('startContentController', () => {
  let dispose: (() => void) | null = null;
  let reports: number[];

  /** Site-rule behavior, with heuristics unavailable (they have their own describe block below). */
  const start = (url = 'https://www.example.com/search?q=x') =>
    startContentController({
      doc: document,
      url,
      rules: TEST_RULES,
      report: (c) => reports.push(c),
      reportIntervalMs: 5,
      features: { heuristics: false },
    });

  beforeEach(() => {
    fakeBrowser.reset();
    loadDocument(positiveHtml);
    reports = [];
  });
  afterEach(() => {
    dispose?.();
    dispose = null;
  });

  it('does nothing on hosts without rules or on non-web pages', () => {
    expect(start('https://wikipedia.org/')).toBeNull();
    expect(start('chrome://settings/')).toBeNull();
    expect(isHidden(byId('panel'))).toBe(false);
  });

  it('hides synchronously, before settings have loaded', () => {
    dispose = start();
    expect(isHidden(byId('panel'))).toBe(true);
    expect(isHidden(byId('overview'))).toBe(true);
  });

  it('un-hides once settings say the site is disabled', async () => {
    await settingsItem.setValue({
      enabled: true,
      heuristics: true,
      disabledSites: ['example.com'],
    });
    dispose = start();
    await flush();
    expect(isHidden(byId('panel'))).toBe(false);
  });

  it('a setting change during page load is not overwritten by the slower initial read', async () => {
    dispose = start();
    // No flush: the change event arrives before the initial getValue() resolves.
    await settingsItem.setValue({ enabled: false, heuristics: true, disabledSites: [] });
    await flush();
    await flush();
    expect(isHidden(byId('panel'))).toBe(false);
  });

  it('applies setting changes live, without a reload', async () => {
    dispose = start();
    await flush();
    expect(isHidden(byId('panel'))).toBe(true);

    await settingsItem.setValue({ enabled: false, heuristics: true, disabledSites: [] });
    await flush();
    expect(isHidden(byId('panel'))).toBe(false);

    await settingsItem.setValue({ enabled: true, heuristics: true, disabledSites: [] });
    await flush();
    expect(isHidden(byId('panel'))).toBe(true);
  });

  it('reports the blocked count, coalesced', async () => {
    dispose = start();
    byId('results').insertAdjacentHTML('beforeend', '<aside data-ai-panel></aside>');
    await wait(20);
    expect(reports).toEqual([5]);
  });

  it('stops everything on dispose, including pending reports', async () => {
    const stop = start();
    expect(stop).not.toBeNull();
    stop?.();
    reports = [];
    expect(isHidden(byId('panel'))).toBe(false);
    await settingsItem.setValue({ enabled: true, heuristics: true, disabledSites: [] });
    await wait(20);
    expect(isHidden(byId('panel'))).toBe(false);
    expect(reports).toEqual([]);
  });
});

describe('startContentController with heuristics', () => {
  let dispose: (() => void) | null = null;
  const widgetPage =
    '<html><body><main id="main"><p>Article text about AI.</p><button id="ask">Ask AI</button></main></body></html>';
  const run = (url: string, heuristics = true) =>
    startContentController({
      doc: document,
      url,
      rules: TEST_RULES,
      report: () => undefined,
      features: { heuristics },
    });
  const ask = () => byId('ask');

  beforeEach(() => {
    fakeBrowser.reset();
    loadDocument(widgetPage);
  });
  afterEach(() => {
    dispose?.();
    dispose = null;
  });

  it('runs on sites without rules and hides AI widgets there', () => {
    dispose = run('https://news.example.org/story');
    expect(dispose).not.toBeNull();
    expect(isHidden(ask())).toBe(true);
    expect(isHidden(byId('main'))).toBe(false);
  });

  it('stays off on AI product sites and on non-web pages', () => {
    expect(run('https://chatgpt.com/')).toBeNull();
    expect(run('https://gemini.google.com/app')).toBeNull();
    expect(run('about:blank')).toBeNull();
    expect(isHidden(ask())).toBe(false);
  });

  it('does nothing on sites without rules when the feature is unavailable', () => {
    expect(run('https://news.example.org/', false)).toBeNull();
  });

  it('stops on a rule-less site when the user turns heuristics off, live', async () => {
    dispose = run('https://news.example.org/');
    await settingsItem.setValue({ enabled: true, heuristics: false, disabledSites: [] });
    await flush();
    expect(isHidden(ask())).toBe(false);
    expect(document.querySelector('style[data-dummify-style]')).toBeNull();

    await settingsItem.setValue({ enabled: true, heuristics: true, disabledSites: [] });
    await flush();
    expect(isHidden(ask())).toBe(true);
  });

  it('keeps site rules running when heuristics are off on a site with rules', async () => {
    loadDocument(
      '<html><body><aside data-ai-panel id="panel"></aside><button id="ask">Ask AI</button></body></html>',
    );
    dispose = run('https://example.com/');
    await settingsItem.setValue({ enabled: true, heuristics: false, disabledSites: [] });
    await flush();
    expect(isHidden(byId('panel'))).toBe(true);
    expect(isHidden(ask())).toBe(false);
  });

  it('respects the per-site switch for heuristics too', async () => {
    await settingsItem.setValue({
      enabled: true,
      heuristics: true,
      disabledSites: ['example.org'],
    });
    dispose = run('https://news.example.org/');
    await flush();
    expect(isHidden(ask())).toBe(false);
  });
});

describe('startContentController with categories (ADR-008)', () => {
  let dispose: (() => void) | null = null;
  const all = { ai: true, 'short-form': true, suggestions: true };
  const page =
    '<html><body><main id="main"><aside data-ai-panel id="panel"></aside><button id="ask">Ask AI</button></main></body></html>';
  beforeEach(() => {
    fakeBrowser.reset();
    loadDocument(page);
  });
  afterEach(() => {
    dispose?.();
    dispose = null;
  });

  it('turning AI features off reveals AI rule hits and stops heuristics, live', async () => {
    dispose = startContentController({
      doc: document,
      url: 'https://example.com/',
      rules: TEST_RULES,
      report: () => undefined,
      features: { heuristics: true },
    });
    expect(isHidden(byId('panel'))).toBe(true);
    expect(isHidden(byId('ask'))).toBe(true);

    await settingsItem.setValue({
      enabled: true,
      heuristics: true,
      categories: { ...all, ai: false },
      disabledSites: [],
    });
    await flush();
    expect(isHidden(byId('panel'))).toBe(false);
    expect(isHidden(byId('ask'))).toBe(false);

    await settingsItem.setValue({
      enabled: true,
      heuristics: true,
      categories: all,
      disabledSites: [],
    });
    await flush();
    expect(isHidden(byId('panel'))).toBe(true);
    expect(isHidden(byId('ask'))).toBe(true);
  });

  it('starts and stops each behavior with its own category', async () => {
    const start = vi.fn(() => stop);
    const stop = vi.fn();
    dispose = startContentController({
      doc: document,
      url: 'https://example.com/',
      rules: TEST_RULES,
      report: () => undefined,
      features: { heuristics: false },
      behaviors: [
        { id: 'x.lock', category: 'short-form', description: '', hosts: ['example.com'], start },
      ],
    });
    expect(start).toHaveBeenCalledTimes(1);

    await settingsItem.setValue({
      enabled: true,
      heuristics: true,
      categories: { ...all, ai: false },
      disabledSites: [],
    });
    await flush();
    expect(stop).not.toHaveBeenCalled(); // other categories don't affect it

    await settingsItem.setValue({
      enabled: true,
      heuristics: true,
      categories: { ...all, 'short-form': false },
      disabledSites: [],
    });
    await flush();
    expect(stop).toHaveBeenCalledTimes(1);

    await settingsItem.setValue({
      enabled: true,
      heuristics: true,
      categories: all,
      disabledSites: [],
    });
    await flush();
    expect(start).toHaveBeenCalledTimes(2);
  });
});
