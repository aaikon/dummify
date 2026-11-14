/** Normalize visible text for comparison: collapse whitespace, trim, lowercase. */
export const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Split an identifier (class name, id, data-testid) into lowercase words:
 * `aiSummaryBox` → [ai, summary, box], `AISummary` → [ai, summary], `kapa-widget_root` → [kapa, widget, root].
 */
export function words(identifier: string): string[] {
  return identifier
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w !== '');
}
