import type { Rule } from '@/core/rule';

/** Replace the test document's contents with a full HTML page (e.g. a fixture imported with `?raw`). */
export function loadDocument(html: string): void {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.documentElement.replaceChildren(
    ...Array.from(parsed.documentElement.childNodes, (node) => document.importNode(node, true)),
  );
}

/** An empty page, like the DOM a content script sees at document_start. */
export function resetDocument(): void {
  document.documentElement.replaceChildren();
}

/** Let MutationObserver callbacks and resolved promises run. */
export const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** True if the element or any ancestor computes to `display: none`. */
export function isHidden(el: Element): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (getComputedStyle(node).display === 'none') return true;
  }
  return false;
}

export function byId(id: string): Element {
  const el = document.getElementById(id);
  if (!el) throw new Error(`fixture has no #${id}`);
  return el;
}

/** Rules used by the engine fixtures in tests/fixtures/engine/. */
export const TEST_RULES: readonly Rule[] = [
  {
    id: 'test.panel',
    category: 'ai',
    description: 'Selector rule: an AI side panel',
    hosts: ['example.com'],
    selectors: ['[data-ai-panel]'],
  },
  {
    id: 'test.overview',
    category: 'ai',
    description: 'Anchor rule: an AI overview block found by its heading/label',
    hosts: ['example.com'],
    anchors: [
      {
        selector: 'h2, [role="heading"]',
        labels: ['AI Overview', 'Tekoälyn yleiskatsaus'],
        container: '.result-block',
      },
      { selector: 'button', labels: [/^ask ai$/], container: '.result-block' },
    ],
  },
];
