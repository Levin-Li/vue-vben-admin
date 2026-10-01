import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  collectReferenceDocuments,
  isReferenceDocument,
  resolveProjectRoot,
  syncPackageDocuments,
} from '../sync-frontend-rule-docs.mjs';

const directories: string[] = [];
afterEach(() =>
  directories
    .splice(0)
    .forEach((path) => rmSync(path, { force: true, recursive: true })),
);
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'release-docs-'));
  directories.push(root);
  const adminRoot = join(root, 'frontend/admin');
  const packageRoot = join(adminRoot, 'packages/example');
  function put(path: string, value: string) {
    const target = join(root, path);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, value);
  }
  put('docs/release/MODULE-DEVELOPMENT-STANDARD.md', '# Standard');
  put('docs/design.md', '# Design');
  put('docs/images/diagram.svg', '<svg/>');
  put('docs/migrations/20260908-change.sql', 'select 1;');
  put('docs/release/20260908-results.md', 'run output');
  put('openspec/changes/demo/design.md', '# Proposal');
  put('openspec/changes/demo/business-binding-design.md', '# Binding design');
  put('openspec/changes/demo/definition-json-schema.md', '# Definition schema');
  put('docs/平台设计安全审计.md', 'internal audit');
  put('frontend/admin/docs/project-reference/docs/旧设计.md', 'generated copy');
  put('openspec/changes/demo/verification.md', 'run output');
  put('openspec/config.yaml', 'schema: spec-driven');
  put('frontend/admin/AGENTS.md', '# Rules');
  put('frontend/admin/docs/design.md', '# Frontend');
  put(
    'frontend/admin/packages/example/package.json',
    '{"name":"@example/test"}',
  );
  return { root, adminRoot, packageRoot };
}
describe('published reference documents', () => {
  it('嵌套工程使用默认后端根目录，独立 worktree 使用显式根目录', () => {
    expect(resolveProjectRoot('/tmp/project/frontend/admin')).toBe('/tmp/project');
    expect(resolveProjectRoot('/tmp/front-only', '/tmp/root-only')).toBe('/tmp/root-only');
  });
  it('仅交付允许类别并排除迁移、执行材料及生成副本', () => {
    const { root, adminRoot } = fixture();
    const paths = collectReferenceDocuments(root, adminRoot).map(
      ([path]: [string, string]) => path,
    );
    expect(paths).toContain('docs/design.md');
    expect(paths).toContain('openspec/changes/demo/business-binding-design.md');
    expect(paths).toContain('openspec/changes/demo/definition-json-schema.md');
    expect(paths).not.toContain('docs/images/diagram.svg');
    expect(paths).not.toContain('docs/migrations/20260908-change.sql');
    expect(paths).not.toContain('openspec/config.yaml');
    expect(paths).not.toContain('frontend/admin/AGENTS.md');
    expect(paths).not.toContain('docs/平台设计安全审计.md');
    expect(paths.some((path: string) => path.includes('project-reference'))).toBe(false);
    expect(paths).not.toContain('docs/release/20260908-results.md');
    expect(paths).not.toContain('openspec/changes/demo/verification.md');
    expect(isReferenceDocument('docs/credentials.yaml')).toBe(false);
    expect(isReferenceDocument('docs/.env')).toBe(false);
  });
  it('includes generated ignored references in npm tarballs', () => {
    const options = fixture();
    writeFileSync(
      join(options.packageRoot, 'package.json'),
      JSON.stringify({
        name: '@example/test',
        version: '1.0.0',
        files: ['docs', 'README.md', 'AGENTS.md'],
      }),
    );
    syncPackageDocuments(options.packageRoot, options);
    const packed = JSON.parse(
      execFileSync('npm', ['pack', '--ignore-scripts', '--dry-run', '--json'], {
        cwd: options.packageRoot,
        encoding: 'utf8',
      }),
    );
    const paths = packed[0].files.map(({ path }: { path: string }) => path);
    expect(paths).toContain('docs/project-reference/docs/design.md');
    expect(paths).toContain('docs/project-reference/openspec/changes/demo/business-binding-design.md');
    expect(paths).toContain('docs/project-reference/openspec/changes/demo/definition-json-schema.md');
    expect(paths).toContain('docs/project-reference/manifest.json');
    expect(paths).toContain('docs/MODULE-DEVELOPMENT-STANDARD.md');
    expect(paths.some((path: string) => path.includes('/migrations/') || path.includes('安全审计'))).toBe(false);
  });
  it('generates reproducible hashes and detects stale source documents', () => {
    const options = fixture();
    const inventory = syncPackageDocuments(options.packageRoot, options);
    expect(
      inventory.find(({ path }: { path: string }) => path === 'docs/design.md')
        .sha256,
    ).toMatch(/^[a-f0-9]{64}$/);
    expect(() =>
      syncPackageDocuments(options.packageRoot, {
        ...options,
        checkOnly: true,
      }),
    ).not.toThrow();
    expect(
      readFileSync(
        join(options.packageRoot, 'docs/project-reference/.npmignore'),
        'utf8',
      ),
    ).toBe('');
    expect(
      readFileSync(join(options.packageRoot, 'README.md'), 'utf8'),
    ).toContain('docs/project-reference/INDEX.md');
    writeFileSync(join(options.root, 'docs/design.md'), 'Changed');
    expect(() =>
      syncPackageDocuments(options.packageRoot, {
        ...options,
        checkOnly: true,
      }),
    ).toThrow('发布文档未同步');
  });
  it.each([
    ['@levin/bpm-designer', '工作流设计器使用指南.md'],
    ['@levin/bpm-runtime-ui', '工作流执行界面使用指南.md'],
  ])('同步后保留 %s 的直接使用指南入口', (name, guide) => {
    const options = fixture();
    writeFileSync(join(options.packageRoot, 'package.json'), JSON.stringify({ name }));
    syncPackageDocuments(options.packageRoot, options);
    expect(readFileSync(join(options.packageRoot, 'AGENTS.md'), 'utf8')).toContain(`](docs/${guide})`);
  });
  it('只读检查不会补写缺少 docs 的包声明', () => {
    const options = fixture();
    const file = join(options.packageRoot, 'package.json');
    const before = readFileSync(file, 'utf8');
    expect(() => syncPackageDocuments(options.packageRoot, { ...options, checkOnly: true })).toThrow('发布文档未同步');
    expect(readFileSync(file, 'utf8')).toBe(before);
  });
  it('公共框架包的 Agent 入口保留启动指南链接', () => {
    const options = fixture();
    writeFileSync(
      join(options.packageRoot, 'package.json'),
      JSON.stringify({ name: '@levin/admin-framework', version: '6.0.0' }),
    );
    mkdirSync(join(options.packageRoot, 'docs'), { recursive: true });
    writeFileSync(join(options.packageRoot, 'docs/admin-bootstrap.md'), '# 公共启动入口');

    syncPackageDocuments(options.packageRoot, options);

    expect(readFileSync(join(options.packageRoot, 'AGENTS.md'), 'utf8')).toContain(
      '[docs/admin-bootstrap.md](docs/admin-bootstrap.md)',
    );
  });
});
