import type {
  ReportRuntimePage,
  ReportRuntimeResult,
} from '../views/report-view/report-runtime';
import type { ReportVersion } from './report-definition-management-service';

import { RequestService, ResAuthorize, Service } from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/ReportDefinitionManagement',
  controllerClass: 'com.levin.oak.base.controller.BizReportPreviewController',
  description: '预览已保存的报表草稿。',
  title: '报表定义',
  type: '平台数据-报表定义',
})
export class ReportPreviewService extends RequestService {
  constructor(private readonly silentErrors = false) {
    super(OAK_BASE_API_MODULE);
  }
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-报表定义',
    action: '查看详情',
  })
  async page(data: ReportVersion): Promise<ReportRuntimePage> {
    return this.post('previewPage', { ...(this.silentErrors ? { __silentError: true } : {}), data });
  }
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-报表定义',
    action: '查看详情',
  })
  async query(
    data: ReportVersion,
    componentId: string,
    parameters: Readonly<Record<string, string>>,
  ): Promise<ReportRuntimeResult> {
    return this.post('previewQuery', {
      ...(this.silentErrors ? { __silentError: true } : {}),
      data: { ...data, componentId, parameters },
    });
  }
  @ResAuthorize({
    domain: 'com.levin.oak.base', type: '平台数据-报表定义', action: '查看详情',
  })
  async datasetPage(data: ReportVersion, datasetId: string): Promise<ReportRuntimePage> {
    return this.post('previewDatasetPage', {
      ...(this.silentErrors ? { __silentError: true } : {}), data: { ...data, datasetId },
    });
  }
  @ResAuthorize({
    domain: 'com.levin.oak.base', type: '平台数据-报表定义', action: '查看详情',
  })
  async datasetQuery(data: ReportVersion, datasetId: string, parameters: Readonly<Record<string, string>>): Promise<ReportRuntimeResult> {
    return this.post('previewDatasetQuery', {
      ...(this.silentErrors ? { __silentError: true } : {}), data: { ...data, datasetId, parameters },
    });
  }
}
export const reportPreviewService = new ReportPreviewService();
