import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  acquirePublishLock,
  packPackage,
  packWorkspacePackage,
  releasePublishLock,
  verifyTarballDependencyProtocols,
  verifyBuiltRouteAssets,
  verifyTarballRouteAssets,
  verifyTarballStandaloneInstall,
} from './publish-artifact-gate.mjs';
import { validateInternalPeerVersions } from './internal-peer-dependency-guard.mjs';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(frontendRoot, 'npm-packages');
const packages = [
  {
    name: '@levin/admin-framework',
    path: 'packages/business/admin-framework',
  },
  {
    name: '@levin/oak-base-admin',
    path: 'packages/business/oak-base-admin',
  },
];
const args = new Set(process.argv.slice(2));
const onlyPackage = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--only='))
  ?.slice('--only='.length);
let selectedPackages = (
  onlyPackage
    ? packages.filter((packageInfo) => packageInfo.name === onlyPackage)
    : packages
).map((packageInfo) => ({
  ...packageInfo,
  dir: resolve(frontendRoot, packageInfo.path),
}));

if (onlyPackage && selectedPackages.length === 0) {
  throw new Error(`Unknown admin module package: ${onlyPackage}`);
}

const mode = args.has('--publish') ? 'publish' : 'pack';
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

function getRegistryAuthLine(registryUrl) {
  const url = new URL(registryUrl);
  const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  return `//${url.host}${path}:_authToken`;
}

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
    throw new Error(`Maven settings file not found: ${settingsPath}`);
  }

  const settingsXml = readFileSync(settingsPath, 'utf8').replace(
    /<!--[\s\S]*?-->/g,
    '',
  );
  const server = settingsXml.match(
    new RegExp(`<server>[\\s\\S]*?<id>${serverId}</id>[\\s\\S]*?</server>`),
  )?.[0];

  if (!server) {
    throw new Error(`Maven server not found: ${serverId}`);
  }

  const username = decodeXmlText(
    server.match(/<username>([\s\S]*?)<\/username>/)?.[1]?.trim(),
  );
  const password = decodeXmlText(
    server.match(/<password>([\s\S]*?)<\/password>/)?.[1]?.trim(),
  );

  if (!username || !password) {
    throw new Error(`Maven server ${serverId} is missing username/password`);
  }

  return {
    auth: Buffer.from(`${username}:${password}`).toString('base64'),
    username,
  };
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

    lines.push(`//${registryUrl.host}${path}:_auth=${auth}`);
    lines.push('auth-type=legacy');
  }

  lines.push('always-auth=true');
  lines.push('');

  writeFileSync(publishUserConfig, lines.join('\n'), { mode: 0o600 });

  return publishUserConfig;
}

function run(command, commandArgs, extraEnv = {}, cwd = frontendRoot) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    const error = new Error(
      `${command} ${commandArgs.join(' ')} failed with exit code ${
        result.status || 1
      }`,
    );
    error.exitCode = result.status || 1;
    throw error;
  }
}

run('node', ['./scripts/sync-package-versions.mjs']);
selectedPackages = (
  onlyPackage
    ? packages.filter((packageInfo) => packageInfo.name === onlyPackage)
    : packages
).map((packageInfo) => ({
  ...packageInfo,
  dir: resolve(frontendRoot, packageInfo.path),
}));

const versionConfig = JSON.parse(
  readFileSync(resolve(frontendRoot, 'package-versions.json'), 'utf8'),
);
const selectedPackageVersionByName = new Map(
  selectedPackages.map((packageInfo) => {
    const packageJson = JSON.parse(
      readFileSync(resolve(packageInfo.dir, 'package.json'), 'utf8'),
    );
    return [packageInfo.name, packageJson.version];
  }),
);

