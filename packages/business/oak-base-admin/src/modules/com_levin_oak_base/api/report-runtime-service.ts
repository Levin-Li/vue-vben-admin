import type {
  ReportRuntimePage,
  ReportRuntimeResult,
} from '../views/report-view/report-runtime';

import { RequestService, ResAuthorize, Service } from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/ReportDefinition/use',
  controllerClass: 'com.levin.oak.base.controller.BizReportRuntimeController',
  description: '读取已发布报表及其受授权的数据。',
  title: '报表运行',
  type: '平台数据-报表定义',
})
export class ReportRuntimeService extends RequestService {
  constructor(private readonly silentErrors = false) {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-报表定义',
    action: '读取报表页面',
    onlyRequireAuthenticated: true,
  })
  async page(reportId: string): Promise<ReportRuntimePage> {
    return this.post<ReportRuntimePage>('page', { ...(this.silentErrors ? { __silentError: true } : {}), data: { reportId } });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-报表定义',
    action: '查询报表组件',
    onlyRequireAuthenticated: true,
  })
  async query(
    reportId: string,
    componentId: string,
    parameters: Readonly<Record<string, string>>,
  ): Promise<ReportRuntimeResult> {
    return this.post<ReportRuntimeResult>('query', {
      ...(this.silentErrors ? { __silentError: true } : {}),
      data: { reportId, componentId, parameters },
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base', type: '平台数据-报表定义',
    action: '导出报表组件', onlyRequireAuthenticated: true,
  })
  async exportComponent(reportId: string, componentId: string, parameters: Readonly<Record<string, string>>) {
    return this.post<{
      title: string; columns: string[];
      formats: NonNullable<ReportRuntimePage['components'][number]['formats']>;
      rows: unknown[][];
    }>('export', { ...(this.silentErrors ? { __silentError: true } : {}), data: { reportId, componentId, parameters } });
  }
}

export const reportRuntimeService = new ReportRuntimeService();
