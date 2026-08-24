import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  acquirePublishLock,
  packPackage,
  releasePublishLock,
  verifyBuiltRouteAssets,
  verifyTarballRouteAssets,
} from './publish-artifact-gate.mjs';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packagesRoot = resolve(frontendRoot, 'packages');
const outputDir = resolve(frontendRoot, 'npm-packages');
const rawArgs = process.argv.slice(2).filter((arg) => arg !== '--');
const args = new Set(rawArgs);
function getMode() {
  if (args.has('--list')) {
    return 'list';
  }

  if (args.has('--publish')) {
    return 'publish';
  }

  return 'pack';
}

const mode = getMode();
const onlyPackages = rawArgs
  .filter((arg) => arg.startsWith('--only='))
  .map((arg) => arg.slice('--only='.length))
  .flatMap((value) => value.split(','))
  .map((value) => value.trim())
  .filter(Boolean);
const skipExisting = !args.has('--no-skip-existing');
const skipVersionSync = args.has('--no-version-sync');

const tag = process.env.NPM_TAG || undefined;
const token =
  process.env.NPM_TOKEN ||
  process.env.NODE_AUTH_TOKEN ||
  process.env.npm_config_token ||
  undefined;
const authFromMaven =
  process.env.NPM_AUTH_FROM_MAVEN === 'true' ||
  process.env.NPM_AUTH_FROM_MAVEN === '1';
const mavenServerId = process.env.MAVEN_SERVER_ID || 'dist-repo';
const publishUserConfig = resolve(frontendRoot, '.npmrc.publish.tmp');
const publishLockPath = resolve(frontendRoot, '.frontend-package-publish.lock');
const packageTarballDir = resolve(outputDir, '.publish-tarballs');

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
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

function readProjectRegistry() {
  const npmrcPath = resolve(frontendRoot, '.npmrc');

  if (!existsSync(npmrcPath)) {
    return undefined;
  }

  const registryLine = readFileSync(npmrcPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith('registry='));

  return registryLine?.slice('registry='.length) || undefined;
}

const registry =
  process.env.NPM_REGISTRY ||
  process.env.NPM_CONFIG_REGISTRY ||
  process.env.npm_config_registry ||
  readProjectRegistry();

function decodeXmlText(value = '') {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function readMavenServerAuth(serverId) {
  const settingsPath = resolve(process.env.HOME || '', '.m2/settings.xml');

  if (!existsSync(settingsPath)) {
    throw new Error(`未找到 Maven settings 文件：${settingsPath}`);
  }

  const settingsXml = readFileSync(settingsPath, 'utf8').replaceAll(
    /<!--[\s\S]*?-->/g,
    '',
  );
  const server = (settingsXml.match(/<server>[\s\S]*?<\/server>/g) || []).find(
    (candidate) => candidate.includes(`<id>${serverId}</id>`),
  );

  if (!server) {
    throw new Error(`未找到 Maven server：${serverId}`);
  }

  const username = decodeXmlText(
    server.match(/<username>([\s\S]*?)<\/username>/)?.[1]?.trim(),
  );
  const password = decodeXmlText(
    server.match(/<password>([\s\S]*?)<\/password>/)?.[1]?.trim(),
  );

  if (!username || !password) {
    throw new Error(`Maven server ${serverId} 缺少 username/password`);
  }

  return {
    auth: Buffer.from(`${username}:${password}`).toString('base64'),
  };
}

function getRegistryAuthLine(registryUrl) {
  const url = new URL(registryUrl);
  const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  return `//${url.host}${path}:_authToken`;
}

function createPublishNpmrc() {
  if (!registry || (!token && !authFromMaven)) {
    return undefined;
  }

  const lines = [`registry=${registry}`];

  if (token) {
    lines.push(`${getRegistryAuthLine(registry)}=${token}`);
  } else if (authFromMaven) {
    const registryUrl = new URL(registry);
    const path = registryUrl.pathname.endsWith('/')
      ? registryUrl.pathname
      : `${registryUrl.pathname}/`;
    const { auth } = readMavenServerAuth(mavenServerId);

    lines.push(
      `//${registryUrl.host}${path}:_auth=${auth}`,
      'auth-type=legacy',
    );
  }

  lines.push('always-auth=true', '');

  writeFileSync(publishUserConfig, lines.join('\n'), { mode: 0o600 });

  return publishUserConfig;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd || frontendRoot,
    env: {
      ...process.env,
      ...options.env,
    },
    stdio: options.stdio || 'inherit',
  });

  if (result.status !== 0) {
    const error = new Error(
      `${command} ${commandArgs.join(' ')} 执行失败，退出码 ${
        result.status || 1
      }`,
    );
    error.exitCode = result.status || 1;
    error.output = result.stdout?.toString() || result.stderr?.toString() || '';
    throw error;
  }

  return result;
}

function runCapture(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd || frontendRoot,
    env: {
      ...process.env,
      ...options.env,
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const error = new Error(
      `${command} ${commandArgs.join(' ')} 执行失败，退出码 ${
        result.status || 1
      }`,
    );
    error.exitCode = result.status || 1;
    error.output = result.stdout || result.stderr || '';
    throw error;
  }

  return result.stdout.trim();
}

