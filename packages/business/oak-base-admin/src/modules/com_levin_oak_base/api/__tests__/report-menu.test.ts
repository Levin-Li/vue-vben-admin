import { getResAuthorizeMeta } from '@levin/admin-framework/framework-commons/api-authorize';
import { getServiceMeta } from '@levin/admin-framework';
import { describe, expect, it, vi } from 'vitest';
import { reportMenuService } from '../report-menu-service';

describe('报表菜单生成接口', () => {
  it('只发送版本和标识，使用报表更新权限', async () => {
    expect(getServiceMeta(reportMenuService)).toMatchObject({
      controllerClass: 'com.levin.oak.base.controller.BizReportMenuController',
      basePath: '/ReportDefinitionManagement',
    });
    expect(
      getResAuthorizeMeta(reportMenuService.generateMenu as unknown as object),
    ).toMatchObject({
      action: '更新',
      type: '平台数据-报表定义',
    });
    const request = vi
      .spyOn(
        reportMenuService as unknown as {
          request: (options: unknown) => Promise<unknown>;
        },
        'request',
      )
      .mockResolvedValue('menu-1');
    await reportMenuService.generateMenu({
      reportId: 'report-1',
      expectedLock: 2,
      expectedDefinitionVersion: 3,
    });
    expect(request).toHaveBeenCalledWith({
      method: 'POST',
      path: 'generateMenu',
      data: {
        reportId: 'report-1',
        expectedLock: 2,
        expectedDefinitionVersion: 3,
      },
    });
    request.mockRestore();
  });
});
