import { describe, expect, it } from 'vitest';
import { CATEGORIES, type Rule } from '@/core/rule';
import { ALL_RULES } from '.';

/**
 * Returns the offending :has() argument if one contains a combinator (space, >, +, ~), else null.
 * happy-dom evaluates e.g. `:has(a h3)` like `:has(a)`, so such selectors behave differently in tests and
 * browsers. Rules keep each :has() argument (and each item of a :has() list) to a single compound selector.
 */
export function combinatorInsideHas(selector: string): string | null {
  for (let i = selector.indexOf(':has('); i !== -1; i = selector.indexOf(':has(', i + 1)) {
    let depth = 0;
    let end = i + ':has('.length;
    for (; end < selector.length; end++) {
      const ch = selector[end];
      if (ch === '(') depth++;
      else if (ch === ')') {
        if (depth === 0) break;
        depth--;
      }
    }
    const arg = selector.slice(i + ':has('.length, end);
    // Ignore quoted strings and attribute brackets, then split the selector list.
    const plain = arg.replace(/"[^"]*"|'[^']*'/g, '""').replace(/\[[^\]]*\]/g, '[]');
    if (plain.split(',').some((part) => /[\s>+~]/.test(part.trim()))) return arg;
  }
  return null;
}

/** Structural checks every shipped rule must pass. Behavior is tested per site against fixtures. */
export function validateRules(rules: readonly Rule[]): string[] {
  const problems: string[] = [];
  const parses = (selector: string) => {
    try {
      document.createDocumentFragment().querySelector(selector);
      return true;
    } catch {
      return false;
    }
  };
  const seen = new Set<string>();
  const allSelectors = (rule: Rule) => [
    ...(rule.selectors ?? []),
    ...(rule.anchors ?? []).flatMap((a) => [a.selector, a.container]),
  ];
  for (const rule of rules) {
    if (!/^[a-z0-9-]+\.[a-z0-9-]+$/.test(rule.id))
      problems.push(`${rule.id}: id must be <site>.<feature>`);
    if (seen.has(rule.id)) problems.push(`${rule.id}: duplicate id`);
    seen.add(rule.id);
    if (rule.hosts.length === 0) problems.push(`${rule.id}: no hosts`);
    if (!(CATEGORIES as readonly string[]).includes(rule.category))
      problems.push(`${rule.id}: unknown category ${rule.category}`);
    if (!rule.selectors?.length && !rule.anchors?.length)
      problems.push(`${rule.id}: no selectors or anchors`);
    for (const s of rule.selectors ?? [])
      if (!parses(s)) problems.push(`${rule.id}: bad selector ${s}`);
    for (const s of allSelectors(rule)) {
      const bad = combinatorInsideHas(s);
      if (bad)
        problems.push(
          `${rule.id}: combinator inside :has(${bad}) (unreliable in tests; use one compound)`,
        );
    }
    for (const a of rule.anchors ?? []) {
      if (!parses(a.selector)) problems.push(`${rule.id}: bad anchor selector ${a.selector}`);
      if (!parses(a.container)) problems.push(`${rule.id}: bad container ${a.container}`);
      if (a.labels.length === 0) problems.push(`${rule.id}: anchor without labels`);
    }
  }
  return problems;
}

describe('ALL_RULES', () => {
  it('passes structural validation', () => {
    expect(validateRules(ALL_RULES)).toEqual([]);
  });
});

describe('combinatorInsideHas', () => {
  it.each([
    ['#rso > div:has(a h3)', 'a h3'],
    ['div:has(> span)', '> span'],
    ['div:not(:has(a > h3))', 'a > h3'],
    ['div:has(a, b + c)', 'a, b + c'],
  ])('flags %s', (selector, arg) => {
    expect(combinatorInsideHas(selector)).toBe(arg);
  });

  it.each([
    '#rso > div:has([data-initq]):not(:has(h3))',
    '[role="listitem"]:has(a[href*="udm=50&"], a[href$="udm=50"])',
    'div:has([data-x="a b > c"])',
    '[role="main"] > div:not(:has(#rso)):has([data-subtree="aimc"], #eKIzJc)',
  ])('allows %s', (selector) => {
    expect(combinatorInsideHas(selector)).toBeNull();
  });
});

describe('validateRules', () => {
  it('catches malformed rules', () => {
    const bad: Rule[] = [
      { id: 'Bad Id', category: 'ai', description: '', hosts: [], selectors: ['div[[['] },
      {
        id: 'x.dup',
        category: 'ai',
        description: '',
        hosts: ['a.com'],
        anchors: [{ selector: 'h2', labels: [], container: ')(' }],
      },
      { id: 'x.dup', category: 'ai', description: '', hosts: ['a.com'] },
      {
        id: 'x.cat',
        category: 'memes' as never,
        description: '',
        hosts: ['a.com'],
        selectors: ['p'],
      },
    ];
    expect(validateRules(bad)).toEqual([
      'Bad Id: id must be <site>.<feature>',
      'Bad Id: no hosts',
      'Bad Id: bad selector div[[[',
      'x.dup: bad container )(',
      'x.dup: anchor without labels',
      'x.dup: duplicate id',
      'x.dup: no selectors or anchors',
      'x.cat: unknown category memes',
    ]);
  });
});
