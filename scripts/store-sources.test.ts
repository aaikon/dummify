import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { globSync } from 'tinyglobby';
import { describe, expect, it } from 'vitest';
import { STORE_SOURCES } from './store-sources';

const root = process.cwd();

/** Files the sources zip would take from the working folder (same matcher and options WXT uses). */
function matchedSources(): string[] {
  return globSync(STORE_SOURCES, { cwd: root, dot: false });
}

function trackedFiles(): Set<string> {
  return new Set(execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n'));
}

describe('store sources zip (T-013)', () => {
  it('only contains files tracked by git, so nothing local or private can leak into it', () => {
    const tracked = trackedFiles();
    const untracked = matchedSources().filter((f) => !tracked.has(f));
    expect(untracked).toEqual([]);
  });

  it('leaves out the saved test pages', () => {
    expect(matchedSources().filter((f) => f.startsWith('tests/'))).toEqual([]);
  });

  it('includes everything the build reads outside src/ and public/', () => {
    const matched = new Set(matchedSources());
    for (const f of [
      'package.json',
      'package-lock.json',
      'wxt.config.ts',
      'scripts/third-party-notices.ts',
      'scripts/store-sources.ts',
    ])
      expect(matched, f).toContain(f);
  });

  it('lists only paths that exist', () => {
    for (const pattern of STORE_SOURCES.filter((p) => !p.includes('*')))
      expect(existsSync(pattern), pattern).toBe(true);
  });
});
