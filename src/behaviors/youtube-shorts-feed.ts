import type { Behavior } from '@/core/behavior';

/*
 * T-028 / ADR-006: a Short opened from a link plays, but you can't move on into YouTube's algorithmic feed of
 * further Shorts. The matching CSS (rule youtube.shorts-feed) hides the Next/Previous buttons and any following
 * reels. This behavior blocks the inputs YouTube uses to advance: mouse wheel over the player, and the arrow and
 * page keys. It intercepts them on window in the capture phase (our listener is registered at document_start,
 * before YouTube's) and stops them before the page sees them.
 *
 * Left alone: typing (inputs, comment box), scrolling inside side panels (comments, description), the side menu,
 * Space/K (play/pause), and every other key.
 */

const NAVIGATION_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp']);

/** Places where wheel/keys belong to the user, not to Shorts navigation. */
const LEAVE_ALONE = [
  'input',
  'textarea',
  'select',
  '[contenteditable]',
  '[contenteditable="true"]',
  'ytd-engagement-panel-section-list-renderer', // comments, description, and other side panels
  'ytd-guide-renderer',
  'ytd-mini-guide-renderer',
  'tp-yt-iron-dropdown', // menus and popups
  'ytd-popup-container',
].join(', ');

const isShortsPage = (path: string) => path.startsWith('/shorts/');

function belongsToUser(target: EventTarget | null): boolean {
  const el = target as Element | null;
  return el?.nodeType === Node.ELEMENT_NODE && el.closest(LEAVE_ALONE) !== null;
}

export const youtubeShortsFeed: Behavior = {
  id: 'youtube.shorts-feed-lock',
  category: 'short-form',
  description:
    'On /shorts/ pages, block the wheel and arrow/page keys that advance into suggested Shorts',
  hosts: ['youtube.com'],
  start({ win, path }) {
    const stop = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const onWheel = (event: WheelEvent) => {
      if (!isShortsPage(path()) || belongsToUser(event.target)) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return; // horizontal scrolling isn't feed navigation
      stop(event);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isShortsPage(path()) || !NAVIGATION_KEYS.has(event.key)) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return; // browser shortcuts
      if (belongsToUser(event.target)) return;
      stop(event);
    };

    const options: AddEventListenerOptions = { capture: true, passive: false };
    win.addEventListener('wheel', onWheel, options);
    win.addEventListener('keydown', onKeyDown, options);
    return () => {
      win.removeEventListener('wheel', onWheel, options);
      win.removeEventListener('keydown', onKeyDown, options);
    };
  },
};
