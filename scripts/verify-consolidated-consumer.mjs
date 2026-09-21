import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { packWorkspacePackage } from './publish-artifact-gate.mjs';

// 保留临时目录中的锁文件和构建产物，便于复查独立消费者证据。
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const consumer = mkdtempSync(resolve(tmpdir(), 'levin-consolidated-consumer-'));
const tarballs = resolve(consumer, 'tarballs');
mkdirSync(tarballs);
const dependencies = {};
const selectedTarballs = {};
for (const directory of [
  'packages/@core/foundation',
  'packages/@core/ui',
  'packages/runtime',
  'packages/effects/common-ui',
  'packages/effects/layouts',
  'packages/business/admin-framework',
  'packages/business/oak-base-admin',
]) {
  const dir = resolve(root, directory);
  const manifest = JSON.parse(
    readFileSync(resolve(dir, 'package.json'), 'utf8'),
  );
  const tarball = packWorkspacePackage({ dir, name: manifest.name }, tarballs);
  selectedTarballs[manifest.name] = `file:${tarball}`;
  Object.assign(dependencies, manifest.peerDependencies);
  dependencies[manifest.name] = `file:${tarball}`;
}
// 后续 peer 合并不能覆盖前面已选择的本批 tarball。
Object.assign(dependencies, selectedTarballs);
writeFileSync(
  resolve(consumer, 'package.json'),
  JSON.stringify(
    {
      name: 'consolidated-consumer',
      private: true,
      type: 'module',
      dependencies,
      devDependencies: {
        vite: '7.3.1',
        '@vitejs/plugin-vue': '6.0.4',
        '@vitejs/plugin-vue-jsx': '5.1.4',
        typescript: '5.9.3',
        sass: '1.97.3',
      },
    },
    null,
    2,
  ),
);
writeFileSync(
  resolve(consumer, 'index.html'),
  '<div id="app"></div><script type="module" src="/main.ts"></script>',
);
writeFileSync(
  resolve(consumer, 'tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      module: 'ESNext',
      moduleResolution: 'Bundler',
      target: 'ESNext',
      skipLibCheck: true,
    },
    include: ['main.ts'],
  }),
);
writeFileSync(
  resolve(consumer, 'main.ts'),
  `
import BasicLayout from '@levin/admin-framework/framework-commons/app/layouts/basic.vue';
import { createOakBaseAdminModule } from '@levin/oak-base-admin';
import '@vben/runtime/styles';
import '@vben/runtime/styles/antd';
window.__consumer = { BasicLayout, module: createOakBaseAdminModule() };
`,
);
writeFileSync(
  resolve(consumer, 'vite.config.mjs'),
  String.raw`
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import jsx from '@vitejs/plugin-vue-jsx';
export default defineConfig({ plugins: [vue(), jsx()], build: { target: 'esnext', minify: false }, css: { preprocessorOptions: { scss: { additionalData: '@use "@vben-core/foundation/design/bem" as *;\n' } } } });
`,
);
console.log(`独立消费者目录：${consumer}`);
execFileSync(
  'npm',
  ['install', '--ignore-scripts', '--registry=https://registry.npmmirror.com'],
  { cwd: consumer, stdio: 'inherit' },
);
execFileSync('npm', ['exec', '--', 'vite', 'build'], {
  cwd: consumer,
  stdio: 'inherit',
});
console.log(`独立消费者构建通过：${consumer}`);