for (const packageInfo of selectedPackages) {
  const packageJson = JSON.parse(
    readFileSync(resolve(packageInfo.dir, 'package.json'), 'utf8'),
  );
  validateInternalPeerVersions(
    { ...packageInfo, packageJson },
    selectedPackageVersionByName,
    versionConfig,
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
  const packageJsonPath = resolve(
    frontendRoot,
    packageInfo.path,
    'package.json',
  );
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const publicSourceExports = Object.entries(packageJson.exports || {})
    .filter(([exportPath, exportValue]) =>
      isSourcePublicExport(exportPath, exportValue),
    )
    .map(([exportPath]) => exportPath);

  if (publicSourceExports.length > 0) {
    throw new Error(
      `${packageInfo.name} 不能公开 src 导出：${publicSourceExports.join(
        ', ',
      )}。Levin 后台模块发布包的正式入口必须指向 dist，src 只能随包作为源码查看和调试资料。`,
    );
  }
}

for (const packageInfo of selectedPackages) {
  validatePackagePublishRules(packageInfo);
}

if (mode === 'publish') {
  acquirePublishLock(publishLockPath);
}

try {
  const routeAssetsByPackage = new Map();
  for (const packageInfo of selectedPackages) {
    run('pnpm', ['--filter', packageInfo.name, 'build']);
    routeAssetsByPackage.set(
      packageInfo.name,
      verifyBuiltRouteAssets(packageInfo),
    );
  }

  if (mode === 'pack') {
    mkdirSync(outputDir, { recursive: true });

    for (const packageInfo of selectedPackages) {
      const tarball = packWorkspacePackage(packageInfo, outputDir);
      verifyTarballRouteAssets(
        packageInfo,
        tarball,
        routeAssetsByPackage.get(packageInfo.name),
        '本地 tarball',
      );
      verifyTarballDependencyProtocols(packageInfo, tarball, '本地 tarball');
    }

    console.log(`Packed admin modules to ${outputDir}`);
  } else {
    const userConfig = createPublishNpmrc();
    const publishEnv = userConfig ? { NPM_CONFIG_USERCONFIG: userConfig } : {};
    const remotePackEnv = registry
      ? {
          ...publishEnv,
          NPM_CONFIG_FALLBACK_REGISTRY: fallbackRegistry,
          NPM_CONFIG_REGISTRY: registry,
        }
      : publishEnv;

    try {
      rmSync(packageTarballDir, { recursive: true, force: true });
      mkdirSync(packageTarballDir, { recursive: true });

      for (const packageInfo of selectedPackages) {
        const json = JSON.parse(
          readFileSync(resolve(packageInfo.dir, 'package.json'), 'utf8'),
        );
        const packageOutputDir = resolve(
          packageTarballDir,
          json.name.replaceAll('/', '__'),
        );
        const tarball = packWorkspacePackage(packageInfo, packageOutputDir);
        const routeAssets = routeAssetsByPackage.get(packageInfo.name);

        verifyTarballRouteAssets(
          packageInfo,
          tarball,
          routeAssets,
          '本地 tarball',
        );
        verifyTarballDependencyProtocols(packageInfo, tarball, '本地 tarball');
        verifyTarballStandaloneInstall(packageInfo, tarball, remotePackEnv);

        const publishArgs = ['publish', tarball, '--ignore-scripts'];

        if (registry) {
          publishArgs.push('--registry', registry);
        }

        if (tag) {
          publishArgs.push('--tag', tag);
        }

        if (authFromMaven) {
          publishArgs.push('--auth-type=legacy');
        }

        run('npm', publishArgs, publishEnv);

        const remoteTarball = packPackage(
          packageInfo,
          resolve(packageOutputDir, 'remote'),
          `${json.name}@${json.version}`,
          remotePackEnv,
          frontendRoot,
        );
        verifyTarballRouteAssets(
          packageInfo,
          remoteTarball,
          routeAssets,
          '私服 tarball',
        );
        verifyTarballDependencyProtocols(
          packageInfo,
          remoteTarball,
          '私服 tarball',
        );
      }
    } finally {
      if (userConfig) {
        rmSync(userConfig, { force: true });
      }
    }
  }
} finally {
  if (mode === 'publish') {
    releasePublishLock(publishLockPath);
  }
}
