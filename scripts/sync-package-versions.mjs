import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
const packageJsonItems = packageFiles.map((packageJsonPath) => ({
  packageJson: readJson(packageJsonPath),
  packageJsonPath,
}));
const publishablePackageNames = new Set(
  packageJsonItems
    .map(({ packageJson }) => packageJson)
    .filter((packageJson) => packageJson.name && packageJson.private !== true)
    .map((packageJson) => packageJson.name),
);

function syncLocalPackageReferences(packageJson, packageJsonPath) {
  const dependencySections = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
  ];

  for (const section of dependencySections) {
    const dependencies = packageJson[section];

    if (!dependencies) {
      continue;
    }

    for (const dependencyName of Object.keys(dependencies)) {
      if (!publishablePackageNames.has(dependencyName)) {
        continue;
      }

      if (dependencies[dependencyName] !== 'workspace:*') {
        changedPackages.push({
          from: dependencies[dependencyName],
          name: `${packageJson.name} ${section}.${dependencyName}`,
          path: relative(frontendRoot, packageJsonPath),
          to: 'workspace:*',
        });
        dependencies[dependencyName] = 'workspace:*';
      }
    }
  }

  const peerDependencies = packageJson.peerDependencies;

  if (!peerDependencies) {
    return;
  }

  for (const dependencyName of Object.keys(peerDependencies)) {
    if (!publishablePackageNames.has(dependencyName)) {
      continue;
    }

    const nextVersion = resolvePackageVersion(dependencyName, versionConfig);
    assertVersion(nextVersion, dependencyName);

    if (peerDependencies[dependencyName] !== nextVersion) {
      changedPackages.push({
        from: peerDependencies[dependencyName],
        name: `${packageJson.name} peerDependencies.${dependencyName}`,
        path: relative(frontendRoot, packageJsonPath),
        to: nextVersion,
      });
      peerDependencies[dependencyName] = nextVersion;
    }
  }
}

for (const { packageJson, packageJsonPath } of packageJsonItems) {
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
  }

  syncLocalPackageReferences(packageJson, packageJsonPath);

  if (!checkOnly) {
    writeJson(packageJsonPath, packageJson);
  }
}

if (changedPackages.length === 0) {
  console.log(
    'packages 目录下的包版本和内部依赖版本已经和 package-versions.json 一致。',
  );
  process.exit(0);
}

for (const item of changedPackages) {
  console.log(`${item.name}: ${item.from || '<empty>'} -> ${item.to}`);
}

if (checkOnly) {
  console.error(
    'packages 目录下存在未同步的包版本或内部依赖版本，请运行 pnpm run sync:package-versions。',
  );
  process.exit(1);
}

console.log(`已同步 ${changedPackages.length} 个包版本或内部依赖版本。`);
