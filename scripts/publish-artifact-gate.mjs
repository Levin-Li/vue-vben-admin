import { execFileSync, spawnSync } from 'node:child_process';
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

export function getDynamicRouteVueAssets(packageInfo) {
  const sourceRoot = resolve(packageInfo.dir, 'src');
  const dynamicImportPattern = /import\(\s*['"](\.\/views\/[^'"]+\.vue)['"]\s*\)/g;
  const assets = new Set();

  for (const sourceFile of walkFiles(sourceRoot)) {
    if (!sourceFile.endsWith('.ts') || sourceFile.includes('/__tests__/')) {
      continue;
    }

    const source = readFileSync(sourceFile, 'utf8');
    for (const match of source.matchAll(dynamicImportPattern)) {
      const asset = relative(sourceRoot, resolve(dirname(sourceFile), match[1]));
      if (asset.startsWith('../')) {
        throw new Error(`${packageInfo.name} 路由 Vue 文件越过 src 目录: ${match[1]}`);
      }
      assets.add(`dist/${asset}`);
    }
  }

  return [...assets].sort();
}

export function verifyBuiltRouteAssets(packageInfo) {
  const requiredPaths = getDynamicRouteVueAssets(packageInfo);
  const actualPaths = new Set(
    walkFiles(resolve(packageInfo.dir, 'dist')).map((file) => relative(packageInfo.dir, file)),
  );
  assertRequiredPaths(packageInfo, requiredPaths, actualPaths, '构建产物');
  return requiredPaths;
}

export function verifyTarballRouteAssets(packageInfo, tarballPath, requiredPaths, location) {
  const entries = execFileSync('tar', ['-tzf', tarballPath], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
    .map((entry) => entry.replace(/^package\//, ''));
  assertRequiredPaths(packageInfo, requiredPaths, new Set(entries), location);
}

export function packPackage(packageInfo, destination, packageSpec, extraEnv = {}, cwd) {
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
    throw new Error(`npm ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }

  return resolve(destination, JSON.parse(result.stdout)[0].filename);
}

export function acquirePublishLock(lockPath) {
  try {
    mkdirSync(lockPath);
    writeFileSync(resolve(lockPath, 'owner.txt'), `${process.pid}\n`);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`已有前端公共包发布正在执行: ${lockPath}`);
    }
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
      throw new Error(`${packageInfo.name} ${location}缺少动态路由 Vue 文件: ${path}`);
    }
  }
}
