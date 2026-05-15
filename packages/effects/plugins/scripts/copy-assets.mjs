import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, resolve, relative } from 'node:path';

const assetExtensions = new Set(['.css', '.gif', '.jpeg', '.jpg', '.json', '.png', '.scss', '.svg', '.vue', '.webp']);
const sourceRoot = resolve('src');
const outputRoot = resolve('dist');

function copyAssets(dir) {
  for (const entry of readdirSync(dir)) {
    const source = resolve(dir, entry);
    const stat = statSync(source);
    if (stat.isDirectory()) {
      copyAssets(source);
      continue;
    }
    if (!assetExtensions.has(extname(source))) {
      continue;
    }
    const target = resolve(outputRoot, relative(sourceRoot, source));
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target);
  }
}

if (existsSync(sourceRoot)) {
  copyAssets(sourceRoot);
}
