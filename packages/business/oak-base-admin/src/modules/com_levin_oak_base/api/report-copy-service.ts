import { RequestService, ResAuthorize, Service } from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/ReportDefinition/copy',
  controllerClass: 'com.levin.oak.base.controller.BizReportCopyController',
  description: '将已授权的全局报表复制为租户草稿。',
  title: '报表定义',
  type: '平台数据-报表定义',
})
export class ReportCopyService extends RequestService {
  constructor(private readonly silentErrors = false) {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-报表定义',
    action: '新增',
  })
  async capabilities(): Promise<boolean> {
    return this.get<boolean>('capabilities', this.silentErrors ? { __silentError: true } : {});
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-报表定义',
    action: '新增',
  })
  async copy(data: { name: string; orgId: string; sourceReportId: string }): Promise<string> {
    return this.post<string>('global', { data, ...(this.silentErrors ? { __silentError: true } : {}) });
  }
}

export const reportCopyService = new ReportCopyService();
