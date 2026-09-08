import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  packWorkspacePackage,
  verifyPageMetadata,
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
  it('rejects pages without complete page metadata', () => {
    const directory = createTemporaryDirectory();
    const pageDirectory = join(directory, 'src/modules/example/views/demo');
    mkdirSync(pageDirectory, { recursive: true });
    writeFileSync(join(pageDirectory, 'index.vue'), '<template />\n');
    writeFileSync(
      join(pageDirectory, 'config.ts'),
      "export const pageMeta = { name: 'Demo', title: '示例页面' } as const;\n",
    );

    expect(() =>
      verifyPageMetadata({ dir: directory, name: '@scope/example' }),
    ).toThrow('缺少 pageMeta.description');
  });

  it('accepts complete page metadata', () => {
    const directory = createTemporaryDirectory();
    const pageDirectory = join(directory, 'src/modules/example/views/demo');
    mkdirSync(pageDirectory, { recursive: true });
    writeFileSync(join(pageDirectory, 'index.vue'), '<template />\n');
    writeFileSync(
      join(pageDirectory, 'config.ts'),
      "export const pageMeta = { name: 'Demo', title: '示例页面', description: '展示示例功能。' } as const;\n",
    );

    expect(() =>
      verifyPageMetadata({ dir: directory, name: '@scope/example' }),
    ).not.toThrow();
  });

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
      verifyTarballDependencyProtocols(
        { name: '@scope/test-package', dir: createTemporaryDirectory() },
        tarballPath,
        '本地 tarball',
      ),
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
      verifyTarballDependencyProtocols(
        { name: '@scope/test-package', dir: createTemporaryDirectory() },
        tarballPath,
        '本地 tarball',
      ),
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

describe('打包命令生命周期日志', () => {
  it('保留前置日志后的对象和数组结果', async () => {
    const { parsePackOutput } = await import('../publish-artifact-gate.mjs');
    expect(
      parsePackOutput(
        '> prepack\n元数据已生成\n{\n"filename":"example.tgz"\n}\n',
      ),
    ).toEqual({ filename: 'example.tgz' });
    expect(
      parsePackOutput('> prepack\n[{"filename":"example.tgz"}]\n'),
    ).toEqual([{ filename: 'example.tgz' }]);
    expect(() => parsePackOutput('> prepack\n没有打包结果')).toThrow(
      '未返回有效 JSON',
    );
  });
});

it('逐文件校验发布设计资料并拒绝内容篡改', async () => {
  const { verifyTarballProjectDocs } =
    await import('../publish-artifact-gate.mjs');
  const root = createTemporaryDirectory();
  const reference = join(root, 'package/docs/project-reference');
  mkdirSync(reference, { recursive: true });
  writeFileSync(join(reference, 'design.md'), '设计正文');
  writeFileSync(
    join(reference, 'manifest.json'),
    JSON.stringify([
      {
        path: 'design.md',
        sha256: createHash('sha256').update('设计正文').digest('hex'),
      },
    ]),
  );
  const tarball = join(root, 'docs.tgz');
  execFileSync('tar', ['-czf', tarball, '-C', root, 'package']);
  const info = { name: '@scope/docs', dir: join(root, 'package') };
  expect(() => verifyTarballProjectDocs(info, tarball, '测试包')).not.toThrow();
  writeFileSync(join(reference, 'design.md'), '被修改');
  execFileSync('tar', ['-czf', tarball, '-C', root, 'package']);
  expect(() => verifyTarballProjectDocs(info, tarball, '测试包')).toThrow(
    '内容不一致',
  );
});
