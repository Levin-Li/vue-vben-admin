import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  packWorkspacePackage,
  verifyTarballDependencyProtocols,
  verifyTarballStandaloneInstall,
} from '../publish-artifact-gate.mjs';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function createTemporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'publish-artifact-gate-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

function createTarball(manifest: Record<string, unknown>) {
  const directory = createTemporaryDirectory();
  const packageDirectory = join(directory, 'package');
  const tarballPath = join(directory, 'package.tgz');

  mkdirSync(packageDirectory);
  writeFileSync(
    join(packageDirectory, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  execFileSync('tar', ['-czf', tarballPath, '-C', directory, 'package']);

  return tarballPath;
}

const packageInfo = {
  dir: resolve('packages/preferences'),
  name: '@vben/preferences',
};

describe('publish artifact gate', () => {
  it('rejects workspace and catalog protocols in a tarball manifest', () => {
    const tarballPath = createTarball({
      dependencies: {
        '@scope/catalog': 'catalog:',
        '@scope/workspace': 'workspace:*',
      },
      name: '@scope/test-package',
      version: '1.0.0',
    });

    expect(() =>
      verifyTarballDependencyProtocols(packageInfo, tarballPath, '本地 tarball'),
    ).toThrow('dependencies.@scope/workspace=workspace:*');
  });

  it('accepts a tarball manifest with published dependency versions', () => {
    const tarballPath = createTarball({
      dependencies: {
        '@scope/dependency': '1.2.3',
      },
      name: '@scope/test-package',
      version: '1.0.0',
    });

    expect(() =>
      verifyTarballDependencyProtocols(packageInfo, tarballPath, '本地 tarball'),
    ).not.toThrow();
  });

  it('packs workspace dependencies as published versions', () => {
    const destination = createTemporaryDirectory();
    const tarballPath = packWorkspacePackage(packageInfo, destination);

    verifyTarballDependencyProtocols(packageInfo, tarballPath, '本地 tarball');

    const manifest = JSON.parse(
      execFileSync('tar', ['-xOf', tarballPath, 'package/package.json'], {
        encoding: 'utf8',
      }),
    );
    const packageVersions = JSON.parse(
      readFileSync(resolve('package-versions.json'), 'utf8'),
    );
    expect(manifest.dependencies).toEqual({
      '@vben-core/preferences':
        packageVersions.packages['@vben-core/preferences'],
      '@vben-core/typings': packageVersions.packages['@vben-core/typings'],
    });
  });

  it('installs a tarball in a temporary standalone consumer', () => {
    const tarballPath = createTarball({
      name: '@scope/test-package',
      version: '1.0.0',
    });

    expect(() =>
      verifyTarballStandaloneInstall(
        { name: '@scope/test-package' },
        tarballPath,
      ),
    ).not.toThrow();
  }, 30_000);
});
