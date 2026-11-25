import type { ReportVersion } from './report-definition-management-service';

import { RequestService, ResAuthorize, Service } from '@levin/admin-framework';
import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/ReportDefinitionManagement',
  controllerClass: 'com.levin.oak.base.controller.BizReportMenuController',
  description: '为未发布报表创建专用菜单。',
  title: '报表定义',
  type: '平台数据-报表定义',
})
export class ReportMenuService extends RequestService {
  constructor(private readonly silentErrors = false) {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-报表定义',
    action: '更新',
  })
  async generateMenu(data: ReportVersion): Promise<string> {
    return this.post<string>('generateMenu', { data, ...(this.silentErrors ? { __silentError: true } : {}) });
  }
}
export const reportMenuService = new ReportMenuService();
