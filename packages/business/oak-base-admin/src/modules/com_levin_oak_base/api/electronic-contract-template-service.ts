import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
import { RequestService } from '@levin/admin-framework';
import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/ElectronicContractTemplate',
  controllerClass: 'com.levin.oak.base.controller.BizElectronicContractTemplateController',
  description: '电子合同模板管理',
  title: '电子合同模板',
  type: '系统数据-电子合同模板',
})
export class ElectronicContractTemplateService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-电子合同模板', action: '查询列表' })
  @CRUD.ListTable({ refEntityClass: 'com.levin.oak.base.entities.ElectronicContractTemplate' })
  async list(params?: any, options?: any) {
    return this.get('list', { ...options, params });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-电子合同模板', action: '查看详情' })
  @CRUD.Op({ confirmText: 'None' })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', { ...options, params });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-电子合同模板', action: '新增' })
  @CRUD.Op({ opRefTargetType: 'None' })
  async create(data?: any, options?: any) {
    return this.post('create', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-电子合同模板', action: '更新' })
  @CRUD.Op()
  async update(data?: any, options?: any) {
    return this.put('update', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-电子合同模板', action: '删除' })
  @CRUD.Op()
  async delete(params?: any, options?: any) {
    return this.deleteRequest('delete', { ...options, params });
  }
}

export const electronicContractTemplateService =
  new ElectronicContractTemplateService();
