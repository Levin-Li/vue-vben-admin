import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

export interface MaskingEntityCatalogItem {
  entityClass: string;
  /** 服务端实体模型声明的展示名称，旧服务可不返回。 */
  entityTitle?: string;
  fieldName: string;
  /** 服务端实体字段声明的展示名称，旧服务可不返回。 */
  fieldTitle?: string;
}

@Service({
  basePath: '/DataMaskingSetting',
  controllerClass:
    'com.levin.oak.base.controller.BizDataMaskingSettingController',
  description: '数据脱敏规则管理',
  title: '数据脱敏设置',
  type: '系统数据-数据脱敏设置',
})
export class DataMaskingSettingService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据脱敏设置',
    res: '',
    action: '新增',
  })
  async create(data?: any, options?: any) {
    return this.post('create', { ...options, data });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据脱敏设置',
    res: '',
    action: '删除',
  })
  async delete(params?: any, options?: any) {
    return this.deleteRequest('delete', { ...options, params });
  }

  // 实体字段目录由服务端依据模型注解与已注册接口生成。
  async entityCatalog(): Promise<MaskingEntityCatalogItem[]> {
    return this.get('entityCatalog');
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.DataMaskingSetting',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据脱敏设置',
    res: '',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get('list', { ...options, params });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据脱敏设置',
    res: '',
    action: '查看详情',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', { ...options, params });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据脱敏设置',
    res: '',
    action: '更新',
  })
  async update(data?: any, options?: any) {
    return this.put('update', { ...options, data });
  }
}

export const dataMaskingSettingService = new DataMaskingSettingService();
