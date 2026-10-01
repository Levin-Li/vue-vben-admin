import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const dayInMilliseconds = 24 * 60 * 60 * 1000;
const generatedTarballName =
  /^(?:levin|vben|vben-core)-[a-z0-9-]+-\d+\.\d+\.\d+\.tgz$/;

export function cleanupOldReleaseArtifacts(
  outputDir,
  { now = Date.now(), protectedPaths = [] } = {},
) {
  if (!existsSync(outputDir)) return [];
  const root = resolve(outputDir);
  const protectedFiles = new Set(protectedPaths.map((path) => resolve(path)));
  const deleted = [];

  function deleteOldTarball(path) {
    const file = resolve(path);
    const info = statSync(file);
    if (
      info.isFile() &&
      !protectedFiles.has(file) &&
      now - info.mtimeMs > dayInMilliseconds
    ) {
      rmSync(file);
      deleted.push(file);
    }
  }

  // 根目录只认发布器 tarball 命名，不碰用户其它临时文件。
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && generatedTarballName.test(entry.name)) {
      deleteOldTarball(resolve(root, entry.name));
    }
  }

  // 仅进入发布器自有暂存目录，拒绝跟随符号链接或越界清理。
  const staging = resolve(root, '.publish-tarballs');
  function walk(directory) {
    if (!existsSync(directory)) return;
    if (existsSync(resolve(directory, '.failed'))) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && generatedTarballName.test(entry.name)) {
        deleteOldTarball(path);
      }
    }
  }
  walk(staging);

  return deleted;
}
