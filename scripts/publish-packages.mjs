import { Buffer } from 'node:buffer';
import { spawn, spawnSync } from 'node:child_process';
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

import { validateInternalPeerVersions } from './internal-peer-dependency-guard.mjs';
import {
  publishValidatedBatch,
  runDependencyLayers,
} from './on-demand-release-execution.mjs';
import {
  collectChangedPackages,
  expandExactConsumerClosure,
  preparePackageVersions,
  topologicalLayers,
} from './on-demand-release-plan.mjs';
import {
  acquirePublishLock,
  parsePackOutput,
  releasePublishLock,
  verifyBuiltRouteAssets,
  verifyPageMetadata,
  verifyTarballDependencyProtocols,
  verifyTarballManifest,
  verifyTarballModuleDevelopmentStandard,
  verifyTarballRouteAssets,
} from './publish-artifact-gate.mjs';
import { cleanupOldReleaseArtifacts } from './release-artifact-cleanup.mjs';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packagesRoot = resolve(frontendRoot, 'packages');
const outputDir = resolve(frontendRoot, 'npm-packages');
const rawArgs = process.argv.slice(2).filter((arg) => arg !== '--');
const args = new Set(rawArgs);
function getMode() {
  if (args.has('--list')) {
    return 'list';
  }

  if (args.has('--plan')) {
    return 'plan';
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
const skipVersionSync = args.has('--no-version-sync');
const publishConcurrency = 2;

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
const hostedRegistry = 'http://nexus.v-ma.com/repository/npm/';

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

const fallbackRegistry = readProjectRegistry();
const registry =
  process.env.NPM_REGISTRY ||
  process.env.NPM_CONFIG_REGISTRY ||
  process.env.npm_config_registry ||
  fallbackRegistry;

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

function runAsync(command, commandArgs, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd || frontendRoot,
      env: { ...process.env, ...options.env },
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (data) => {
      stdout += data;
    });
    child.stderr?.on('data', (data) => {
      stderr += data;
    });
    child.on('error', rejectRun);
    child.on('close', (code) => {
      if (code === 0) {
        resolveRun({ stdout, stderr });
      } else {
        rejectRun(
          new Error(
            `${command} ${commandArgs.join(' ')} 执行失败，退出码 ${code ?? 1}: ${stderr || stdout}`,
          ),
        );
      }
    });
  });
}

