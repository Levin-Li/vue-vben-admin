import type { UserDropdownMenuRecord } from '@levin/admin-framework';

import { createApp } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import {
  getUserDropdownMenuItems,
  removeUserDropdownMenuItem,
} from '@levin/admin-framework';
import { createPinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';

import { oakBaseAdminBackendRouteMappings } from '../backend-route-mappings';
import {
  findHelpDocument,
  helpDocuments,
  helpDocumentUrl,
} from '../help-center';
import { renderHelpMarkdown } from '../help-markdown';
import { createOakBaseAdminModule } from '../module';

describe('随包文档中心', () => {
  it('目录正文随模块载入并保留稳定业务页关联', () => {
    expect(helpDocuments.length).toBeGreaterThanOrEqual(3);
    expect(findHelpDocument('mail-ticket-guide')?.content).toContain('工单');
    expect(findHelpDocument('mail-receiving-admin')?.pages).toEqual(
      expect.arrayContaining([{ path: '/clob/V1/Domain', view: 'domain' }]),
    );
    expect(
      helpDocumentUrl('mail-ticket-guide', '配置受理队列与支持邮箱'),
    ).toContain('/clob/V1/HelpCenter?doc=mail-ticket-guide#');
  });

  it('右上角入口和页面路由指向同一帮助中心', async () => {
    const module = createOakBaseAdminModule();
    const personalGroup = module.routes?.[0]?.children?.find(
      (route) => route.meta?.title === '个人&中心',
    );
    const page = personalGroup?.children?.find(
      (route) => route.path === '/clob/V1/HelpCenter',
    );
    const mapping = oakBaseAdminBackendRouteMappings.find(
      (route) => route.path === page?.path,
    );
    // 使用完整模块上下文夹具，路由跳转单独受控模拟。
    const router = createRouter({ history: createMemoryHistory(), routes: [] });
    const push = vi.spyOn(router, 'push').mockResolvedValue(undefined);
    await module.setup?.({
      app: createApp({}),
      pinia: createPinia(),
      request: {},
      router,
    });
    const menu = getUserDropdownMenuItems().value.find(
      (item: UserDropdownMenuRecord) => item.id === 'help-center',
    );

    expect(page?.name).toBe('_clob_V1_HelpCenter');
    expect(mapping).toMatchObject({
      onlyRequireAuthenticated: true,
      sourceFilePath: 'modules/com_levin_oak_base/views/help-center/index.vue',
      viewPath: '/system/com_levin_oak_base/help-center/index.vue',
    });
    expect(menu?.text).toBe('文档中心');
    await menu?.handler();
    expect(push).toHaveBeenCalledWith('/clob/V1/HelpCenter');
    removeUserDropdownMenuItem('help-center');
  });

  it('markdown 渲染转义脚本、限制链接，并支持表格与章节定位', () => {
    const html = renderHelpMarkdown(
      [
        '# 工单配置',
        '<script>alert(1)</script>',
        '[危险](javascript:alert(1)) [可用](?doc=mail-ticket-guide#工单配置)',
        '| 项目 | 值 |',
        '| --- | --- |',
        '| 入口 | 支持邮箱 |',
      ].join('\n'),
    );

    expect(html).toContain('id="工单配置"');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('href="?doc=mail-ticket-guide#工单配置"');
    expect(html).toContain('<table>');
  });
});
