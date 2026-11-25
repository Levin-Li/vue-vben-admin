import { describe, expect, it, vi } from 'vitest';
import { reportPreviewService as defaultService, ReportPreviewService } from '../report-preview-service';

describe('草稿预览请求', () => {
  it('由页面处理当前请求的错误，避免旧请求自动弹错', async () => {
    const service = new ReportPreviewService(true);
    const request = vi.spyOn(service as unknown as { request: (options: unknown) => Promise<unknown> }, 'request').mockResolvedValue({});
    const version = { reportId: 'report-1', expectedLock: 1, expectedDefinitionVersion: 2 };
    await service.page(version);
    expect(request).toHaveBeenLastCalledWith({ method: 'POST', path: 'previewPage', __silentError: true, data: version });
    await service.query(version, 'chart-1', {});
    expect(request).toHaveBeenLastCalledWith({ method: 'POST', path: 'previewQuery', __silentError: true,
      data: { ...version, componentId: 'chart-1', parameters: {} } });
    await service.datasetPage(version, 'dataset1');
    expect(request).toHaveBeenLastCalledWith({ method: 'POST', path: 'previewDatasetPage', __silentError: true,
      data: { ...version, datasetId: 'dataset1' } });
    await service.datasetQuery(version, 'dataset1', { org: 'org-1' });
    expect(request).toHaveBeenLastCalledWith({ method: 'POST', path: 'previewDatasetQuery', __silentError: true,
      data: { ...version, datasetId: 'dataset1', parameters: { org: 'org-1' } } });
    request.mockRestore();
  });
  it('公开默认实例保持原有提示方式', async () => {
    const request = vi.spyOn(defaultService as unknown as { request: (options: unknown) => Promise<unknown> }, 'request').mockResolvedValue({});
    const version = { reportId: 'report-1', expectedLock: 1, expectedDefinitionVersion: 2 };
    await defaultService.page(version);
    expect(request).toHaveBeenCalledWith({ method: 'POST', path: 'previewPage', data: version });
    request.mockRestore();
  });
});
