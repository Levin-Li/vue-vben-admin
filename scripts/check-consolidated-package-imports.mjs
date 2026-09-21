import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceRoots = [
  'packages',
  'apps',
  'internal',
  'playground',
  'docs/src',
  'docs/.vitepress',
].map((path) => resolve(root, path));
const oldPackagePattern =
  /@(?:vben-core\/(?:design|shared|typings|composables|preferences|icons|shadcn-ui|form-ui|layout-ui|menu-ui|popup-ui|tabs-ui)|vben\/(?:access|constants|hooks|icons|locales|plugins|preferences|request|stores|styles|types|utils))[/"']/;

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (
        ![
          '.output',
          '.vitepress/cache',
          'dist',
          'docs',
          'node_modules',
        ].includes(entry)
      )
        walk(path, files);
    } else if (/\.(?:cts|mts|ts|tsx|vue)$/.test(entry)) files.push(path);
  }
  return files;
}

const violations = sourceRoots
  .flatMap((directory) => walk(directory))
  .filter((path) => oldPackagePattern.test(readFileSync(path, 'utf8')));

if (violations.length > 0) {
  throw new Error(
    `发现已废弃小包导入，必须迁移到 foundation、ui 或 runtime：\n${violations
      .map((path) => `- ${path.replace(`${root}/`, '')}`)
      .join('\n')}`,
  );
}

console.log('聚合包导入检查通过。');
