import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

import { build, transformWithEsbuild } from 'vite';
import { describe, expect, it } from 'vitest';

const frameworkRoot = resolve('packages/business/admin-framework');

describe('普通子项目消费已构建框架包', () => {
  it('不注入版本信息，仍展示实际引用版本并保留每包打包时间', async () => {
    const root = mkdtempSync(join(tmpdir(), 'levin-version-consumer-'));
    function write(path: string, content: string) {
      const file = join(root, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
    try {
      const framework = JSON.parse(
        readFileSync(join(frameworkRoot, 'package.json'), 'utf8'),
      );
      write(
        'package.json',
        JSON.stringify({ name: 'consumer-fixture', type: 'module' }),
      );
      const prefix = 'node_modules/@levin/admin-framework/';
      write(`${prefix}package.json`, JSON.stringify(framework));
      write(
        `${prefix}package-version.mjs`,
        readFileSync(join(frameworkRoot, 'package-version.mjs'), 'utf8'),
      );
      for (const file of [
        'frontend-build-versions.mjs',
        'framework-package-metadata.mjs',
      ]) {
        const { code } = await transformWithEsbuild(
          readFileSync(
            join(
              frameworkRoot,
              'src/framework-commons/app',
              file.replace('.mjs', '.ts'),
            ),
            'utf8',
          ),
          file.replace('.mjs', '.ts'),
          { format: 'esm', target: 'esnext' },
        );
        expect(code).not.toContain('/package.json');
        expect(code).not.toContain('__VBEN_ADMIN_METADATA__');
        write(`${prefix}dist/framework-commons/app/${file}`, code);
      }
      // 隔离登录/模块注册依赖，保留真实发布入口、版本汇总代码和元数据导入。
      write(
        `${prefix}dist/framework-commons/app/options.mjs`,
        'export const getEnabledFrontendModules = () => [];',
      );
      for (const name of Object.keys(framework.peerDependencies).filter(
        (name) => name.startsWith('@vben/'),
      )) {
        const packageRoot = join(frameworkRoot, 'node_modules', name);
        const metadata = JSON.parse(
          readFileSync(join(packageRoot, 'package.json'), 'utf8'),
        );
        write(
          `node_modules/${name}/package.json`,
          JSON.stringify({
            ...metadata,
            exports: metadata.publishConfig?.exports || metadata.exports,
          }),
        );
        write(
          `node_modules/${name}/package-version.mjs`,
          readFileSync(join(packageRoot, 'package-version.mjs'), 'utf8'),
        );
      }
      write(
        'entry.mjs',
        "import { getFrontendBuildInfo } from '@levin/admin-framework/framework-commons/app/frontend-build-versions'; export const result = getFrontendBuildInfo();",
      );
      async function readResult() {
        const output: any = await build({
          configFile: false,
          resolve: { conditions: ['module', 'browser', 'production'] },
          root,
          logLevel: 'silent',
          build: {
            write: false,
            minify: false,
            target: 'esnext',
            lib: {
              entry: join(root, 'entry.mjs'),
              name: 'VersionReport',
              formats: ['iife'],
            },
          },
        });
        const chunks = (Array.isArray(output) ? output : [output]).flatMap(
          (item: any) => item.output,
        );
        const code = chunks.find((item: any) => item.type === 'chunk').code;
        return runInNewContext(`${code}; VersionReport.result;`);
      }
      const normal = await readResult();
      expect(normal.versions).toHaveLength(15);
      expect(
        normal.versions.find(
          (item: any) => item.id === '@levin/admin-framework',
        ).version,
      ).toBe(framework.version);
      const stores = normal.versions.find(
        (item: any) => item.id === '@vben/stores',
      );
      expect(Number.isFinite(Date.parse(stores.buildTime))).toBe(true);
      write(
        'node_modules/@vben/stores/package-version.mjs',
        `export const packageVersion = ${JSON.stringify({ name: '@vben/stores', version: '0.0.1', buildTime: stores.buildTime })};`,
      );
      const changed = await readResult();
      expect(
        changed.versions.find((item: any) => item.id === '@vben/stores'),
      ).toMatchObject({
        version: '0.0.1',
        buildTime: stores.buildTime,
      });
      expect(changed.versions[0]).not.toHaveProperty('status');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
