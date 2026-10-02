import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

export function getDynamicRouteVueAssets(packageInfo) {
  const sourceRoot = resolve(packageInfo.dir, 'src');
  const dynamicImportPattern =
    /import\(\s*['"](\.\/views\/[^'"]+\.vue)['"]\s*\)/g;
  const assets = new Set();

  for (const sourceFile of walkFiles(sourceRoot)) {
    if (!sourceFile.endsWith('.ts') || sourceFile.includes('/__tests__/')) {
      continue;
    }

    const source = readFileSync(sourceFile, 'utf8');
    for (const match of source.matchAll(dynamicImportPattern)) {
      const asset = relative(
        sourceRoot,
        resolve(dirname(sourceFile), match[1]),
      );
      if (asset.startsWith('../')) {
        throw new Error(
          `${packageInfo.name} 路由 Vue 文件越过 src 目录: ${match[1]}`,
        );
      }
      assets.add(`dist/${asset}`);
    }
  }

  return [...assets].toSorted();
}

export function verifyBuiltRouteAssets(packageInfo) {
  const requiredPaths = getDynamicRouteVueAssets(packageInfo);
  const actualPaths = new Set(
    walkFiles(resolve(packageInfo.dir, 'dist')).map((file) =>
      relative(packageInfo.dir, file),
    ),
  );
  assertRequiredPaths(packageInfo, requiredPaths, actualPaths, '构建产物');
  return requiredPaths;
}

