import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
import { RequestService } from '@levin/admin-framework';
import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/Notice',
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
