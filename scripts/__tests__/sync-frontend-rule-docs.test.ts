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
  it('includes design, rules, migrations and images while excluding execution and secret files', () => {
    const { root, adminRoot } = fixture();
    const paths = collectReferenceDocuments(root, adminRoot).map(
      ([path]: [string, string]) => path,
    );
    expect(paths).toContain('docs/images/diagram.svg');
    expect(paths).toContain('docs/migrations/20260908-change.sql');
    expect(paths).toContain('openspec/config.yaml');
    expect(paths).toContain('frontend/admin/AGENTS.md');
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
    expect(paths).toContain('docs/project-reference/manifest.json');
    expect(paths).toContain('docs/MODULE-DEVELOPMENT-STANDARD.md');
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
});
