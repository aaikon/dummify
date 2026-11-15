import { describe, expect, it } from 'vitest';
import config from '../wxt.config';

/** The manifest wxt.config.ts produces for a Firefox production build. */
async function firefoxManifest() {
  const { manifest } = config;
  if (typeof manifest !== 'function')
    throw new Error('expected wxt.config.ts manifest to be a function');
  return manifest({ browser: 'firefox', mode: 'production', command: 'build', manifestVersion: 3 });
}

const major = (version: string | undefined): number => Number(version?.split('.')[0] ?? 0);

describe('Firefox manifest (T-013)', () => {
  // AMO's linter rejects data_collection_permissions when a minimum version predates support for it:
  // Firefox 140 on desktop, 142 on Android (gecko_android falls back to the desktop minimum when absent).
  it('sets minimum versions that support data_collection_permissions on desktop and Android', async () => {
    const settings = (await firefoxManifest()).browser_specific_settings;
    expect(settings?.gecko?.data_collection_permissions).toEqual({ required: ['none'] });
    expect(major(settings?.gecko?.strict_min_version)).toBeGreaterThanOrEqual(140);
    expect(major(settings?.gecko_android?.strict_min_version)).toBeGreaterThanOrEqual(142);
  });
});