function getAllPackages() {
  const packages = findPackageJsonFiles(packagesRoot)
    .map((packageJsonPath) => {
      const packageDir = dirname(packageJsonPath);
      const packageJson = readJson(packageJsonPath);

      return {
        dir: packageDir,
        name: packageJson.name,
        packageJson,
        packageJsonPath,
        path: relative(frontendRoot, packageDir),
        private: packageJson.private === true,
        version: packageJson.version,
      };
    })
    .filter((packageInfo) => packageInfo.name && packageInfo.version)
    .filter((packageInfo) => !packageInfo.private);

  if (onlyPackages.length === 0) {
    return sortPackages(packages);
  }

  const onlyPackageSet = new Set(onlyPackages);
  const selectedPackages = packages.filter((packageInfo) =>
    onlyPackageSet.has(packageInfo.name),
  );
  const foundNames = new Set(
    selectedPackages.map((packageInfo) => packageInfo.name),
  );
  const missingNames = onlyPackages.filter((name) => !foundNames.has(name));

  if (missingNames.length > 0) {
    throw new Error(`未知包：${missingNames.join(', ')}`);
  }

  return sortPackages(selectedPackages);
}

function sortPackages(packages) {
  const packageByName = new Map(
    packages.map((packageInfo) => [packageInfo.name, packageInfo]),
  );
  const selectedNames = new Set(packageByName.keys());
  const visited = new Set();
  const visiting = new Set();
  const result = [];

  function visit(packageInfo) {
    if (visited.has(packageInfo.name)) {
      return;
    }

    if (visiting.has(packageInfo.name)) {
      throw new Error(`workspace 依赖存在循环：${packageInfo.name}`);
    }

    visiting.add(packageInfo.name);

    const dependencies = {
      ...packageInfo.packageJson.dependencies,
      ...packageInfo.packageJson.peerDependencies,
      ...packageInfo.packageJson.optionalDependencies,
    };

    for (const dependencyName of Object.keys(dependencies)) {
      if (selectedNames.has(dependencyName)) {
        visit(packageByName.get(dependencyName));
      }
    }

    visiting.delete(packageInfo.name);
    visited.add(packageInfo.name);
    result.push(packageInfo);
  }

  for (const packageInfo of packages) {
    visit(packageInfo);
  }

  return result;
}

function isLevinAdminPublishPackage(packageName) {
  return (
    packageName === '@levin/admin-framework' ||
    /^@levin\/.+-admin$/.test(packageName)
  );
}

function isSourcePublicExport(exportPath, exportValue, conditionName = '') {
  if (exportPath === './src' || exportPath.startsWith('./src/')) {
    return true;
  }

  if (conditionName === 'development') {
    return false;
  }

  if (typeof exportValue === 'string') {
    return exportValue === './src' || exportValue.startsWith('./src/');
  }

  if (exportValue && typeof exportValue === 'object') {
    return Object.entries(exportValue).some(([key, value]) =>
      isSourcePublicExport(exportPath, value, key),
    );
  }

  return false;
}

function validatePackagePublishRules(packageInfo) {
  if (!isLevinAdminPublishPackage(packageInfo.name)) {
    return;
  }

  const publicSourceExports = Object.entries(
    packageInfo.packageJson.exports || {},
  )
    .filter(([exportPath, exportValue]) =>
      isSourcePublicExport(exportPath, exportValue),
    )
    .map(([exportPath]) => exportPath);

  if (publicSourceExports.length > 0) {
    throw new Error(
      `${packageInfo.name} 不能公开 src 导出：${publicSourceExports.join(
        ', ',
      )}。Levin 后台模块发布包的正式默认入口必须指向 dist；src 只能随包作为源码查看资料，或通过 exports.development 用于本地源码联调。`,
    );
  }
}

function isInternalPackage(packageName) {
  return /^@(levin|vben|vben-core)\//.test(packageName);
}

function getPublishedLatestVersion(packageName, publishEnv) {
  if (!registry) {
    return undefined;
  }

  const viewArgs = ['view', packageName, 'version', '--json'];
  viewArgs.push('--registry', registry);

  try {
    const output = runCapture('npm', viewArgs, {
      env: publishEnv,
    });

    return JSON.parse(output);
  } catch {
    return undefined;
  }
}

function validateInternalPeerVersions(packageInfo, selectedPackageVersionByName, publishEnv) {
  const peerDependencies = packageInfo.packageJson.peerDependencies || {};
  const mismatches = [];

  for (const [dependencyName, declaredVersion] of Object.entries(peerDependencies)) {
    if (!isInternalPackage(dependencyName)) {
      continue;
    }

    const expectedVersion =
      selectedPackageVersionByName.get(dependencyName) ||
      getPublishedLatestVersion(dependencyName, publishEnv);

    if (!expectedVersion) {
      continue;
    }

    if (declaredVersion !== expectedVersion) {
      mismatches.push(
        `${dependencyName}: ${declaredVersion} -> ${expectedVersion}`,
      );
    }
  }

  if (mismatches.length > 0) {
    throw new Error(
      `${packageInfo.name} 的内部 peerDependencies 未精确跟随当前内部发布版本：\n${mismatches
        .map((item) => `- ${item}`)
        .join(
          '\n',
        )}\n请先更新 package-versions.json 并运行 pnpm run sync:package-versions。`,
    );
  }
}

