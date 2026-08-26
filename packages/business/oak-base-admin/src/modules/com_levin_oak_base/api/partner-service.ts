import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
import { RequestService } from '@levin/admin-framework';
import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/Partner',
  controllerClass: 'com.levin.oak.base.controller.BizPartnerController',
  description: '合作伙伴管理',
  title: '合作伙伴',
  type: '系统数据-合作伙伴',
})
export class PartnerService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-合作伙伴', action: '查询列表' })
  @CRUD.ListTable({ refEntityClass: 'com.levin.oak.base.entities.Partner' })
  async list(params?: any, options?: any) {
    return this.get('list', { ...options, params });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-合作伙伴', action: '查看详情' })
  @CRUD.Op({ confirmText: 'None' })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', { ...options, params });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-合作伙伴', action: '保存合作伙伴' })
  @CRUD.Op({ label: '保存合作伙伴', opRefTargetType: 'None' })
  async create(data?: any, options?: any) {
    return this.post('savePartner', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-合作伙伴', action: '更新合作伙伴' })
  @CRUD.Op({ label: '更新合作伙伴' })
  async update(data?: any, options?: any) {
    return this.put('updatePartner', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-合作伙伴', action: '删除' })
  @CRUD.Op()
  async delete(params?: any, options?: any) {
    return this.deleteRequest('delete', { ...options, params });
  }
}

export const partnerService = new PartnerService();