function readGitOutput(commandArgs) {
  const result = spawnSync('git', commandArgs, {
    cwd: frontendRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(
      `无法读取前端 Git 发布基线：${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trim();
}

function getPendingPackagePaths(baselineRef) {
  const committedAndPending = readGitOutput([
    'diff',
    '--name-only',
    baselineRef,
    '--',
    'packages',
  ]);
  const untracked = readGitOutput([
    'ls-files',
    '--others',
    '--exclude-standard',
    '--',
    'packages',
  ]);
  return [committedAndPending, untracked].flatMap((value) =>
    value.split(/\r?\n/).filter(Boolean),
  );
}

async function packWorkspacePackageAsync(packageInfo, destination) {
  mkdirSync(destination, { recursive: true });
  const result = await runAsync(
    'pnpm',
    ['pack', '--json', '--pack-destination', destination],
    { cwd: packageInfo.dir, capture: true },
  );
  return resolve(destination, parsePackOutput(result.stdout).filename);
}

function getAllPackages(requestedNames = onlyPackages) {
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

  if (requestedNames.length === 0) {
    return sortPackages(packages);
  }

  const onlyPackageSet = new Set(requestedNames);
  const selectedPackages = packages.filter((packageInfo) =>
    onlyPackageSet.has(packageInfo.name),
  );
  const foundNames = new Set(
    selectedPackages.map((packageInfo) => packageInfo.name),
  );
  const missingNames = requestedNames.filter((name) => !foundNames.has(name));

  if (missingNames.length > 0) {
    throw new Error(`未知包：${missingNames.join(', ')}`);
  }

  return sortPackages(selectedPackages);
}

function getPublishablePackages() {
  return getAllPackages([]);
}

function assertPublishConfiguration() {
  if (mode !== 'publish') return;
  if (
    registry !== hostedRegistry ||
    !authFromMaven ||
    mavenServerId !== 'dist-repo'
  ) {
    throw new Error(`发布必须使用 ${hostedRegistry} 和 Maven dist-repo 凭据`);
  }
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

function packageVersionStatus(packageInfo, publishEnv) {
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
    encoding: 'utf8',
  });
  if (result.status === 0) return 'present';
  if (
    /\bE404\b|404 No match found/.test(`${result.stderr}\n${result.stdout}`)
  ) {
    return 'absent';
  }
  return 'unknown';
}

async function buildPackage(packageInfo) {
  await runAsync(
    'node',
    [resolve(frontendRoot, 'scripts/sync-frontend-rule-docs.mjs')],
    {
      cwd: packageInfo.dir,
    },
  );
  if (!packageInfo.packageJson.scripts?.build) {
    return;
  }

  await runAsync('pnpm', ['--filter', packageInfo.name, 'build']);
}

async function publishPackage(tarball, publishEnv) {
  const publishArgs = ['publish', tarball, '--ignore-scripts'];

  if (registry) {
    publishArgs.push('--registry', registry);
  }

  if (tag) {
    publishArgs.push('--tag', tag);
  }

  await runAsync('npm', publishArgs, {
    env: publishEnv,
  });
}

async function main() {
  let lockAcquired = false;
  let userConfig;
  let activeBatchDir;
  try {
    // 发布锁覆盖版本准备、manifest 同步、临时认证和实际上传的整个写入窗口。
    if (mode === 'publish') {
      acquirePublishLock(publishLockPath);
      lockAcquired = true;
    }

    let selectedNames = onlyPackages;
    if (mode === 'publish' || mode === 'plan') {
      const baselineRef =
        rawArgs
          .find((arg) => arg.startsWith('--since='))
          ?.slice('--since='.length) || 'HEAD';
      const availablePackages = getPublishablePackages();
      const changedPaths = getPendingPackagePaths(baselineRef);
      const currentConfig = readJson(
        resolve(frontendRoot, 'package-versions.json'),
      );
      const baselineConfig = JSON.parse(
        readGitOutput(['show', `${baselineRef}:package-versions.json`]),
      );
      // 旧批次只记录统一版本；迁移时以基线提交中的各包声明恢复真实版本。
      if (!baselineConfig.packages) {
        baselineConfig.packages = Object.fromEntries(
          availablePackages.map(({ name, path }) => {
            const manifest = JSON.parse(
              readGitOutput(['show', `${baselineRef}:${path}/package.json`]),
            );
            return [name, manifest.version];
          }),
        );
      }
      const versionChangedNames = availablePackages
        .filter(
          ({ name }) =>
            currentConfig.packages?.[name] !==
            (baselineConfig.packages?.[name] || baselineConfig.releaseVersion),
        )
        .map(({ name }) => name);
      const seeds =
        onlyPackages.length > 0
          ? [...new Set([...onlyPackages, ...versionChangedNames])]
          : [
              ...new Set([
                ...collectChangedPackages(availablePackages, changedPaths),
                ...versionChangedNames,
              ]),
            ];
      selectedNames = expandExactConsumerClosure(availablePackages, seeds);

      if (selectedNames.length === 0) {
        console.log('没有可发布包的交付变更，本次不构建、不上传。');
        return;
      }

      // 先一次性准备独立版本；失败重试时已准备的版本保持不变。
      const nextConfig = preparePackageVersions(
        currentConfig,
        baselineConfig,
        selectedNames,
      );
      if (mode === 'plan') {
        for (const name of selectedNames) {
          console.log(
            `${name}: ${currentConfig.packages[name]} -> ${nextConfig.packages[name]}`,
          );
        }
        return;
      }
      if (JSON.stringify(nextConfig) !== JSON.stringify(currentConfig)) {
        writeFileSync(
          resolve(frontendRoot, 'package-versions.json'),
          `${JSON.stringify(nextConfig, null, 2)}\n`,
        );
      }
      console.log(`本次按需发布候选：${selectedNames.join(', ')}`);
    }

    if (!skipVersionSync) {
      run('node', ['./scripts/sync-package-versions.mjs']);
    }

    const selectedPackages = getAllPackages(selectedNames);
    const allPackages = getAllPackages([]);
    const versionConfig = readJson(
      resolve(frontendRoot, 'package-versions.json'),
    );

    if (mode === 'list') {
      for (const packageInfo of selectedPackages) {
        console.log(
          `${packageInfo.name}@${packageInfo.version}\t${packageInfo.path}`,
        );
      }
      return;
    }
    if (selectedPackages.length === 0) {
      console.log('没有选中任何包。');
      return;
    }

    assertPublishConfiguration();
    userConfig = mode === 'publish' ? createPublishNpmrc() : undefined;
    const publishEnv = userConfig ? { NPM_CONFIG_USERCONFIG: userConfig } : {};
    const packageByName = new Map(
      selectedPackages.map((item) => [item.name, item]),
    );
    const expectedVersions = new Map(
      allPackages.map((item) => [item.name, item.version]),
    );
    const selectedNamesInOrder = selectedPackages.map((item) => item.name);
    const layers = topologicalLayers(allPackages, selectedNamesInOrder);
    const tarballs = new Map();
    const batchDir =
      mode === 'publish'
        ? resolve(packageTarballDir, `batch-${Date.now()}-${process.pid}`)
        : outputDir;
    if (mode === 'publish') activeBatchDir = batchDir;

    // 上传前完成所有候选包的构建、单次打包和真实 tarball 内容校验。
    for (const packageInfo of selectedPackages) {
      validatePackagePublishRules(packageInfo);
      verifyPageMetadata(packageInfo);
      validateInternalPeerVersions(
        packageInfo,
        expectedVersions,
        versionConfig,
      );
    }
    await runDependencyLayers(
      layers,
      async (name) => {
        const packageInfo = packageByName.get(name);
        await buildPackage(packageInfo);
        const routeAssets = verifyBuiltRouteAssets(packageInfo);
        const destination =
          mode === 'publish'
            ? resolve(batchDir, name.replaceAll('/', '__'))
            : outputDir;
        const tarball = await packWorkspacePackageAsync(
          packageInfo,
          destination,
        );
        verifyTarballRouteAssets(
          packageInfo,
          tarball,
          routeAssets,
          '本地 tarball',
        );
        verifyTarballDependencyProtocols(packageInfo, tarball, '本地 tarball');
        verifyTarballModuleDevelopmentStandard(
          packageInfo,
          tarball,
          '本地 tarball',
        );
        verifyTarballManifest(packageInfo, tarball, expectedVersions);
        tarballs.set(name, tarball);
      },
      publishConcurrency,
    );

    if (mode === 'publish') {
      // 成功的 npm publish 是最终判据；仅失败时查询该包并安全重试一次。
      await publishValidatedBatch(selectedPackages, layers, tarballs, {
        publish: (packageInfo, tarball) => publishPackage(tarball, publishEnv),
        versionStatus: (packageInfo) =>
          packageVersionStatus(packageInfo, publishEnv),
        concurrency: publishConcurrency,
        log: (message) => console.log(message),
      });
      const deleted = cleanupOldReleaseArtifacts(outputDir, {
        protectedPaths: [...tarballs.values()],
      });
      console.log(
        `本批发布完成：${selectedPackages.length} 个包；清理 24 小时前本地暂存文件 ${deleted.length} 个。`,
      );
    } else {
      console.log(`已打包 ${selectedPackages.length} 个包到 ${outputDir}`);
    }
  } catch (error) {
    process.exitCode = error.exitCode || 1;
    console.error(error.message);
    if (mode === 'publish' && activeBatchDir && existsSync(activeBatchDir)) {
      writeFileSync(resolve(activeBatchDir, '.failed'), '失败批次保留\n');
    }
  } finally {
    try {
      if (lockAcquired) rmSync(publishUserConfig, { force: true });
    } finally {
      if (lockAcquired) releasePublishLock(publishLockPath);
    }
  }
}

await main();
