import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function incrementPatchVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`仅支持稳定的 x.y.z 前端包版本: ${version}`);
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function compareVersions(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (const [index, value] of leftParts.entries()) {
    if (value !== rightParts[index]) return value - rightParts[index];
  }
  return 0;
}

export function nextFullReleaseVersions(versionConfig) {
  const currentVersions = [
    versionConfig.default,
    versionConfig.releaseVersion,
    ...Object.values(versionConfig.packages || {}),
  ].filter((version) => typeof version === 'string' && version.length > 0);
  for (const version of currentVersions) incrementPatchVersion(version);
  const batchVersion = incrementPatchVersion(
    currentVersions.toSorted(compareVersions).at(-1),
  );
  return {
    ...versionConfig,
    releaseVersion: batchVersion,
  };
}

function main() {
  const frontendRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const versionConfigPath = resolve(frontendRoot, 'package-versions.json');
  const versionConfig = JSON.parse(readFileSync(versionConfigPath, 'utf8'));
  const nextConfig = nextFullReleaseVersions(versionConfig);
  writeFileSync(versionConfigPath, `${JSON.stringify(nextConfig, null, 2)}\n`);
  console.log(
    `已准备完整前端发布批次：全部内部包统一升级为 ${nextConfig.releaseVersion}。`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
