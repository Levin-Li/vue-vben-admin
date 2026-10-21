import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  generateHelpCenter,
  rewriteLinks,
  validateCatalog,
} from './generate-help-center.mjs';

// 构建脚本测试兼容独立 Node 运行与项目 Vitest 全量门禁。
const { test } = process.env.VITEST
  ? await import('vitest')
  : await import('node:test');

const root = resolve(import.meta.dirname, '../../..');
const catalog = JSON.parse(
  readFileSync(
    resolve(
      root,
      'frontend/admin/packages/business/oak-base-admin/help-center.catalog.json',
    ),
    'utf8',
  ),
);

test('帮助文档登记拒绝重复 ID 与禁止入包来源', () => {
  assert.throws(() => validateCatalog([...catalog, catalog[0]]), /重复/);
  assert.throws(
    () =>
      validateCatalog([
        {
          ...catalog[0],
          source: 'docs/migrations/20260923-flowable-8-postgres.md',
        },
      ]),
    /不允许进入前端包/,
  );
});

test('文档链接转换为稳定地址，未登记内部资料不形成失效链接', () => {
  const ids = validateCatalog(catalog);
  const source = resolve(root, 'docs/统一消息与邮件工单使用指南.md');
  assert.match(
    rewriteLinks('[收件手册](邮件收件模块功能与使用手册.md)', source, ids),
    /\?doc=mail-receiving-admin/,
  );
  assert.match(
    rewriteLinks(
      '[迁移说明](migrations/20260923-flowable-8-postgres.md)',
      source,
      ids,
    ),
    /迁移说明（资料未收录在线帮助）/,
  );
  assert.throws(
    () => rewriteLinks('[无效](missing.md)', source, ids),
    /链接不存在/,
  );
});

test('生成内容与登记清单同步', () => {
  assert.equal(generateHelpCenter({ checkOnly: true }).length, catalog.length);
});
