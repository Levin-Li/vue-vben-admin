import { getResAuthorizeMeta } from '@levin/admin-framework/framework-commons/api-authorize';
import { getServiceMeta } from '@levin/admin-framework';
import { describe, expect, it, vi } from 'vitest';

import { reportRuntimeService as defaultService, ReportRuntimeService } from '../report-runtime-service';

const service = new ReportRuntimeService(true);

describe('报表运行接口契约', () => {
  it('使用后端对应的认证入口，查询只携带报表标识和共享条件', async () => {
    expect(getServiceMeta(service)).toMatchObject({
      basePath: '/ReportDefinition/use',
      controllerClass: 'com.levin.oak.base.controller.BizReportRuntimeController',
      type: '平台数据-报表定义',
    });
    for (const [method, action] of Object.entries({ page: '读取报表页面', query: '查询报表组件', exportComponent: '导出报表组件' })) {
      const fn = (service as unknown as Record<string, object>)[method];
      expect(getResAuthorizeMeta(fn)).toMatchObject({ domain: 'com.levin.oak.base', type: '平台数据-报表定义',
        action, onlyRequireAuthenticated: true });
    }
    const request = vi.spyOn(service as unknown as { request: (options: unknown) => Promise<unknown> }, 'request')
      .mockResolvedValue({});
    await service.page('report-1');
    expect(request).toHaveBeenLastCalledWith({ method: 'POST', path: 'page', __silentError: true, data: { reportId: 'report-1' } });
    const parameters = { organization: 'org-1' };
    await service.query('report-1', 'chart-1', parameters);
    expect(request).toHaveBeenLastCalledWith({ method: 'POST', path: 'query', __silentError: true,
      data: { reportId: 'report-1', componentId: 'chart-1', parameters } });
    await service.exportComponent('report-1', 'chart-1', parameters);
    expect(request).toHaveBeenLastCalledWith({ method: 'POST', path: 'export', __silentError: true,
      data: { reportId: 'report-1', componentId: 'chart-1', parameters } });
    request.mockRestore();
  });
  it('公开默认实例保留统一错误提示', async () => {
    const request = vi.spyOn(defaultService as unknown as { request: (options: unknown) => Promise<unknown> }, 'request').mockResolvedValue({});
    await defaultService.page('report-1');
    expect(request).toHaveBeenCalledWith({ method: 'POST', path: 'page', data: { reportId: 'report-1' } });
    request.mockRestore();
  });
});
