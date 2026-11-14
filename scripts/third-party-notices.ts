/**
 * Third-party code and fonts bundled into the extension, and the notice file shipped with every build (T-032).
 *
 * The SIL Open Font License requires every copy of a font to carry its copyright notice and license, and MIT
 * requires the copyright notice. wxt.config.ts writes `thirdPartyNotices()` to THIRD_PARTY_NOTICES.txt at the root
 * of each build. Anything new that ends up in the bundle (a font, a runtime library) must be added here.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface BundledPackage {
  /** npm package name, as installed in node_modules. */
  name: string;
  /** What it's used for in the extension (shown in the notice). */
  use: string;
}

export const BUNDLED_PACKAGES: readonly BundledPackage[] = [
  {
    name: '@fontsource-variable/geist',
    use: 'Geist, the UI font of the popup and onboarding page',
  },
  {
    name: '@fontsource/bricolage-grotesque',
    use: 'Bricolage Grotesque ExtraBold, the dummify wordmark',
  },
  { name: '@wxt-dev/browser', use: 'browser API shim bundled by the WXT framework' },
];

interface PackageJson {
  version: string;
  license?: string;
  author?: string | { name: string };
  homepage?: string;
  repository?: string | { url: string };
}

const MIT = `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of
the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.`;

const LICENSE_FILES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'OFL.txt'];

/** The package's own license file, or (for MIT packages that don't ship one) the MIT text with its author. */
function licenseText(name: string, dir: string, pkg: PackageJson): string {
  const file = LICENSE_FILES.map((f) => join(dir, f)).find((f) => existsSync(f));
  if (file) return readFileSync(file, 'utf8').trim();
  if (pkg.license === 'MIT') {
    const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name;
    if (author) return `MIT License\n\nCopyright (c) ${author.replace(/\s*<.*>/, '')}\n\n${MIT}`;
  }
  throw new Error(
    `${name}: no license file and no MIT author to build a notice from (license: ${String(pkg.license)})`,
  );
}

function source(pkg: PackageJson): string {
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  return (pkg.homepage ?? repo ?? '').replace(/^git\+/, '').replace(/\.git$/, '');
}

/** The full notice text for every bundled package, read from `root`/node_modules. */
export function thirdPartyNotices(
  root: string,
  packages: readonly BundledPackage[] = BUNDLED_PACKAGES,
): string {
  const sections = packages.map(({ name, use }) => {
    const dir = join(root, 'node_modules', name);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as PackageJson;
    const header = [
      `${name} ${pkg.version}`,
      `Used for: ${use}`,
      `License: ${pkg.license ?? 'see below'}`,
    ];
    const src = source(pkg);
    if (src) header.push(`Source: ${src}`);
    return `${header.join('\n')}\n\n${licenseText(name, dir, pkg)}`;
  });
  const rule = '\n\n' + '-'.repeat(78) + '\n\n';
  return (
    'dummify includes the following third-party software and fonts. Their licenses and copyright notices follow.' +
    rule +
    sections.join(rule) +
    '\n'
  );
}
