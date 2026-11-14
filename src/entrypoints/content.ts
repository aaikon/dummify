import { ALL_BEHAVIORS } from '@/behaviors';
import type { BlockedCountMessage } from '@/core/messages';
import { startContentController } from '@/platform/content-controller';
import { ALL_RULES } from '@/rules';

export default defineContentScript({
  matches: ['<all_urls>'],
  // document_start lets us inject hiding CSS before first paint (no-flash invariant).
  runAt: 'document_start',
  main(ctx) {
    const dispose = startContentController({
      doc: document,
      url: location.href,
      rules: ALL_RULES,
      behaviors: ALL_BEHAVIORS,
      report(count) {
        const message: BlockedCountMessage = { type: 'dummify:blocked-count', count };
        // Rejects only while the extension is reloading or updating. The next report recovers.
        browser.runtime.sendMessage(message).catch(() => undefined);
      },
    });
    if (dispose) ctx.onInvalidated(dispose);
  },
});
