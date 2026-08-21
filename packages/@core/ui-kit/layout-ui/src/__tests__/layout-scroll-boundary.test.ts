import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('布局滚动边界', () => {
  it('不再通过全局锁定根页面滚动来掩盖布局溢出', () => {
    const source = readFileSync(
      'packages/@core/base/design/src/css/global.css',
      'utf8',
    );

    expect(source).not.toMatch(
      /#app,\s*body,\s*html\s*\{[\s\S]*?overflow:\s*hidden;/,
    );
  });

  it('仅在桌面布局使用确定高度，移动端保留内容自然增长', () => {
    const source = readFileSync(
      'packages/@core/ui-kit/layout-ui/src/vben-layout.vue',
      'utf8',
    );

    expect(source).toContain(
      "isMobile ? 'min-h-full' : 'h-full min-h-0'",
    );
    expect(source).toContain(
      "isMobile ? 'overflow-visible' : 'min-h-0 overflow-hidden'",
    );
  });

  it('双列菜单的内部间隔独立配置，不叠加侧边栏左右外边距', () => {
    const source = readFileSync(
      'packages/@core/ui-kit/layout-ui/src/components/layout-sidebar.vue',
      'utf8',
    );
    expect(source).toContain('left: `${width + marginLeft + extraGap}px`');
    expect(source).toContain("marginLeft: '0px'");
  });

  it('菜单项间隔由侧边栏偏好变量统一传递给各级垂直菜单', () => {
    const sidebarSource = readFileSync(
      'packages/@core/ui-kit/layout-ui/src/components/layout-sidebar.vue',
      'utf8',
    );
    const menuSource = readFileSync(
      'packages/@core/ui-kit/menu-ui/src/components/menu.vue',
      'utf8',
    );
    const normalMenuSource = readFileSync(
      'packages/@core/ui-kit/menu-ui/src/components/normal-menu/normal-menu.vue',
      'utf8',
    );

    expect(sidebarSource).toContain(
      "'--sidebar-menu-item-gap': `${props.menuItemGap}px`",
    );
    expect(menuSource).toContain(
      '--menu-item-margin-y: var(--sidebar-menu-item-gap, 2px);',
    );
    expect(normalMenuSource).toContain(
      '--menu-item-margin-y: var(--sidebar-menu-item-gap, 4px);',
    );
  });
});
