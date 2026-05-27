import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
import { RequestService } from '@levin/admin-framework';
import { OAK_BASE_API_MODULE } from './_module';

export interface SyncI18nLabelItem {
  category?: string;
  domain?: string;
  enable?: boolean;
  label: string;
  language: string;
  moduleId?: string;
  overrideExisting?: boolean;
  resKey: string;
}

export interface SyncI18nLabelsPayload {
  labelList: SyncI18nLabelItem[];
}

export interface UploadModuleI18nLabelsPayload {
  appCode?: string;
  appVersion?: string;
  domain?: string;
  enable?: boolean;
  modules: Array<{
    languages: Record<string, Record<string, string>>;
    moduleId: string;
  }>;
  overrideExisting?: boolean;
  siteId?: string;
  tenantId?: string;
  tenantShared?: boolean;
  terminalType?: string;
}

export interface RuntimeI18nLabelsPayload {
  appCode: string;
  appVersion: string;
  domain?: string;
  language: string;
  moduleIds: string[];
  siteId?: string;
  terminalType: string;
  valueType?: 'Label' | 'ResValue';
}

@Service({
  basePath: '/I18nRes',
  controllerClass: 'com.levin.oak.base.controller.BizI18nResController',
  description: '国际化资源管理',
  title: '国际化资源',
  type: '系统数据-国际化资源',
})
export class I18nResService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-国际化资源',
    action: '批量新增',
  })
  async batchCreate(data?: any, options?: any) {
    return this.post('batchCreate', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-国际化资源',
    action: '批量删除',
  })
  @CRUD.Op({
    opRefTargetType: 'MultipleRow',
  })
  async batchDelete(params?: any, options?: any) {
    return this.deleteRequest('batchDelete', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-国际化资源',
    action: '批量更新',
  })
  async batchUpdate(data?: any, options?: any) {
    return this.put('batchUpdate', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-国际化资源',
    action: '清除缓存',
  })
  async clearCache(params?: any, options?: any) {
    return this.get('clearCache', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-国际化资源',
    action: '新增',
  })
  @CRUD.Op({
    opRefTargetType: 'None',
  })
  async create(data?: any, options?: any) {
    return this.post('create', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-国际化资源',
    action: '删除',
  })
  @CRUD.Op()
  async delete(params?: any, options?: any) {
    return this.deleteRequest('delete', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-国际化资源',
    action: '查询列表',
  })
  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.I18nRes',
  })
  async list(params?: any, options?: any) {
    return this.get('list', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-国际化资源',
    action: '查看详情',
  })
  @CRUD.Op({
    confirmText: 'None',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-国际化资源',
    action: '统计',
  })
  async stat(params?: any, options?: any) {
    return this.get('stat', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-国际化资源',
    action: '查询服务端国际化标签',
    onlyRequireAuthenticated: true,
  })
  async serverLabels(params?: any, options?: any) {
    return this.get('serverLabels', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-国际化资源',
    action: '同步前端国际化标签到后端',
  })
  async syncLabels(data: SyncI18nLabelsPayload, options?: any) {
    return this.post<number>('syncLabels', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-国际化资源',
    action: '按模块上传客户端国际化资源',
  })
  async uploadModuleLabels(data: UploadModuleI18nLabelsPayload, options?: any) {
    return this.post('uploadModuleLabels', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-国际化资源',
    action: '获取运行时国际化资源',
    ignored: true,
  })
  async runtimeLabels(data: RuntimeI18nLabelsPayload, options?: any) {
    return this.post('runtimeLabels', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-国际化资源',
    action: '更新',
  })
  @CRUD.Op()
  async update(data?: any, options?: any) {
    return this.put('update', {
      ...options,
      data,
    });
  }
}

export const i18nResService = new I18nResService();
