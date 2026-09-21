import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('Ant Design Vue 固定表头背景', () => {
  it('为左右固定表头提供通用的不透明主题背景', () => {
    // 固定列的视觉规则不能依赖业务列名、操作列语义或页面主题。
    const source = readFileSync(
      'packages/runtime/src/vendor/styles/antd/index.css',
      'utf8',
    );

    expect(source).toContain('.ant-table-cell-fix-left');
    expect(source).toContain('.ant-table-cell-fix-right');
    expect(source).toContain('.ant-table-cell-fix-left-last');
    expect(source).toContain('.ant-table-cell-fix-right-first');
    expect(source).toContain("[style*='position: sticky']");
    expect(source).toContain('background-color: hsl(var(--muted)) !important;');
  });
});
