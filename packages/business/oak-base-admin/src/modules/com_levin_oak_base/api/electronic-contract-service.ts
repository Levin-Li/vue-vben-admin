import type { WorkflowRequestActor } from './workflow-request-service';

import { useUserStore } from '@vben/runtime/stores';

import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';
import { prepareWorkflowRequestScope } from './workflow-request-service';

/** 审批文档引用只包含展示元数据，不携带在线签名链接或资源定位字段。 */
export interface ContractDocumentReference {
  fileName?: string;
  hasOriginal: boolean;
  hasSigned: boolean;
  id: string;
  mimeType?: string;
  name: string;
  optimisticLock: number;
  orgId?: string;
  signedFileMimeType?: string;
  signedFileName?: string;
  status: string;
  tenantId?: string;
}

@Service({
  basePath: '/EContract',
  controllerClass: 'com.levin.oak.base.controller.BizEContractController',
  description: '电子合同管理',
  title: '电子合同',
  type: '业务数据-电子合同',
})
export class ElectronicContractService extends RequestService {
  constructor(
    private readonly currentActor: () => WorkflowRequestActor = () =>
      (useUserStore().userInfo ?? {}) as WorkflowRequestActor,
  ) {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({ label: '归档' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同',
    action: '归档合同',
  })
  async archive(data?: any, options?: any) {
    return this.post('archive', { ...options, data });
  }

  @CRUD.Op({ label: '撤销' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同',
    action: '撤销签署',
  })
  async cancelSigning(data?: any, options?: any) {
    return this.post('cancelSigning', { ...options, data });
  }

  @CRUD.Op({ label: '复制重签' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同',
    action: '复制重签草稿',
  })
  async copyForResign(data?: any, options?: any) {
    return this.post('copyForResign', { ...options, data });
  }

  @CRUD.Op({ label: '创建草稿', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同',
    action: '创建电子合同草稿',
  })
  async create(data?: any, options?: any) {
    return this.post('saveDraft', { ...options, data });
  }

  // 模板出约由服务端解析变量并冻结受控合同文件。
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同',
    action: '创建电子合同草稿',
  })
  async createFromTemplate(data: {
    contractNo: string;
    counterpartyId: string;
    counterpartyKind: 'ChannelPartner' | 'Customer' | 'SupplierPartner';
    name: string;
    partyALegalSubjectId: string;
    providerCode?: string;
    templateId: string;
    templateValues: Record<string, string>;
  }) {
    return this.post('createFromTemplate', { data });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同',
    action: '删除',
  })
  async delete(params?: any, options?: any) {
    return this.deleteRequest('delete', { ...options, params });
  }

  // 仅按已授权合同绑定和修订读取字节，禁止传入任意文件地址或文件ID。
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同',
    action: '查看详情',
  })
  async document(params: {
    id: string;
    kind: 'original' | 'signed';
    orgId?: string;
    representation: 'original' | 'pdf';
    revision: number;
    tenantId?: string;
  }): Promise<Blob> {
    const { tenantId, orgId, ...reference } = params;
    const scope = prepareWorkflowRequestScope(
      { tenantId, orgId },
      tenantId ? this.currentActor() : {},
    );
    const blob = await this.get<Blob>('use/document', {
      params: { ...reference, ...scope },
      responseType: 'blob',
    });
    if (
      !(blob instanceof Blob) ||
      ![
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ].includes(blob.type.split(';')[0] || '')
    ) {
      throw new Error(
        '文档读取失败：权限、修订或预览格式无效，请刷新合同后重试。',
      );
    }
    return blob;
  }

  // 分页表示使用标准业务JSON响应，每一页独立复核合同修订与读取权限。
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同',
    action: '查看详情',
  })
  async documentPage(params: {
    id: string;
    kind: 'original' | 'signed';
    orgId?: string;
    page: number;
    revision: number;
    tenantId?: string;
  }): Promise<unknown> {
    const { tenantId, orgId, ...reference } = params;
    const scope = prepareWorkflowRequestScope(
      { tenantId, orgId },
      tenantId ? this.currentActor() : {},
    );
    return this.get<unknown>('use/document-page', {
      params: { ...reference, ...scope },
    });
  }

  // 工作台携带业务引用，普通租户省略受保护tenantId，冲突归属必须明确拒绝。
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同',
    action: '查看详情',
  })
  async documentReference(params: {
    id: string;
    orgId?: string;
    tenantId?: string;
  }) {
    const { tenantId, orgId, id } = params;
    const scope = prepareWorkflowRequestScope(
      { tenantId, orgId },
      tenantId ? this.currentActor() : {},
    );
    const reference = await this.get<ContractDocumentReference>(
      'use/document-reference',
      { params: { id, ...scope } },
    );
    if (
      !reference ||
      reference.id !== id ||
      !Number.isInteger(reference.optimisticLock) ||
      reference.optimisticLock < 0 ||
      typeof reference.hasOriginal !== 'boolean' ||
      typeof reference.hasSigned !== 'boolean'
    ) {
      throw new Error('合同文档引用无效，请刷新后重试。');
    }
    // 显式投影允许的展示字段，即使异常响应带额外定位信息也不交给审批组件。
    return {
      id: reference.id,
      name: reference.name,
      optimisticLock: reference.optimisticLock,
      tenantId: reference.tenantId,
      orgId: reference.orgId,
      status: reference.status,
      fileName: reference.fileName,
      mimeType: reference.mimeType,
      signedFileName: reference.signedFileName,
      signedFileMimeType: reference.signedFileMimeType,
      hasOriginal: reference.hasOriginal,
      hasSigned: reference.hasSigned,
    } satisfies ContractDocumentReference;
  }

  @CRUD.Op({ label: '下载已签文件', confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同',
    action: '下载已签文件',
  })
  async downloadSignedFile(params?: any, options?: any) {
    return this.get('downloadSignedFile', { ...options, params });
  }

  @CRUD.ListTable({ refEntityClass: 'com.levin.oak.base.entities.EContract' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get('list', { ...options, params });
  }

  @CRUD.Op({ label: '模拟供应商回调' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同',
    action: '供应商回调',
  })
  async providerCallback(data?: any, options?: any) {
    return this.post('providerCallback', { ...options, data });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同',
    action: '重新生成模板合同草稿',
  })
  async regenerateFromTemplate(
    data: Parameters<ElectronicContractService['createFromTemplate']>[0] & {
      contractId: string;
    },
  ) {
    return this.post('regenerateFromTemplate', { data });
  }

  @CRUD.Op({ confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同',
    action: '查看详情',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', { ...options, params });
  }

  // 签署地址只在明确领取时获取，避免将地址写入合同详情或列表。
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据',
    res: '电子合同',
    action: '领取签署入口',
  })
  async signingEntry(params: {
    id: string;
    orgId?: string;
    ownerId?: string;
    signerIndex: 0 | 1;
    tenantId?: string;
  }) {
    return this.get<{ url: string }>('signingEntry', { params });
  }

  @CRUD.Op({ label: '签署日志', confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同',
    action: '查看签署日志',
  })
  async signingLog(params?: any, options?: any) {
    return this.get('signingLog', { ...options, params });
  }

  @CRUD.Op({ label: '提交签署' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同',
    action: '提交签署',
  })
  async submitSigning(data?: any, options?: any) {
    return this.post('submitSigning', { ...options, data });
  }

  @CRUD.Op({ label: '更新草稿' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-电子合同',
    action: '更新电子合同草稿',
  })
  async update(data?: any, options?: any) {
    return this.put('updateDraft', { ...options, data });
  }
}

export const electronicContractService = new ElectronicContractService();
