import { describe, expect, it } from 'vitest';
import { type Rule, rulesForHost } from './rule';

const rule = (id: string, hosts: string[]): Rule => ({
  id,
  category: 'ai',
  description: id,
  hosts,
  selectors: ['x'],
});

describe('rulesForHost', () => {
  const rules = [
    rule('a.search', ['google.*']),
    rule('b.mail', ['mail.google.com']),
    rule('c.any', ['example.com']),
  ];

  it('selects rules whose host patterns match', () => {
    expect(rulesForHost(rules, 'google.de').map((r) => r.id)).toEqual(['a.search']);
    expect(rulesForHost(rules, 'mail.google.com').map((r) => r.id)).toEqual(['b.mail']);
    expect(rulesForHost(rules, 'docs.example.com').map((r) => r.id)).toEqual(['c.any']);
  });

  it('returns nothing for unrelated hosts', () => {
    expect(rulesForHost(rules, 'wikipedia.org')).toEqual([]);
  });
});