export function verifyPageMetadata(packageInfo) {
  const viewsRoot = resolve(packageInfo.dir, 'src/modules');
  const indexPageFiles = walkFiles(viewsRoot).filter((file) =>
    /\/views\/[^/]+\/index\.vue$/.test(file),
  );
  const routePageFiles = getDynamicRouteVueAssets(packageInfo).map((asset) =>
    resolve(packageInfo.dir, 'src', asset.replace(/^dist\//, '')),
  );
  const pageFiles = [...new Set([...indexPageFiles, ...routePageFiles])];
  const missing = [];

  for (const pageFile of pageFiles) {
    const pageDirectory = dirname(pageFile);
    const metadataFile = resolve(pageDirectory, 'config.ts');
    const pagePath = relative(packageInfo.dir, pageFile);

    if (!existsSync(metadataFile)) {
      missing.push(`${pagePath} 缺少 config.ts`);
      continue;
    }

    const source = readFileSync(metadataFile, 'utf8');
    const pageMeta = source.match(
      /export\s+const\s+pageMeta\s*=\s*\{([\s\S]*?)\}\s+as\s+const/,
    )?.[1];
    const requiredFields = ['name', 'title', 'description'].filter(
      (field) =>
        !pageMeta ||
        !new RegExp(String.raw`\b${field}\s*:\s*['"\`]`).test(pageMeta),
    );

    if (requiredFields.length > 0) {
      missing.push(`${pagePath} 缺少 pageMeta.${requiredFields.join('、')}`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `${packageInfo.name} 页面元数据不完整：${missing.join('；')}`,
    );
  }

  return pageFiles.map((file) => relative(packageInfo.dir, file)).toSorted();
}

export function verifyTarballRouteAssets(
  packageInfo,
  tarballPath,
  requiredPaths,
  location,
) {
  const entries = execFileSync('tar', ['-tzf', tarballPath], {
    encoding: 'utf8',
  })
    .split(/\r?\n/)
    .filter(Boolean)
    .map((entry) => entry.replace(/^package\//, ''));
  assertRequiredPaths(packageInfo, requiredPaths, new Set(entries), location);
}

export function verifyTarballModuleDevelopmentStandard(
  packageInfo,
  tarballPath,
  location,
) {
  const standardPath = 'package/docs/MODULE-DEVELOPMENT-STANDARD.md';
  const readmePath = 'package/README.md';
  const entries = execFileSync('tar', ['-tzf', tarballPath], {
    encoding: 'utf8',
  });

  if (!entries.split(/\r?\n/).includes(standardPath)) {
    throw new Error(
      `${packageInfo.name} ${location}缺少模块使用与二次开发规范`,
    );
  }

  const readme = execFileSync('tar', ['-xOf', tarballPath, readmePath], {
    encoding: 'utf8',
  });

  if (!readme.includes('docs/MODULE-DEVELOPMENT-STANDARD.md')) {
    throw new Error(`${packageInfo.name} ${location}README 未引用模块使用规范`);
  }
}

export function verifyTarballProjectDocs(packageInfo, tarballPath, location) {
  const referencePath = 'docs/project-reference';
  const sourceManifest = resolve(
    packageInfo.dir,
    referencePath,
    'manifest.json',
  );
  if (!existsSync(sourceManifest)) return;
  const expected = readFileSync(sourceManifest, 'utf8');
  const directory = mkdtempSync(join(tmpdir(), 'release-docs-check-'));
  try {
    execFileSync('tar', [
      '-xf',
      tarballPath,
      '-C',
      directory,
      `package/${referencePath}`,
    ]);
    const root = resolve(directory, 'package', referencePath);
    if (readFileSync(resolve(root, 'manifest.json'), 'utf8') !== expected) {
      throw new Error(`${packageInfo.name} ${location}设计文档清单不一致`);
    }
    for (const entry of JSON.parse(expected)) {
      const file = resolve(root, entry.path);
      if (
        !file.startsWith(`${root}/`) ||
        !existsSync(file) ||
        createHash('sha256').update(readFileSync(file)).digest('hex') !==
          entry.sha256
      ) {
        throw new Error(
          `${packageInfo.name} ${location}设计或规范文档缺失或内容不一致: ${entry.path}`,
        );
      }
    }
    console.log(
      `${packageInfo.name} ${location}设计与规范校验通过：${JSON.parse(expected).length} 份文件`,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function verifyTarballDependencyProtocols(
  packageInfo,
  tarballPath,
  location,
) {
  verifyTarballProjectDocs(packageInfo, tarballPath, location);
  const manifest = JSON.parse(
    execFileSync('tar', ['-xOf', tarballPath, 'package/package.json'], {
      encoding: 'utf8',
    }),
  );
  const invalidDependencies = [];

  for (const section of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
    'devDependencies',
  ]) {
    for (const [name, version] of Object.entries(manifest[section] || {})) {
      if (isForbiddenPublishedDependencyProtocol(version)) {
        invalidDependencies.push(`${section}.${name}=${version}`);
      }
    }
  }

  if (invalidDependencies.length > 0) {
    throw new Error(
      `${packageInfo.name} ${location}包含未转换的依赖协议: ${invalidDependencies.join(', ')}`,
    );
  }
}

export function verifyTarballManifest(
  packageInfo,
  tarballPath,
  expectedVersions,
) {
  const manifest = JSON.parse(
    execFileSync('tar', ['-xOf', tarballPath, 'package/package.json'], {
      encoding: 'utf8',
    }),
  );
  const entries = new Set(
    execFileSync('tar', ['-tzf', tarballPath], { encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean)
      .map((entry) => entry.replace(/^package\//, '')),
  );

  // 实际上传的包名、版本和内部依赖必须与本批候选清单完全一致。
  if (
    manifest.name !== packageInfo.name ||
    manifest.version !== packageInfo.version
  ) {
    throw new Error(
      `${packageInfo.name} tarball 包名或版本不匹配：${manifest.name}@${manifest.version}`,
    );
  }
  for (const section of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
    'devDependencies',
  ]) {
    for (const [name, version] of Object.entries(manifest[section] || {})) {
      if (
        expectedVersions.has(name) &&
        version !== expectedVersions.get(name)
      ) {
        throw new Error(
          `${packageInfo.name} ${section}.${name} 内部依赖版本不匹配：${version} != ${expectedVersions.get(name)}`,
        );
      }
    }
  }

  // 只校验发布态入口；development 条件允许指向随包源码。
  function checkTarget(target, condition = '') {
    if (condition === 'development') return;
    if (typeof target === 'string') {
      if (!target.startsWith('./')) return;
      const path = target.slice(2);
      const wildcard = path.indexOf('*');
      const present =
        wildcard === -1
          ? entries.has(path)
          : [...entries].some(
              (entry) =>
                entry.startsWith(path.slice(0, wildcard)) &&
                entry.endsWith(path.slice(wildcard + 1)),
            );
      if (!present)
        throw new Error(`${packageInfo.name} tarball 导出文件缺失：${path}`);
      return;
    }
    if (target && typeof target === 'object') {
      for (const [key, value] of Object.entries(target))
        checkTarget(value, key);
    }
  }
  for (const field of ['main', 'module', 'types']) checkTarget(manifest[field]);
  checkTarget(manifest.publishConfig?.exports || manifest.exports);
}

export function verifyTarballStandaloneInstall(
  packageInfo,
  tarballPath,
  extraEnv = {},
  batchTarballs = new Map(),
) {
  const consumerDir = mkdtempSync(
    join(tmpdir(), 'levin-package-install-smoke-'),
  );

  try {
    writeFileSync(
      resolve(consumerDir, 'package.json'),
      `${JSON.stringify(
        {
          dependencies: {
            ...getBatchTarballDependencies(batchTarballs),
            [packageInfo.name]: `file:${tarballPath}`,
          },
          name: 'levin-package-install-smoke',
          pnpm: getBatchTarballPnpmConfig(batchTarballs),
          private: true,
          version: '0.0.0',
        },
        null,
        2,
      )}\n`,
    );
    writeStandaloneConsumerNpmrc(consumerDir, extraEnv);

    const installEnv = { ...process.env, ...extraEnv };
    delete installEnv.NPM_CONFIG_FALLBACK_REGISTRY;
    delete installEnv.NPM_CONFIG_REGISTRY;
    delete installEnv.NPM_CONFIG_USERCONFIG;

    const result = spawnSync(
      'pnpm',
      ['install', '--ignore-scripts', '--no-lockfile'],
      {
        cwd: consumerDir,
        encoding: 'utf8',
        env: installEnv,
      },
    );

    if (result.status !== 0) {
      throw new Error(
        `${packageInfo.name} 独立安装烟测失败: ${result.stderr || result.stdout}`,
      );
    }
  } finally {
    rmSync(consumerDir, { recursive: true, force: true });
  }
}

/**
 * Builds a package entry from a fresh consumer instead of this workspace.
 *
 * This is deliberately stronger than the install smoke test: peer dependencies
 * are resolved by the configured registry, so an unpublished upstream export
 * cannot be hidden by a workspace link or a stale local node_modules tree.
 */
export function verifyTarballStandaloneViteBuild(
  packageInfo,
  tarballPath,
  entrypoint,
  extraEnv = {},
  batchTarballs = new Map(),
) {
  const absoluteTarballPath = resolve(tarballPath);
  const manifest = JSON.parse(
    execFileSync('tar', ['-xOf', absoluteTarballPath, 'package/package.json'], {
      encoding: 'utf8',
    }),
  );
  const consumerDir = mkdtempSync(join(tmpdir(), 'levin-package-build-smoke-'));

  try {
    writeFileSync(
      resolve(consumerDir, 'package.json'),
      `${JSON.stringify(
        {
          dependencies: {
            ...manifest.peerDependencies,
            ...getBatchTarballDependencies(batchTarballs),
            [packageInfo.name]: `file:${absoluteTarballPath}`,
          },
          devDependencies: {
            '@vitejs/plugin-vue': '^6.0.4',
            'sass-embedded': '^1.97.3',
            typescript: '^5.9.3',
            vite: '^7.3.1',
          },
          name: 'levin-package-build-smoke',
          pnpm: getBatchTarballPnpmConfig(batchTarballs),
          private: true,
          scripts: { build: 'vite build' },
          version: '0.0.0',
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      resolve(consumerDir, 'index.html'),
      '<div id="app"></div><script type="module" src="/src/main.ts"></script>\n',
    );
    writeFileSync(
      resolve(consumerDir, 'vite.config.mjs'),
      "import vue from '@vitejs/plugin-vue';\nimport { defineConfig } from 'vite';\nexport default defineConfig({ plugins: [vue()] });\n",
    );
    mkdirSync(resolve(consumerDir, 'src'));
    writeFileSync(
      resolve(consumerDir, 'src/main.ts'),
      `import * as entry from '${entrypoint}';\ndocument.getElementById('app')!.textContent = String(entry);\n`,
    );
    writeStandaloneConsumerNpmrc(consumerDir, extraEnv);

    const installEnv = { ...process.env, ...extraEnv };
    delete installEnv.NPM_CONFIG_FALLBACK_REGISTRY;
    delete installEnv.NPM_CONFIG_REGISTRY;
    delete installEnv.NPM_CONFIG_USERCONFIG;

    const install = spawnSync(
      'pnpm',
      ['install', '--ignore-scripts', '--no-lockfile'],
      { cwd: consumerDir, encoding: 'utf8', env: installEnv },
    );
    if (install.status !== 0) {
      throw new Error(
        `${packageInfo.name} registry 消费者安装失败: ${install.stderr || install.stdout}`,
      );
    }

    const build = spawnSync('pnpm', ['run', 'build'], {
      cwd: consumerDir,
      encoding: 'utf8',
      env: installEnv,
    });
    if (build.status !== 0) {
      throw new Error(
        `${packageInfo.name} registry 消费者生产构建失败（依赖必须以私服真实制品为准）: ${build.stderr || build.stdout}`,
      );
    }
  } finally {
    rmSync(consumerDir, { recursive: true, force: true });
  }
}

const standalonePublicEntries = new Map([
  [
    '@levin/admin-framework',
    [
      '@levin/admin-framework',
      '@levin/admin-framework/framework-commons/app/layouts/basic.vue',
    ],
  ],
  ['@levin/bpm-designer', ['@levin/bpm-designer']],
  ['@levin/bpm-runtime-ui', ['@levin/bpm-runtime-ui']],
  ['@levin/oak-base-admin', ['@levin/oak-base-admin']],
]);

/** 所有本批 tarball 就绪后，先验证 BPM 与宿主包，再允许一次上传。 */
export async function publishAfterStandaloneConsumerGate(
  selectedPackages,
  batchTarballs,
  consumerEnv,
  publishBatch,
  verifiers,
) {
  const install = verifiers?.install || verifyTarballStandaloneInstall;
  const build = verifiers?.build || verifyTarballStandaloneViteBuild;

  for (const packageInfo of selectedPackages) {
    const entries = standalonePublicEntries.get(packageInfo.name);
    if (!entries) continue;

    const tarball = batchTarballs.get(packageInfo.name);
    if (!tarball) {
      throw new Error(`${packageInfo.name} 缺少本批 tarball，禁止上传`);
    }

    install(packageInfo, tarball, consumerEnv, batchTarballs);
    for (const entry of entries) {
      build(packageInfo, tarball, entry, consumerEnv, batchTarballs);
    }
  }

  return publishBatch();
}

/**
 * 将同一发布批次的内部依赖固定为本地 tarball，避免预检意外解析私服中的旧版本。
 */
function getBatchTarballDependencies(batchTarballs) {
  return Object.fromEntries(
    [...batchTarballs.entries()].map(([name, tarballPath]) => [
      name,
      `file:${resolve(tarballPath)}`,
    ]),
  );
}

/** pnpm 的解析图也必须指向本地制品，确保间接精确依赖不会回退查询 Nexus。 */
function getBatchTarballPnpmConfig(batchTarballs) {
  const overrides = getBatchTarballDependencies(batchTarballs);
  return Object.keys(overrides).length === 0 ? undefined : { overrides };
}

/** 生命周期日志可能出现在 JSON 之前，必须解析到完整的最终结果。 */
export function parsePackOutput(output) {
  const starts = [...output.matchAll(/^[{[]/gm)].map((match) => match.index);
  for (const start of starts.toReversed()) {
    try {
      return JSON.parse(output.slice(start));
    } catch {
      // 日志中的括号不是最终打包结果，继续寻找 JSON 起点。
    }
  }
  throw new Error('打包命令未返回有效 JSON 结果');
}

export function packWorkspacePackage(packageInfo, destination) {
  mkdirSync(destination, { recursive: true });
  const result = spawnSync(
    'pnpm',
    ['pack', '--json', '--pack-destination', destination],
    {
      cwd: packageInfo.dir,
      encoding: 'utf8',
      env: process.env,
    },
  );

  if (result.status !== 0) {
    throw new Error(`pnpm pack 失败: ${result.stderr || result.stdout}`);
  }

  return resolve(destination, parsePackOutput(result.stdout).filename);
}

export function packPackage(
  packageInfo,
  destination,
  packageSpec,
  extraEnv = {},
  cwd,
) {
  mkdirSync(destination, { recursive: true });
  const args = ['pack'];
  if (packageSpec) {
    args.push(packageSpec);
  }
  args.push('--json', '--pack-destination', destination);

  const result = spawnSync('npm', args, {
    cwd: cwd || packageInfo.dir,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    throw new Error(
      `npm ${args.join(' ')} failed: ${result.stderr || result.stdout}`,
    );
  }

  return resolve(destination, parsePackOutput(result.stdout)[0].filename);
}

function isForbiddenPublishedDependencyProtocol(version) {
  return /^(?:catalog:|workspace:)/.test(String(version));
}

function writeStandaloneConsumerNpmrc(consumerDir, extraEnv) {
  const internalRegistry = String(extraEnv.NPM_CONFIG_REGISTRY || '').trim();
  const fallbackRegistry = String(
    extraEnv.NPM_CONFIG_FALLBACK_REGISTRY || '',
  ).trim();

  if (!internalRegistry || !fallbackRegistry) {
    return;
  }

  const userConfigPath = String(extraEnv.NPM_CONFIG_USERCONFIG || '').trim();
  const authLines =
    userConfigPath && existsSync(userConfigPath)
      ? readFileSync(userConfigPath, 'utf8')
          .split(/\r?\n/)
          .filter(
            (line) =>
              line.startsWith('//') ||
              line.startsWith('always-auth=') ||
              line.startsWith('auth-type='),
          )
      : [];

  writeFileSync(
    resolve(consumerDir, '.npmrc'),
    [
      `registry=${fallbackRegistry}`,
      `@levin:registry=${internalRegistry}`,
      `@vben:registry=${internalRegistry}`,
      `@vben-core:registry=${internalRegistry}`,
      ...authLines,
      '',
    ].join('\n'),
  );
}

export function acquirePublishLock(lockPath) {
  try {
    mkdirSync(lockPath);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`已有前端公共包发布正在执行: ${lockPath}`);
    }
    throw error;
  }
  try {
    writeFileSync(resolve(lockPath, 'owner.txt'), `${process.pid}\n`);
  } catch (error) {
    // 已取得目录锁后若 owner 写入失败，只清理本进程刚创建的锁。
    rmSync(lockPath, { recursive: true, force: true });
    throw error;
  }
}

export function releasePublishLock(lockPath) {
  rmSync(lockPath, { recursive: true, force: true });
}

function walkFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { recursive: true })
    .map((entry) => resolve(directory, entry))
    .filter((entry) => statSync(entry).isFile());
}

function assertRequiredPaths(packageInfo, paths, actualPaths, location) {
  for (const path of paths) {
    if (!actualPaths.has(path)) {
      throw new Error(
        `${packageInfo.name} ${location}缺少动态路由 Vue 文件: ${path}`,
      );
    }
  }
}
