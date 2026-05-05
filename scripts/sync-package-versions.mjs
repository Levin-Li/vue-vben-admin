import {
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packagesRoot = resolve(frontendRoot, 'packages');
const versionConfigPath = resolve(frontendRoot, 'package-versions.json');
const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function findPackageJsonFiles(dir) {
  const result = [];

  for (const entry of readdirSync(dir)) {
    if (entry === 'dist' || entry === 'node_modules') {
      continue;
    }

    const entryPath = resolve(dir, entry);
    const stat = statSync(entryPath);

    if (stat.isDirectory()) {
      result.push(...findPackageJsonFiles(entryPath));
      continue;
    }

    if (entry === 'package.json') {
      result.push(entryPath);
    }
  }

  return result;
}

function resolvePackageVersion(packageName, versionConfig) {
  if (versionConfig.packages?.[packageName]) {
    return versionConfig.packages[packageName];
  }

  return versionConfig.default;
}

function assertVersion(version, source) {
  if (!version || typeof version !== 'string') {
    throw new Error(`${source} 缺少包版本配置`);
  }
}

const versionConfig = readJson(versionConfigPath);
assertVersion(versionConfig.default, 'package-versions.json default');

const packageFiles = findPackageJsonFiles(packagesRoot).sort();
const changedPackages = [];

for (const packageJsonPath of packageFiles) {
  const packageJson = readJson(packageJsonPath);

  if (!packageJson.name || packageJson.private === true) {
    continue;
  }

  const nextVersion = resolvePackageVersion(packageJson.name, versionConfig);
  assertVersion(nextVersion, packageJson.name);

  if (packageJson.version !== nextVersion) {
    changedPackages.push({
      from: packageJson.version,
      name: packageJson.name,
      path: relative(frontendRoot, packageJsonPath),
      to: nextVersion,
    });
    packageJson.version = nextVersion;

    if (!checkOnly) {
      writeJson(packageJsonPath, packageJson);
    }
  }
}

if (changedPackages.length === 0) {
  console.log('packages 目录下的包版本已经和 package-versions.json 一致。');
  process.exit(0);
}

for (const item of changedPackages) {
  console.log(`${item.name}: ${item.from || '<empty>'} -> ${item.to}`);
}

if (checkOnly) {
  console.error(
    'packages 目录下存在未同步的包版本，请运行 pnpm run sync:package-versions。',
  );
  process.exit(1);
}

console.log(`已同步 ${changedPackages.length} 个包版本。`);
