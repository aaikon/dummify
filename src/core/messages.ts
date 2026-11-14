/** Content script → background: how many elements are hidden in this tab's top frame. */
export interface BlockedCountMessage {
  readonly type: 'dummify:blocked-count';
  readonly count: number;
}

export function isBlockedCountMessage(message: unknown): message is BlockedCountMessage {
  if (typeof message !== 'object' || message === null) return false;
  const m = message as Record<string, unknown>;
  return (
    m.type === 'dummify:blocked-count' &&
    typeof m.count === 'number' &&
    Number.isInteger(m.count) &&
    m.count >= 0
  );
}
