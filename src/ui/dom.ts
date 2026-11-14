type Attrs = Record<string, string | boolean | undefined>;
type Child = Node | string | null | undefined | false;

/**
 * Tiny element builder: `h('label', { class: 'row' }, h('span', {}, 'Text'))`.
 * `true` sets a boolean attribute, and `false`/`undefined` leave it out. Strings become text nodes (never HTML).
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    el.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

/** A switch row (docs/style-guide.md → Switch). Returns the row and its input. */
export function switchRow(
  id: string,
  label: string,
  hint?: string,
): { row: HTMLLabelElement; input: HTMLInputElement } {
  const input = h('input', { id, class: 'switch', type: 'checkbox', role: 'switch' });
  const hintId = hint ? `${id}-hint` : undefined;
  if (hintId) input.setAttribute('aria-describedby', hintId);
  const row = h(
    'label',
    { class: 'row', for: id },
    h(
      'span',
      { class: 'row-text' },
      h('span', {}, label),
      hint ? h('span', { class: 'row-hint', id: hintId }, hint) : null,
    ),
    input,
  );
  return { row, input };
}
