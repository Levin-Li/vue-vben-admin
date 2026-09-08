import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = resolve(frontendRoot, '..', '..');
const extensions = new Set([
  '.css',
  '.gif',
  '.jpeg',
  '.jpg',
  '.md',
  '.png',
  '.sql',
  '.svg',
  '.webp',
  '.yaml',
  '.yml',
]);

export function isReferenceDocument(path) {
  const segments = path.split(/[\\/]/);
  if (
    segments.some((part) =>
      /^(?:node_modules|target|dist|\.git|\.omx|\.cache|cache|logs|screenshots)$/i.test(
        part,
      ),
    )
  )
    return false;
  if (
    /verification|live-test|test-report|security-audit|frontend-registration-verification|release-inventory|pack-manifest/i.test(
      basename(path),
    )
  )
    return false;
  if (/(?:^|[\\/])(?:release|releases)[\\/]\d{8}/i.test(path)) return false;
  if (
    /(?:secrets?|credentials?|passwords?|tokens?|\.env|\.pem|\.key)(?:[.\-_]|$)/i.test(
      basename(path),
    )
  )
    return false;
  return extensions.has(extname(path).toLowerCase());
}

export function collectReferenceDocuments(root, adminRoot) {
  const result = new Map();
  function add(source, target) {
    if (isReferenceDocument(target)) result.set(target, source);
  }
  function walk(dir, prefix) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const source = resolve(dir, entry.name);
      const target = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        if (
          !/^(?:node_modules|target|dist|\.git|\.omx|\.cache|cache|logs|screenshots)$/i.test(
            entry.name,
          )
        )
          walk(source, target);
      } else if (entry.isFile()) add(source, target);
    }
  }
  for (const [base, prefix] of [
    [root, ''],
    [adminRoot, 'frontend/admin'],
  ]) {
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md'))
        add(
          resolve(base, entry.name),
          prefix ? `${prefix}/${entry.name}` : entry.name,
        );
    }
  }
  walk(resolve(root, 'docs'), 'docs');
  walk(resolve(root, 'openspec'), 'openspec');
  walk(resolve(adminRoot, 'docs'), 'frontend/admin/docs');
  return [...result].toSorted(([a], [b]) => a.localeCompare(b));
}

export function syncPackageDocuments(
  packageRoot,
  { checkOnly = false, root = projectRoot, adminRoot = frontendRoot } = {},
) {
  const manifest = JSON.parse(
    readFileSync(resolve(packageRoot, 'package.json'), 'utf8'),
  );
  const docs = resolve(packageRoot, 'docs');
  const reference = resolve(docs, 'project-reference');
  const sources = collectReferenceDocuments(root, adminRoot);
  const standard = readFileSync(
    resolve(root, 'docs/release/MODULE-DEVELOPMENT-STANDARD.md'),
  );
  function output(path, content) {
    const expected = Buffer.isBuffer(content) ? content : Buffer.from(content);
    if (checkOnly) {
      if (!existsSync(path) || !readFileSync(path).equals(expected))
        throw new Error(`发布文档未同步: ${path}`);
    } else {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, expected);
    }
  }
  if (!checkOnly) {
    rmSync(resolve(docs, 'frontend-rules'), { recursive: true, force: true });
    rmSync(reference, { recursive: true, force: true });
  }
  output(resolve(docs, 'MODULE-DEVELOPMENT-STANDARD.md'), standard);
  output(resolve(reference, '.gitignore'), '*\n');
  output(resolve(reference, '.npmignore'), '');
  output(
    resolve(docs, '.gitignore'),
    '/MODULE-DEVELOPMENT-STANDARD.md\n/project-reference/\n',
  );
  output(resolve(docs, '.npmignore'), '');
  const inventory = [];
  for (const [path, source] of sources) {
    const content = readFileSync(source);
    output(resolve(reference, path), content);
    inventory.push({
      path,
      bytes: content.length,
      sha256: createHash('sha256').update(content).digest('hex'),
    });
  }
  output(
    resolve(reference, 'manifest.json'),
    `${JSON.stringify(inventory, null, 2)}\n`,
  );
  output(
    resolve(reference, 'INDEX.md'),
    `# 发布方项目参考资料\n\n这些设计、需求和开发记录是发布方项目参考，不构成下游项目额外强制规范。下游规范见 [模块开发规范](../MODULE-DEVELOPMENT-STANDARD.md)。迁移 SQL 仅作为参考，不自动执行。\n\n完整文件及 SHA-256 清单：[manifest.json](manifest.json)。\n\n${inventory.map(({ path }) => `- [${path}](${encodeURI(path)})`).join('\n')}\n`,
  );
  output(
    resolve(packageRoot, 'AGENTS.md'),
    `# Published Package AGENTS.md\n\n<INSTRUCTIONS>\n本文件随 ${manifest.name} npm 发布包分发。使用本包进行二次开发、扩展、配置、升级或发布的子项目，必须先读取并遵循 [模块开发规范](docs/MODULE-DEVELOPMENT-STANDARD.md)。规范仅约束公开入口、兼容扩展、安全、测试和升级，不要求采用发布方代码包名、目录或业务实现。\n\n[项目设计和开发参考资料](docs/project-reference/INDEX.md) 为非规范性参考，不构成下游项目的强制要求。\n</INSTRUCTIONS>\n`,
  );
  const readmePath = resolve(packageRoot, 'README.md');
  let readme = existsSync(readmePath)
    ? readFileSync(readmePath, 'utf8')
    : `# ${manifest.name}\n`;
  if (!readme.includes('docs/project-reference/INDEX.md')) {
    readme +=
      '\n## 模块开发与设计资料\n\n使用本模块的子项目必须遵循 [模块开发规范](docs/MODULE-DEVELOPMENT-STANDARD.md)。[项目设计和开发参考资料](docs/project-reference/INDEX.md) 提供发布方的设计、需求及规则背景，不构成下游强制约束。\n';
  }
  output(readmePath, readme);
  return inventory;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const inventoryIndex = args.indexOf('--inventory');
  let roots = [process.cwd()];
  if (inventoryIndex !== -1)
    roots = JSON.parse(
      readFileSync(resolve(args[inventoryIndex + 1]), 'utf8'),
    ).map(({ path }) => resolve(frontendRoot, path));
  else if (args.includes('--all'))
    roots = [
      'packages/business/admin-framework',
      'packages/business/oak-base-admin',
    ].map((path) => resolve(frontendRoot, path));
  for (const packageRoot of roots) {
    const files = syncPackageDocuments(packageRoot, { checkOnly });
    console.log(
      `${checkOnly ? 'Checked' : 'Synced'} ${files.length} reference documents for ${relative(frontendRoot, packageRoot)}`,
    );
  }
}
