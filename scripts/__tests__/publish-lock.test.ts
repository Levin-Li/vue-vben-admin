import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  acquirePublishLock,
  releasePublishLock,
} from '../publish-artifact-gate.mjs';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const lockPath = resolve(frontendRoot, '.frontend-package-publish.lock');
const versionPath = resolve(frontendRoot, 'package-versions.json');
const frameworkManifest = resolve(
  frontendRoot,
  'packages/business/admin-framework/package.json',
);
const npmrcPath = resolve(frontendRoot, '.npmrc.publish.tmp');
const publisher = resolve(frontendRoot, 'scripts/publish-packages.mjs');

function runPublish(...args: string[]) {
  return spawnSync(process.execPath, [publisher, '--publish', ...args], {
    cwd: frontendRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NPM_REGISTRY: 'http://nexus.v-ma.com/repository/npm/',
      NPM_TOKEN: 'publish-lock-test-token',
    },
  });
}

describe('正式发布锁', () => {
  it('已有发布持锁时不修改版本、包声明或临时认证文件', () => {
    const versionsBefore = readFileSync(versionPath, 'utf8');
    const manifestBefore = readFileSync(frameworkManifest, 'utf8');
    const npmrcBefore = existsSync(npmrcPath)
      ? readFileSync(npmrcPath, 'utf8')
      : undefined;
    acquirePublishLock(lockPath);

    try {
      const result = runPublish('--only=@levin/admin-framework');
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('已有前端公共包发布正在执行');
      expect(existsSync(lockPath)).toBe(true);
      expect(readFileSync(versionPath, 'utf8')).toBe(versionsBefore);
      expect(readFileSync(frameworkManifest, 'utf8')).toBe(manifestBefore);
      expect(
        existsSync(npmrcPath) ? readFileSync(npmrcPath, 'utf8') : undefined,
      ).toBe(npmrcBefore);
    } finally {
      releasePublishLock(lockPath);
    }
  });

  it('发布准备失败也释放本次取得的锁', () => {
    const result = runPublish('--since=__missing_release_baseline__');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('无法读取前端 Git 发布基线');
    expect(existsSync(lockPath)).toBe(false);
    expect(existsSync(npmrcPath)).toBe(false);
  });
});
