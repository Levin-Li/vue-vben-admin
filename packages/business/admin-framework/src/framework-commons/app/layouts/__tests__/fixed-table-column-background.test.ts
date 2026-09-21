import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('品牌渐变固定表头背景', () => {
  it('为 Ant Design Vue 的左右固定表头使用不透明主题渐变', () => {
    // 固定表头通过 sticky 脱离普通行背景，必须单独遮挡水印。
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/app/layouts/basic.vue',
      'utf8',
    );
    const transparentHeaderSection = source.slice(
      source.indexOf('/* 标准 CRUD 的多种表格实现共用低饱和主题渐变表头。 */'),
      source.indexOf('/* 工具栏图标静止时不叠加圆形表面'),
    );

    expect(transparentHeaderSection).toContain('.ant-table-cell-fix-left');
    expect(transparentHeaderSection).toContain('.ant-table-cell-fix-right');
    expect(transparentHeaderSection).toContain('background: transparent');
    expect(transparentHeaderSection).toContain(
      ':not(.ant-table-cell-fix-left)',
    );
    expect(transparentHeaderSection).toMatch(
      /:not\(\s*\.ant-table-cell-fix-right\s*\)/,
    );
    expect(transparentHeaderSection).toMatch(
      /:not\(\s*\.ant-table-cell-fix-left-last\s*\)/,
    );
    expect(transparentHeaderSection).toMatch(
      /:not\(\s*\.ant-table-cell-fix-right-first\s*\)/,
    );
    expect(source).toContain('/* 固定表头在渐变模式下复用不透明品牌渐变。 */');
    expect(source).toContain('color-mix(in srgb');
    expect(source).toContain('--admin-crud-header-gradient');
    expect(source).toContain('background-attachment: fixed');
  });
});