function packageVersionExists(packageInfo, publishEnv) {
  if (!registry || !skipExisting) {
    return false;
  }

  const viewArgs = [
    'view',
    `${packageInfo.name}@${packageInfo.version}`,
    'version',
  ];

  if (registry) {
    viewArgs.push('--registry', registry);
  }

  const result = spawnSync('npm', viewArgs, {
    cwd: frontendRoot,
    env: {
      ...process.env,
      ...publishEnv,
    },
    stdio: 'ignore',
  });

  return result.status === 0;
}

function buildPackage(packageInfo) {
  if (!packageInfo.packageJson.scripts?.build) {
    return;
  }

  run('pnpm', ['--filter', packageInfo.name, 'build']);
}

function publishPackage(tarball, publishEnv) {
  const publishArgs = ['publish', tarball, '--ignore-scripts'];

  if (registry) {
    publishArgs.push('--registry', registry);
  }

  if (tag) {
    publishArgs.push('--tag', tag);
  }

  run('npm', publishArgs, {
    env: publishEnv,
  });
}

if (!skipVersionSync) {
  run('node', ['./scripts/sync-package-versions.mjs']);
}

const selectedPackages = getAllPackages();

if (mode === 'list') {
  for (const packageInfo of selectedPackages) {
    console.log(
      `${packageInfo.name}@${packageInfo.version}\t${packageInfo.path}`,
    );
  }
  process.exit(0);
}

if (selectedPackages.length === 0) {
  console.log('没有选中任何包。');
  process.exit(0);
}

const userConfig = createPublishNpmrc();
const publishEnv = userConfig ? { NPM_CONFIG_USERCONFIG: userConfig } : {};

if (mode === 'publish') {
  acquirePublishLock(publishLockPath);
}

try {
  const selectedPackageVersionByName = new Map(
    selectedPackages.map((packageInfo) => [
      packageInfo.name,
      packageInfo.version,
    ]),
  );

  for (const packageInfo of selectedPackages) {
    validatePackagePublishRules(packageInfo);
    validateInternalPeerVersions(
      packageInfo,
      selectedPackageVersionByName,
      publishEnv,
    );
  }

  const routeAssetsByPackage = new Map();
  for (const packageInfo of selectedPackages) {
    buildPackage(packageInfo);
    routeAssetsByPackage.set(packageInfo.name, verifyBuiltRouteAssets(packageInfo));
  }

  if (mode === 'pack') {
    mkdirSync(outputDir, { recursive: true });

    for (const packageInfo of selectedPackages) {
      const tarball = packPackage(packageInfo, outputDir);
      verifyTarballRouteAssets(
        packageInfo,
        tarball,
        routeAssetsByPackage.get(packageInfo.name),
        '本地 tarball',
      );
    }

    console.log(`已打包 ${selectedPackages.length} 个包到 ${outputDir}`);
  } else {
    rmSync(packageTarballDir, { recursive: true, force: true });
    mkdirSync(packageTarballDir, { recursive: true });

    for (const packageInfo of selectedPackages) {
      const routeAssets = routeAssetsByPackage.get(packageInfo.name);
      const packageOutputDir = resolve(packageTarballDir, packageInfo.name.replaceAll('/', '__'));

      if (packageVersionExists(packageInfo, publishEnv)) {
        const remoteTarball = packPackage(
          packageInfo,
          resolve(packageOutputDir, 'remote'),
          `${packageInfo.name}@${packageInfo.version}`,
          publishEnv,
          frontendRoot,
        );
        verifyTarballRouteAssets(packageInfo, remoteTarball, routeAssets, '私服 tarball');
        console.log(
          `跳过 ${packageInfo.name}@${packageInfo.version}：私服中已存在该版本。`,
        );
        continue;
      }

      const tarball = packPackage(packageInfo, packageOutputDir);
      verifyTarballRouteAssets(packageInfo, tarball, routeAssets, '本地 tarball');
      publishPackage(tarball, publishEnv);

      const remoteTarball = packPackage(
        packageInfo,
        resolve(packageOutputDir, 'remote'),
        `${packageInfo.name}@${packageInfo.version}`,
        publishEnv,
        frontendRoot,
      );
      verifyTarballRouteAssets(packageInfo, remoteTarball, routeAssets, '私服 tarball');
    }
  }
} catch (error) {
  process.exitCode = error.exitCode || 1;
  console.error(error.message);
} finally {
  if (userConfig) {
    rmSync(userConfig, { force: true });
  }
  if (mode === 'publish') {
    releasePublishLock(publishLockPath);
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
