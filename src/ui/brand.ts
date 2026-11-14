import markUrl from '@/assets/brand/mark.svg';
import { h } from './dom';

/**
 * The dummify lockup: tile mark + "dummify" wordmark (docs/style-guide.md → Brand).
 * `size` is the wordmark's font size in px. The mark scales with it, and so does the gap (0.24 × size).
 * Exposed to assistive tech as a single "dummify" label.
 */
export function lockup(size: number): HTMLSpanElement {
  const el = h(
    'span',
    { class: 'lockup', role: 'img', 'aria-label': 'dummify' },
    h('img', { class: 'lockup-mark', src: markUrl, alt: '' }),
    h('span', { class: 'lockup-word', 'aria-hidden': 'true' }, 'dummify'),
  );
  el.style.setProperty('--lockup-size', `${String(size)}px`);
  return el;
}
