import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

/** 本人公告来源不返回受众配置、审核意见、日志或管理状态。 */
export interface NoticeSourceInfo {
  category?: string;
  content: string;
  contentType: string;
  expiredTime?: string;
  id: string;
  level?: string;
  publishTime?: string;
  subtitle?: string;
  title: string;
}

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

  @CRUD.Op({
    visibleOn: "status == 'Offline'",
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
    action: '存档',
  })
  async archived(params?: any, options?: any) {
    return this.post('archived', {
      ...options,
      params,
    });
  }

  @CRUD.Op({
    visibleOn: "status == 'AuditPending'",
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
    action: '审核通过',
  })
  async auditApproved(params?: any, options?: any) {
    return this.post('auditApproved', {
      ...options,
      params,
    });
  }

  @CRUD.Op({
    visibleOn: "(status == 'Draft' || status == 'AuditRejected')",
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
    action: '提交审核',
  })
  async auditCommit(params?: any, options?: any) {
    return this.post('auditCommit', {
      ...options,
      params,
    });
  }

  @CRUD.Op({
    visibleOn: "status == 'AuditPending'",
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
    action: '审核拒绝',
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

  @CRUD.Op({
    opRefTargetType: 'None',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
    action: '新增',
  })
  async create(data?: any, options?: any) {
    return this.post('create', {
      ...options,
      data,
    });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
    action: '删除',
  })
  async delete(params?: any, options?: any) {
    return this.deleteRequest('delete', {
      ...options,
      params,
    });
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.Notice',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
    action: '查询列表',
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
    action: '查看本人公告',
    onlyRequireAuthenticated: true,
  })
  async myDetail(noticeId: string): Promise<NoticeSourceInfo> {
    return this.get('myDetail', { params: { noticeId } });
  }

  @CRUD.Op({
    visibleOn: "status == 'Published'",
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
    action: '下架',
  })
  async offline(params?: any, options?: any) {
    return this.post('offline', {
      ...options,
      params,
    });
  }

  @CRUD.Op({
    visibleOn: "(status == 'Approved' || status == 'Offline')",
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
    action: '发布上线',
  })
  async publish(params?: any, options?: any) {
    return this.post('publish', {
      ...options,
      params,
    });
  }

  @CRUD.Op({
    confirmText: 'None',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
    action: '查看详情',
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

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知',
    action: '更新',
  })
  async update(data?: any, options?: any) {
    return this.put('update', {
      ...options,
      data,
    });
  }
}

export const noticeService = new NoticeService();
