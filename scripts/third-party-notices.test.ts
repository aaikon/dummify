import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUNDLED_PACKAGES, thirdPartyNotices } from './third-party-notices';

const root = process.cwd();

/** Font packages imported by any CSS under src/ (these end up in the build). */
function importedFontPackages(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.css'))
        for (const m of readFileSync(p, 'utf8').matchAll(
          /@import\s+['"](@fontsource[^/]*\/[^/'"]+)/g,
        ))
          if (m[1]) found.add(m[1]);
    }
  };
  walk(join(root, 'src'));
  return found;
}

describe('third-party notices (T-032)', () => {
  const notices = thirdPartyNotices(root);

  it('lists every font package the shipped CSS imports', () => {
    const fonts = importedFontPackages();
    expect(fonts.size).toBeGreaterThan(0);
    const listed = new Set(BUNDLED_PACKAGES.map((p) => p.name));
    for (const font of fonts) expect(listed, font).toContain(font);
  });

  it('carries the full OFL text and copyright notice for each font', () => {
    expect(notices).toContain('Copyright 2024 The Geist Project Authors');
    expect(notices).toContain('Copyright 2022 The Bricolage Grotesque Project Authors');
    // One full OFL text per font: its preamble and its termination clause.
    expect(notices.match(/SIL OPEN FONT LICENSE Version 1\.1/g)).toHaveLength(2);
    expect(notices.match(/This license becomes null and void/g)).toHaveLength(2);
  });

  it('carries the MIT notice for the bundled browser shim', () => {
    expect(notices).toMatch(/@wxt-dev\/browser \d+\.\d+\.\d+/);
    expect(notices).toContain('Copyright (c) Aaron Klinker');
    expect(notices).toContain(
      'The above copyright notice and this permission notice shall be included',
    );
  });

  it('names each package with its installed version', () => {
    for (const { name } of BUNDLED_PACKAGES) {
      const { version } = JSON.parse(
        readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8'),
      ) as {
        version: string;
      };
      expect(notices).toContain(`${name} ${version}`);
    }
  });

  it('fails loudly when a package has no license text to ship', () => {
    const fake = mkdtempSync(join(tmpdir(), 'notices-'));
    mkdirSync(join(fake, 'node_modules', 'mystery'), { recursive: true });
    writeFileSync(
      join(fake, 'node_modules', 'mystery', 'package.json'),
      '{"version":"1.0.0","license":"GPL-3.0"}',
    );
    expect(() => thirdPartyNotices(fake, [{ name: 'mystery', use: 'test' }])).toThrow(
      /mystery: no license file/,
    );
  });
});
