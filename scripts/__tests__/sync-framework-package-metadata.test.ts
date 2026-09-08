import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'framework-metadata-test-'));
  roots.push(root);
  const script = resolve(root, 'scripts/sync-framework-package-metadata.mjs');
  mkdirSync(resolve(root, 'scripts'), { recursive: true });
  cpSync(resolve('scripts/sync-framework-package-metadata.mjs'), script);
  const exports = {
    './package-version': {
      types: './package-version.d.mts',
      default: './package-version.mjs',
    },
  };
  const files = ['package-version.mjs', 'package-version.d.mts'];
  const framework = resolve(root, 'packages/business/admin-framework');
  mkdirSync(resolve(framework, 'src/framework-commons/app'), {
    recursive: true,
  });
  writeFileSync(
    resolve(framework, 'package.json'),
    JSON.stringify({
      name: '@levin/admin-framework',
      version: '1.0.0',
      exports,
      files,
      dependencies: { '@vben/utils': '8.0.0', vue: '3.5.0' },
      peerDependencies: { '@vben/utils': '8.0.0' },
    }),
  );
  const dependency = resolve(root, 'packages/utils');
  mkdirSync(dependency, { recursive: true });
  const manifest = resolve(dependency, 'package.json');
  writeFileSync(
    manifest,
    JSON.stringify({
      name: '@vben/utils',
      version: '9.0.0',
      exports,
      files,
      publishConfig: { exports },
    }),
  );
  return {
    manifest,
    framework,
    dependency,
    output: resolve(
      framework,
      'src/framework-commons/app/framework-package-metadata.ts',
    ),
    run: (...args: string[]) =>
      execFileSync(process.execPath, [script, ...args], { stdio: 'pipe' }),
  };
}

describe('框架实际依赖包元数据清单', () => {
  it('去重内部依赖并保留消费方解析路径，不固化发布方版本', () => {
    const { output, run } = fixture();
    run();
    const content = readFileSync(output, 'utf8');
    expect(content.match(/from '@vben\/utils\/package-version'/g)).toHaveLength(
      1,
    );
    expect(content).not.toContain('vue/package-version');
    expect(content).not.toContain('8.0.0');
    expect(content).not.toContain('9.0.0');
    expect(() => run('--check')).not.toThrow();
    run();
    expect(readFileSync(output, 'utf8')).toBe(content);
    writeFileSync(output, `${content}// 过期内容\n`);
    expect(() => run('--check')).toThrow();
  });

  it('单包构建只刷新自身时间，默认同步保留记录且不修复其他过期版本', () => {
    const { run, framework, dependency, manifest } = fixture();
    run();
    const dependencyFile = resolve(dependency, 'package-version.mjs');
    const original = readFileSync(dependencyFile, 'utf8');
    run();
    expect(readFileSync(dependencyFile, 'utf8')).toBe(original);
    const frameworkFile = resolve(framework, 'package-version.mjs');
    writeFileSync(
      frameworkFile,
      readFileSync(frameworkFile, 'utf8').replace(
        /\d{4}-\d{2}-\d{2}T[^"']+/,
        '2000-01-01T00:00:00.000Z',
      ),
    );
    const data = JSON.parse(readFileSync(manifest, 'utf8'));
    data.version = '10.0.0';
    writeFileSync(manifest, JSON.stringify(data));
    run('--package', framework);
    expect(readFileSync(frameworkFile, 'utf8')).not.toContain('2000-01-01');
    expect(readFileSync(dependencyFile, 'utf8')).toBe(original);
    expect(() => run('--check')).toThrow();
    expect(() => run()).toThrow();
    expect(readFileSync(dependencyFile, 'utf8')).toBe(original);
    run('--package', dependency);
    expect(readFileSync(dependencyFile, 'utf8')).toContain('10.0.0');
    expect(() => run('--check')).not.toThrow();
  });

  it('校验缺失元数据和非法打包时间', () => {
    const { run, dependency } = fixture();
    expect(() => run('--check')).toThrow();
    run();
    const file = resolve(dependency, 'package-version.mjs');
    writeFileSync(
      file,
      "export const packageVersion = {name:'@vben/utils',version:'9.0.0',buildTime:'invalid'};\n",
    );
    expect(() => run('--check')).toThrow();
  });

  it('阻止发布出口覆盖导致实际包元数据不可解析', () => {
    const { manifest, run } = fixture();
    const data = JSON.parse(readFileSync(manifest, 'utf8'));
    data.publishConfig.exports = {};
    writeFileSync(manifest, JSON.stringify(data));
    expect(() => run()).toThrow();
  });
});
