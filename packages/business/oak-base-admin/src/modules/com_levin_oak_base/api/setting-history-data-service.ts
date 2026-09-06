import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/SettingHistoryData',
  controllerClass:
    'com.levin.oak.base.controller.BizSettingHistoryDataController',
  description: '查询和删除设置历史数据。',
  title: '设置历史数据',
  type: '平台数据-设置历史数据',
})
export class SettingHistoryDataService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-设置历史数据',
    action: '删除',
  })
  async delete(params?: any, options?: any) {
    return this.deleteRequest('delete', { ...options, params });
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.SettingHistoryData',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-设置历史数据',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get('list', { ...options, params });
  }

  @CRUD.Op({ confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-设置历史数据',
    action: '查看详情',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', { ...options, params });
  }
}

export const settingHistoryDataService = new SettingHistoryDataService();
