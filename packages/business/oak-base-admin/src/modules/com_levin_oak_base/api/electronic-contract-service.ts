import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
import { RequestService } from '@levin/admin-framework';
import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/EContract',
  controllerClass: 'com.levin.oak.base.controller.BizEContractController',
  description: '电子合同管理',
  title: '电子合同',
  type: '系统数据-电子合同',
})
export class ElectronicContractService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-电子合同', action: '查询列表' })
  @CRUD.ListTable({ refEntityClass: 'com.levin.oak.base.entities.EContract' })
  async list(params?: any, options?: any) {
    return this.get('list', { ...options, params });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-电子合同', action: '查看详情' })
  @CRUD.Op({ confirmText: 'None' })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', { ...options, params });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-电子合同', action: '创建电子合同草稿' })
  @CRUD.Op({ label: '创建草稿', opRefTargetType: 'None' })
  async create(data?: any, options?: any) {
    return this.post('saveDraft', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-电子合同', action: '更新电子合同草稿' })
  @CRUD.Op({ label: '更新草稿' })
  async update(data?: any, options?: any) {
    return this.put('updateDraft', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-电子合同', action: '删除' })
  @CRUD.Op()
  async delete(params?: any, options?: any) {
    return this.deleteRequest('delete', { ...options, params });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-电子合同', action: '提交签署' })
  @CRUD.Op({ label: '提交签署' })
  async submitSigning(data?: any, options?: any) {
    return this.post('submitSigning', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-电子合同', action: '供应商回调' })
  @CRUD.Op({ label: '模拟供应商回调' })
  async providerCallback(data?: any, options?: any) {
    return this.post('providerCallback', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-电子合同', action: '撤销签署' })
  @CRUD.Op({ label: '撤销' })
  async cancelSigning(data?: any, options?: any) {
    return this.post('cancelSigning', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-电子合同', action: '归档合同' })
  @CRUD.Op({ label: '归档' })
  async archive(data?: any, options?: any) {
    return this.post('archive', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-电子合同', action: '复制重签草稿' })
  @CRUD.Op({ label: '复制重签' })
  async copyForResign(data?: any, options?: any) {
    return this.post('copyForResign', { ...options, data });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-电子合同', action: '查看签署日志' })
  @CRUD.Op({ label: '签署日志', confirmText: 'None' })
  async signingLog(params?: any, options?: any) {
    return this.get('signingLog', { ...options, params });
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-电子合同', action: '下载已签文件' })
  @CRUD.Op({ label: '下载已签文件', confirmText: 'None' })
  async downloadSignedFile(params?: any, options?: any) {
    return this.get('downloadSignedFile', { ...options, params });
  }
}

export const electronicContractService = new ElectronicContractService();
