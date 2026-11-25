import { getResAuthorizeMeta } from '@levin/admin-framework/framework-commons/api-authorize';
import { getServiceMeta } from '@levin/admin-framework';
import { describe, expect, it, vi } from 'vitest';
import { reportPreviewService } from '../report-preview-service';

describe('报表草稿预览接口', () => {
  it('只发送已保存版本与页面参数，使用查看权限', async () => {
    expect(getServiceMeta(reportPreviewService)).toMatchObject({ controllerClass: 'com.levin.oak.base.controller.BizReportPreviewController' });
    expect(getResAuthorizeMeta(reportPreviewService.page as unknown as object)).toMatchObject({ action: '查看详情' });
    const request = vi.spyOn(reportPreviewService as unknown as { request: (options: unknown) => Promise<unknown> }, 'request').mockResolvedValue({});
    const version = { reportId: 'report-1', expectedLock: 2, expectedDefinitionVersion: 3 };
    await reportPreviewService.query(version, 'table', { org: 'org-1' });
    expect(request).toHaveBeenCalledWith({ method: 'POST', path: 'previewQuery',
      data: { ...version, componentId: 'table', parameters: { org: 'org-1' } } });
    request.mockRestore();
  });
});
