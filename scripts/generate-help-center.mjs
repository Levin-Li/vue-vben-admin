import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = resolve(
  process.env.LEVIN_PROJECT_ROOT || resolve(frontendRoot, '../..'),
);
const packageRoot = resolve(frontendRoot, 'packages/business/oak-base-admin');
const catalogPath = resolve(packageRoot, 'help-center.catalog.json');
const outputDir = resolve(
  packageRoot,
  'src/modules/com_levin_oak_base/help-content',
);
const allowedAudiences = new Set(['开发者', '用户', '管理员']);
const allowedTypes = new Set(['使用手册', '使用指南', '实现说明', '开发指南']);
const forbiddenPath =
  /(?:^|\/)(?:migrations|release|project-reference|frontend-rules)(?:\/|$)|验收记录|验证输出|安全审计|测试报告|迁移|发布说明|部署|运维|任务清单|日志|截图/i;

function ensureWithinRoot(path) {
  const actual = realpathSync(path);
  if (actual !== projectRoot && !actual.startsWith(`${projectRoot}/`)) {
    throw new Error(`帮助文档越出项目目录：${path}`);
  }
  return actual;
}

function resolveSource(source) {
  if (
    typeof source !== 'string' ||
    source.includes('\\') ||
    source.startsWith('/') ||
    source.includes('..')
  ) {
    throw new Error(`帮助文档来源路径无效：${source}`);
  }
  if (
    !source.startsWith('docs/') &&
    !source.startsWith('frontend/admin/packages/business/oak-base-admin/docs/')
  ) {
    throw new Error(`帮助文档来源不在允许目录：${source}`);
  }
  if (forbiddenPath.test(source) || extname(source) !== '.md') {
    throw new Error(`帮助文档不允许进入前端包：${source}`);
  }
  const path = resolve(projectRoot, source);
  if (!existsSync(path)) throw new Error(`帮助文档不存在：${source}`);
  return ensureWithinRoot(path);
}

export function validateCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length === 0)
    throw new Error('帮助文档登记清单不能为空');
  const ids = new Set();
  const sources = new Set();
  for (const doc of catalog) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(doc.id || '') || ids.has(doc.id)) {
      throw new Error(`帮助文档 ID 无效或重复：${doc.id}`);
    }
    ids.add(doc.id);
    for (const field of ['title', 'module']) {
      if (typeof doc[field] !== 'string' || !doc[field].trim())
        throw new Error(`帮助文档 ${doc.id} 缺少 ${field}`);
    }
    if (!allowedAudiences.has(doc.audience) || !allowedTypes.has(doc.type)) {
      throw new Error(`帮助文档 ${doc.id} 的读者或类型无效`);
    }
    const source = resolveSource(doc.source);
    if (sources.has(source)) throw new Error(`帮助文档来源重复：${doc.source}`);
    sources.add(source);
    for (const page of doc.pages || []) {
      if (
        !/^\/clob\/V1\/[A-Za-z][A-Za-z0-9]*$/.test(page.path || '') ||
        !/^[a-z]+(?:-[a-z]+)*$/.test(page.view || '')
      ) {
        throw new Error(`帮助文档 ${doc.id} 的关联页面无效`);
      }
      const view = resolve(
        packageRoot,
        `src/modules/com_levin_oak_base/views/${page.view}/index.vue`,
      );
      if (!existsSync(view))
        throw new Error(`帮助文档 ${doc.id} 的关联页面不存在：${page.view}`);
    }
  }
  return new Map(catalog.map((doc) => [resolveSource(doc.source), doc.id]));
}

export function rewriteLinks(markdown, source, sourceIds) {
  return markdown.replaceAll(
    /(!?)\[([^\]]+)\]\(([^)]+)\)/g,
    (original, image, label, href) => {
      const trimmed = href.trim();
      if (/^(?:https:\/\/|mailto:|#)/i.test(trimmed)) return original;
      if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('//')) {
        return image ? `![${label}]` : label;
      }
      const [rawPath, fragment = ''] = trimmed.split('#', 2);
      if (!rawPath) return original;
      let path;
      try {
        path = resolve(dirname(source), decodeURIComponent(rawPath));
      } catch {
        throw new Error(
          `帮助文档链接编码无效：${relative(projectRoot, source)} → ${href}`,
        );
      }
      if (!existsSync(path))
        throw new Error(
          `帮助文档链接不存在：${relative(projectRoot, source)} → ${href}`,
        );
      const target = ensureWithinRoot(path);
      const id = sourceIds.get(target);
      if (id) return `[${label}](?doc=${id}${fragment ? `#${fragment}` : ''})`;
      if (image)
        throw new Error(
          `帮助文档图片未登记入包：${relative(projectRoot, target)}`,
        );
      return `${label}（资料未收录在线帮助）`;
    },
  );
}

function writeExpected(path, content, checkOnly) {
  if (checkOnly) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== content) {
      throw new Error(`帮助文档生成产物未同步：${path}`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export function generateHelpCenter({ checkOnly = false } = {}) {
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const sourceIds = validateCatalog(catalog);
  const version = JSON.parse(
    readFileSync(resolve(packageRoot, 'package.json'), 'utf8'),
  ).version;
  const manifest = catalog.map((doc) => {
    const source = resolveSource(doc.source);
    const markdown = rewriteLinks(
      readFileSync(source, 'utf8'),
      source,
      sourceIds,
    );
    writeExpected(resolve(outputDir, `${doc.id}.md`), markdown, checkOnly);
    return {
      id: doc.id,
      title: doc.title,
      module: doc.module,
      audience: doc.audience,
      type: doc.type,
      source: doc.source,
      pages: doc.pages || [],
      sha256: createHash('sha256').update(markdown).digest('hex'),
    };
  });
  writeExpected(
    resolve(outputDir, 'manifest.json'),
    `${JSON.stringify({ version, documents: manifest }, null, 2)}\n`,
    checkOnly,
  );
  const expectedFiles = new Set([
    'manifest.json',
    ...catalog.map((doc) => `${doc.id}.md`),
  ]);
  for (const file of readdirSync(outputDir)) {
    if (!expectedFiles.has(file)) {
      if (checkOnly) throw new Error(`帮助文档生成目录存在过期文件：${file}`);
      rmSync(resolve(outputDir, file), { recursive: true, force: true });
    }
  }
  return manifest;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const documents = generateHelpCenter({
    checkOnly: process.argv.includes('--check'),
  });
  console.log(
    `帮助中心已${process.argv.includes('--check') ? '校验' : '生成'} ${documents.length} 篇文档`,
  );
}
