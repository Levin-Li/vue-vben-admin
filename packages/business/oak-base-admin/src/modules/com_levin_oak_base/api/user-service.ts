import type { RequestOptions } from '@levin/admin-framework';

import type { UserPageOrgScope } from './user-page-scope';

import { useUserStore } from '@vben/runtime/stores';

import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';
import { withUserPageScope } from './user-page-scope';

@Service({
  basePath: '/User',
  controllerClass: 'com.levin.oak.base.controller.BizUserController',
  description: '用户管理',
  title: '用户',
  type: '系统数据-用户',
})
export class UserService extends RequestService {
  constructor(
    private readonly pageScope?: () => undefined | UserPageOrgScope,
    private readonly actor: () => Record<string, unknown> = () =>
      (useUserStore().userInfo ?? {}) as Record<string, unknown>,
  ) {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-用户',
    action: '分配角色',
  })
  async assignRoles(data?: any, options?: any) {
    return this.put('assignRoles', {
      ...options,
      data,
    });
  }

  // 后端禁用全部批量入口，不登记不可调用的CRUD方法或字段策略。
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-用户',
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
    type: '系统数据-用户',
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
    type: '系统数据-用户',
    action: '删除',
  })
  async delete(params?: any, options?: any) {
    return this.deleteRequest('delete', {
      ...options,
      params,
    });
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.User',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-用户',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get('list', {
      ...options,
      params,
    });
  }

  @CRUD.Op({
    level: 'Danger',
    successAction: 'ShowQrCode',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-用户',
    action: '重置MFA密钥',
  })
  async resetMfaSecretKey(params?: any, options?: any) {
    return this.put('resetMfaSecretKey', {
      ...options,
      params,
    });
  }

  @CRUD.Op({
    confirmText: 'None',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-用户',
    action: '查看详情',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', {
      ...options,
      params,
    });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-用户',
    action: '更新',
  })
  async update(data?: any, options?: any) {
    return this.put('update', {
      ...options,
      data,
    });
  }

  @CRUD.Op({
    successAction: 'ShowForm',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-用户',
    action: 'MFA二维码',
  })
  async viewMfaQrCode(params?: any, options?: any) {
    return this.get('viewMfaQrCode', {
      ...options,
      params,
    });
  }

  @CRUD.Op({
    opRefTargetListName: '',
    successAction: 'ShowForm',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-用户',
    action: '查看我的MFA二维码',
    onlyRequireAuthenticated: true,
  })
  async viewMyMfaQrCode(params?: any, options?: any) {
    return this.get('viewMyMfaQrCode', {
      ...options,
      params,
    });
  }

  // 同一个服务类型保留原方法授权/字段策略元数据，只在传输前绑定本页选中的范围。
  protected override request<T>(options: RequestOptions) {
    const scope = this.pageScope?.();
    return super.request<T>(
      withUserPageScope(options, scope, scope ? this.actor() : {}),
    );
  }
}

export const userService = new UserService();
