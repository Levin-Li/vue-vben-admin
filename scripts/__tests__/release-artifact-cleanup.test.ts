import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { cleanupOldReleaseArtifacts } from '../release-artifact-cleanup.mjs';

describe('发布暂存文件保留期限', () => {
  it('只删超过 24 小时的脚本生成 tarball，保留当前批次和范围外文件', () => {
    const root = mkdtempSync(join(tmpdir(), 'release-cleanup-test-'));
    const now = Date.now();
    const old = join(root, 'levin-admin-framework-1.0.0.tgz');
    const current = join(root, 'levin-admin-framework-1.0.1.tgz');
    const userFile = join(root, 'notes.tgz');
    const staged = join(root, '.publish-tarballs', 'old', 'vben-ui-1.0.0.tgz');
    const failedBatch = join(root, '.publish-tarballs', 'failed-batch');
    const failedTarball = join(failedBatch, 'vben-ui-1.0.0.tgz');
    try {
      mkdirSync(join(root, '.publish-tarballs', 'old'), { recursive: true });
      mkdirSync(failedBatch, { recursive: true });
      writeFileSync(join(failedBatch, '.failed'), '保留失败批次');
      for (const path of [old, current, userFile, staged, failedTarball]) {
        writeFileSync(path, 'tarball');
        utimesSync(
          path,
          new Date(now - 2 * 86_400_000),
          new Date(now - 2 * 86_400_000),
        );
      }

      const deleted = cleanupOldReleaseArtifacts(root, {
        now,
        protectedPaths: [current],
      });
      expect(deleted).toContain(old);
      expect(deleted).toContain(staged);
      expect(existsSync(current)).toBe(true);
      expect(existsSync(userFile)).toBe(true);
      expect(existsSync(failedTarball)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
