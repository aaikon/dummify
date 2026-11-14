import type { Category, Rule } from './rule';

/** Attribute set on every element dummify hides. Its value is the id of the rule (or heuristic) that matched. */
export const TAG_ATTR = 'data-dummify';

/** Which switch a hidden element belongs to: a category, or the generic heuristics (ADR-008). */
export const GROUP_ATTR = 'data-dummify-group';

/** Marks dummify's own <style> element. */
export const STYLE_ATTR = 'data-dummify-style';

export type Group = Category | 'heuristic';

/** Elements hidden on behalf of `group`. */
export const groupTagged = (group: Group): string => `[${GROUP_ATTR}="${group}"]`;

const HIDE = '{ display: none !important; }';

/**
 * Builds the hiding stylesheet for the enabled groups only. One CSS rule per selector, so a selector the browser can't
 * parse only drops itself, not the whole list. Tagged elements of a disabled group aren't hidden, so switching a group
 * just rewrites this stylesheet: no DOM changes needed.
 */
export function buildStylesheet(rules: readonly Rule[], groups: ReadonlySet<Group>): string {
  const lines = [...groups].sort().map((g) => `${groupTagged(g)} ${HIDE}`);
  for (const rule of rules) {
    if (!groups.has(rule.category)) continue;
    for (const selector of rule.selectors ?? []) lines.push(`${selector} ${HIDE}`);
  }
  return lines.join('\n');
}
