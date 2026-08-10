import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const pagePath =
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/org-user/index.vue';

describe('组织与用户页面组织树', () => {
  it('为悬停操作保留可收缩的节点内容区域', () => {
    const source = readFileSync(pagePath, 'utf8');

    expect(source).toContain(
      '.user-org-tree :deep(.ant-tree-node-content-wrapper)',
    );
    expect(source).toMatch(
      /\.user-org-tree :deep\(\.ant-tree-node-content-wrapper\)\s*\{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;/s,
    );
    expect(source).toMatch(
      /\.user-org-tree-node\s*\{[^}]*display:\s*flex;[^}]*flex:\s*1;[^}]*min-width:\s*0;/s,
    );
    expect(source).not.toMatch(
      /\.user-org-tree-node\s*\{[^}]*width:\s*100%;/s,
    );
  });
});
