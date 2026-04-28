import { CRUD, ResAuthorize, Service } from '../common/api-authorize';
import { RequestService } from '../common/request-service';
import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/Article',
  description: '资讯管理',
  title: '资讯',
  type: '业务数据-资讯',
})
export class ArticleService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-资讯',
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
    type: '业务数据-资讯',
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
    type: '业务数据-资讯',
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
    type: '业务数据-资讯',
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
    type: '业务数据-资讯',
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
    type: '业务数据-资讯',
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
    type: '业务数据-资讯',
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
    type: '业务数据-资讯',
    action: '查询列表',
  })
  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.Article',
  })
  async list(params?: any, options?: any) {
    return this.get('list', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    ignored: true,
  })
  async listPublic(params?: any, options?: any) {
    return this.get('listPublic', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-资讯',
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
    type: '业务数据-资讯',
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
    type: '业务数据-资讯',
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
    type: '业务数据-资讯',
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
    type: '业务数据-资讯',
    action: '更新',
  })
  @CRUD.Op({
    visibleOn: "(status == 'Draft' || status == 'AuditRejected')",
  })
  async update(data?: any, options?: any) {
    return this.put('update', {
      ...options,
      data,
    });
  }
}

export const articleService = new ArticleService();
