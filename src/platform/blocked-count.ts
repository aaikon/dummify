import { isBlockedCountMessage } from '@/core/messages';
import { type BadgeApi, updateBadge } from './badge';

/**
 * Per-tab blocked counts live in `storage.session`. It survives MV3 service-worker restarts,
 * is cleared when the browser closes, and is only readable by extension pages (popup), not by content scripts.
 */
export const blockedCountItem = (tabId: number) =>
  storage.defineItem<number>(`session:blocked-count:${String(tabId)}`, { fallback: 0 });

/** The subset of `runtime.MessageSender` we use (kept structural so tests can pass plain objects). */
interface MessageSender {
  readonly tab?: { readonly id?: number | undefined } | undefined;
  readonly frameId?: number | undefined;
}

/**
 * Background handler for count reports. Only top-frame reports count, because each document reports its
 * own total and a new top-level page starts again from 0. Stores the count for the popup and mirrors it
 * on the toolbar badge.
 */
export async function handleBlockedCountMessage(
  message: unknown,
  sender: MessageSender,
  badge?: BadgeApi,
): Promise<void> {
  if (!isBlockedCountMessage(message)) return;
  const tabId = sender.tab?.id;
  if (tabId === undefined || sender.frameId !== 0) return;
  await blockedCountItem(tabId).setValue(message.count);
  if (badge) await updateBadge(badge, tabId, message.count);
}

export async function clearBlockedCount(tabId: number): Promise<void> {
  await blockedCountItem(tabId).removeValue();
}
