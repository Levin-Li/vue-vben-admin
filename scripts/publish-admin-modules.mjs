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
const selectedPackages = onlyPackage
  ? packages.filter((packageInfo) => packageInfo.name === onlyPackage)
  : packages;

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

const registry =
  process.env.NPM_REGISTRY ||
  process.env.NPM_CONFIG_REGISTRY ||
  process.env.npm_config_registry ||
  readProjectRegistry();
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

for (const packageInfo of selectedPackages) {
  run('pnpm', ['--filter', packageInfo.name, 'build']);
}

if (mode === 'pack') {
  mkdirSync(outputDir, { recursive: true });

  for (const packageInfo of selectedPackages) {
    run('pnpm', [
      '--filter',
      packageInfo.name,
      'pack',
      '--pack-destination',
      outputDir,
    ]);
  }

  console.log(`Packed admin modules to ${outputDir}`);
} else {
  const userConfig = createPublishNpmrc();
  const publishEnv = userConfig ? { NPM_CONFIG_USERCONFIG: userConfig } : {};

  try {
    for (const packageInfo of selectedPackages) {
      const publishArgs = ['publish'];

      if (registry) {
        publishArgs.push('--registry', registry);
      }

      if (tag) {
        publishArgs.push('--tag', tag);
      }

      if (authFromMaven) {
        publishArgs.push('--auth-type=legacy');
      }

      run(
        'npm',
        publishArgs,
        publishEnv,
        resolve(frontendRoot, packageInfo.path),
      );
    }
  } catch (error) {
    process.exitCode = error.exitCode || 1;
  } finally {
    if (userConfig) {
      rmSync(userConfig, { force: true });
    }
  }

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
}
