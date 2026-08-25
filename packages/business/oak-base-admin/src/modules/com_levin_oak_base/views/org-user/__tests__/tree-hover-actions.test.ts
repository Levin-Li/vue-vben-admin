import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const pagePath =
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/org-user/index.vue';

describe('组织与用户页面组织树', () => {
  it('让组织树与用户 CRUD 内容共用零外侧内边距和高度', () => {
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain('user-org-page flex min-h-0 gap-[8px]');
    expect(source).not.toContain('user-org-page flex min-h-0 gap-4');
    expect(source).toContain('user-org-main min-h-0 min-w-0 flex-1');
    expect(source).not.toContain('--user-org-sidebar-height');
    expect(source).toMatch(
      /\.user-org-page\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*520px;/s,
    );
    expect(source).not.toContain('.user-org-main :deep(.vben-crud-page)');
  });

  it('将悬停操作放入节点右侧的浮动工具条，避免遮挡标题', () => {
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain(
      '.user-org-tree :deep(.ant-tree-node-content-wrapper)',
    );
    expect(source).toMatch(
      /\.user-org-tree :deep\(\.ant-tree-node-content-wrapper\)\s*\{[^}]*min-width:\s*0;[^}]*overflow:\s*visible;/s,
    );
    expect(source).toMatch(
      /\.user-org-tree-node\s*\{[^}]*display:\s*flex;[^}]*flex:\s*1;[^}]*min-width:\s*0;/s,
    );
    expect(source).toContain('user-org-tree-node--actions-visible');
    expect(source).toMatch(
      /\.user-org-tree-node--actions-visible \.user-org-tree-node-title\s*\{[^}]*padding-right:\s*88px;/s,
    );
    expect(source).toMatch(
      /\.user-org-tree-actions\s*\{[^}]*position:\s*absolute;[^}]*top:\s*50%;[^}]*right:\s*2px;[^}]*background:\s*hsl\(var\(--popover\)\);/s,
    );
    expect(source).toMatch(
      /\.user-org-sidebar\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*3;[^}]*overflow:\s*visible;/s,
    );
    expect(source).toMatch(
      /\.user-org-main\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*1;/s,
    );
    expect(source).toMatch(
      /\.user-org-tree-actions\s*\{[^}]*z-index:\s*20;/s,
    );
    expect(source).toContain('aria-label="新增下级组织"');
    expect(source).toContain('aria-label="编辑组织"');
    expect(source).toContain('aria-label="删除组织"');
    expect(source).toContain('tabindex="0"');
    expect(source).toContain('@focusout="handleOrgNodeFocusOut"');
  });
});
