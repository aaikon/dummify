import { describe, expect, it } from 'vitest';
import { buildStylesheet, type Group, groupTagged } from './css';
import type { Rule } from './rule';

const HIDE = '{ display: none !important; }';
const rules: Rule[] = [
  { id: 'a.x', category: 'ai', description: '', hosts: ['a.com'], selectors: ['.one', '#two'] },
  {
    id: 'b.y',
    category: 'short-form',
    description: '',
    hosts: ['b.com'],
    selectors: ['[data-three]'],
  },
];

describe('buildStylesheet', () => {
  it('hides tagged elements of enabled groups only', () => {
    expect(buildStylesheet([], new Set<Group>(['ai']))).toBe(`${groupTagged('ai')} ${HIDE}`);
    expect(buildStylesheet([], new Set<Group>(['heuristic', 'ai'])).split('\n')).toEqual([
      `${groupTagged('ai')} ${HIDE}`,
      `${groupTagged('heuristic')} ${HIDE}`,
    ]);
    expect(buildStylesheet([], new Set<Group>())).toBe('');
  });

  it('emits one CSS rule per selector, only for rules whose category is enabled', () => {
    expect(buildStylesheet(rules, new Set<Group>(['ai', 'short-form'])).split('\n')).toEqual([
      `${groupTagged('ai')} ${HIDE}`,
      `${groupTagged('short-form')} ${HIDE}`,
      `.one ${HIDE}`,
      `#two ${HIDE}`,
      `[data-three] ${HIDE}`,
    ]);
    expect(buildStylesheet(rules, new Set<Group>(['short-form'])).split('\n')).toEqual([
      `${groupTagged('short-form')} ${HIDE}`,
      `[data-three] ${HIDE}`,
    ]);
  });
});
