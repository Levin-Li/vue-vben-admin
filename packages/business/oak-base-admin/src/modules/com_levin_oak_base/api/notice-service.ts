import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
import { RequestService } from '@levin/admin-framework';
import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/Notice',
  controllerClass: 'com.levin.oak.base.controller.BizNoticeController',
  description: '通知管理',
  title: '通知',
  type: '业务数据-通知',
})
export class NoticeService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
    action: '存档',
  })
  @CRUD.Op({
    visibleOn: "status == 'Offline'",
  })
  async archived(params?: any, options?: any) {
    return this.post('archived', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
    action: '审核通过',
  })
  @CRUD.Op({
    visibleOn: "status == 'AuditPending'",
  })
  async auditApproved(params?: any, options?: any) {
    return this.post('auditApproved', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
    action: '提交审核',
  })
  @CRUD.Op({
    visibleOn: "(status == 'Draft' || status == 'AuditRejected')",
  })
  async auditCommit(params?: any, options?: any) {
    return this.post('auditCommit', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
    action: '审核拒绝',
  })
  @CRUD.Op({
    visibleOn: "status == 'AuditPending'",
  })
  async auditReject(params?: any, options?: any) {
    return this.post('auditReject', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
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
    type: '业务数据-通知',
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
    type: '业务数据-通知',
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
    type: '通用数据-通知',
    action: '查询列表',
    onlyRequireAuthenticated: true,
  })
  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.Notice',
  })
  async list(params?: any, options?: any) {
    return this.get('list', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '通用数据-通知',
    action: '查询我的消息',
    onlyRequireAuthenticated: true,
  })
  async myMessages(params?: any, options?: any) {
    return this.get('myMessages', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
    action: '下架',
  })
  @CRUD.Op({
    visibleOn: "status == 'Published'",
  })
  async offline(params?: any, options?: any) {
    return this.post('offline', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '通用数据-通知',
    action: '处理我的消息',
    onlyRequireAuthenticated: true,
  })
  async processMyMessage(data?: any, options?: any) {
    return this.post('processMyMessage', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
    action: '发布上线',
  })
  @CRUD.Op({
    visibleOn: "(status == 'Approved' || status == 'Offline')",
  })
  async publish(params?: any, options?: any) {
    return this.post('publish', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
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
    type: '业务数据-通知',
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
    type: '业务数据-通知',
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

export const noticeService = new NoticeService();
