import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/EContractTemplate',
  controllerClass:
    'com.levin.oak.base.controller.BizEContractTemplateController',
  description: '电子合同模板管理',
  title: '电子合同模板',
  type: '业务数据-电子合同模板',
})
export class ElectronicContractTemplateService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({ label: '归档' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同模板',
    action: '归档合同模板',
  })
  async archive(params?: any, options?: any) {
    return this.post('archive', { ...options, params });
  }

  @CRUD.Op({ opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同模板',
    action: '创建电子合同模板草稿',
  })
  async create(data?: any, options?: any) {
    return this.post('create', { ...options, data });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同模板',
    action: '电子合同模板删除入口已关闭',
  })
  async delete(params?: any, options?: any) {
    return this.deleteRequest('delete', { ...options, params });
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.EContractTemplate',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同模板',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get('list', { ...options, params });
  }

  @CRUD.Op({ label: '上线' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同模板',
    action: '上线合同模板',
  })
  async publish(params?: any, options?: any) {
    return this.post('publish', { ...options, params });
  }

  @CRUD.Op({ confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同模板',
    action: '查看详情',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', { ...options, params });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同模板',
    action: '更新电子合同模板',
  })
  async update(data?: any, options?: any) {
    return this.put('update', { ...options, data });
  }

  // 专用上传一次性登记受控 FileRes，模板只引用返回的资源元数据。
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同模板',
    action: '上传受控 DOCX 电子合同模板',
  })
  async uploadTemplateDocx(
    file: File,
    scope: { orgId?: string; ownerId?: string; tenantId?: string } = {},
  ) {
    const data = new FormData();
    data.append('file', file);
    for (const [key, value] of Object.entries(scope)) {
      if (value) data.append(key, value);
    }
    return this.post<{
      fileHash?: string;
      fileName: string;
      fileResId: string;
      fileUrl: string;
      mimeType: string;
    }>('uploadTemplateDocx', { data });
  }
}

export const electronicContractTemplateService =
  new ElectronicContractTemplateService();
