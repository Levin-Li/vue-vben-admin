import { getResAuthorizeMeta } from '@levin/admin-framework/framework-commons/api-authorize';
import { getServiceMeta } from '@levin/admin-framework';
import { describe, expect, it, vi } from 'vitest';

import { reportDefinitionManagementService as service, ReportDefinitionManagementService } from '../report-definition-management-service';

describe('报表管理接口契约', () => {
  it('使用后端控制器和对应的资源动作权限', () => {
    expect(getServiceMeta(service)).toMatchObject({
      basePath: '/ReportDefinitionManagement',
      controllerClass:
        'com.levin.oak.base.controller.ReportDefinitionManagementController',
      type: '平台数据-报表定义',
    });
    for (const [method, action] of Object.entries({
      catalog: '查询列表',
      capabilities: '查询列表',
      create: '新增',
      getDraft: '查看详情',
      list: '查询列表',
      publish: '发布',
      saveDraft: '更新',
    })) {
      const fn = (service as unknown as Record<string, object>)[method];
      expect(getResAuthorizeMeta(fn)).toMatchObject({
        action,
        domain: 'com.levin.oak.base',
        type: '平台数据-报表定义',
      });
    }
  });

  it('以接口规定的方法和请求体传递版本，不传身份或授权范围', async () => {
    const transport = vi
      .spyOn(
        service as unknown as {
          request: (options: unknown) => Promise<unknown>;
        },
        'request',
      )
      .mockResolvedValue({});
    await service.catalog();
    expect(transport).toHaveBeenLastCalledWith({
      method: 'GET',
      path: 'catalog',
    });
    await service.list({ pageIndex: 1, pageSize: 20 });
    expect(transport).toHaveBeenLastCalledWith({
      method: 'POST',
      path: 'list',
      data: { pageIndex: 1, pageSize: 20 },
    });
    await service.publish({
      reportId: 'report-1',
      expectedLock: 3,
      expectedDefinitionVersion: 2,
    });
    expect(transport).toHaveBeenLastCalledWith({
      method: 'POST',
      path: 'publish',
      data: {
        reportId: 'report-1',
        expectedLock: 3,
        expectedDefinitionVersion: 2,
      },
    });
    transport.mockRestore();
  });

  it('页面专用实例静默处理错误，业务方法参数保持不变', async () => {
    const pageService = new ReportDefinitionManagementService(true);
    expect(getServiceMeta(pageService)).toMatchObject({ basePath: '/ReportDefinitionManagement', type: '平台数据-报表定义' });
    expect(getResAuthorizeMeta(pageService.list as unknown as object)).toMatchObject({ action: '查询列表' });
    const transport = vi.spyOn(pageService as unknown as { request: (options: unknown) => Promise<unknown> }, 'request').mockResolvedValue({});
    await pageService.catalog();
    expect(transport).toHaveBeenLastCalledWith({ method: 'GET', path: 'catalog', __silentError: true });
    await pageService.list({ pageIndex: 1, pageSize: 20 });
    expect(transport).toHaveBeenLastCalledWith({ method: 'POST', path: 'list', data: { pageIndex: 1, pageSize: 20 }, __silentError: true });
    transport.mockRestore();
  });
});
