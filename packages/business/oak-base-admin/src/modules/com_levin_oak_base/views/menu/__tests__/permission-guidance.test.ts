import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const menuPageSource = readFileSync(
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/menu/index.vue',
  'utf8',
);
const menuConfigSource = readFileSync(
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/menu/config.ts',
  'utf8',
);

describe('菜单额外所需权限提示', () => {
  it('在管理入口和工具栏说明菜单展示权限与全部额外权限的组合规则', () => {
    expect(menuPageSource).toContain('额外所需权限');
    expect(menuPageSource).toContain(
      '菜单可见需要菜单展示权限 + 所有的额外所需权限',
    );
    expect(menuPageSource).toContain('#toolbar-actions');
  });

  it('将菜单字段标记为额外所需权限', () => {
    expect(menuConfigSource).toMatch(
      /key:\s*'requireAuthorizations',[\s\S]*?label:\s*'额外所需权限'/,
    );
  });
});
