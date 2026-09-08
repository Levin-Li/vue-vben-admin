import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

export interface BackendFixedJobUpdate {
  configData?: Record<string, unknown>;
  enable?: boolean;
  forceUpdateFields?: 'remark'[];
  id: string;
  name?: string;
  optimisticLock: number;
  remark?: null | string;
}

@Service({
  basePath: '/BackendFixedJob',
  controllerClass: 'com.levin.oak.base.controller.BizBackendFixedJobController',
  description: '查看后端注册的固定定时任务，维护名称、描述、启用状态和配置。',
  title: '后端固定定时任务',
  type: '平台数据-后端固定定时任务',
})
export class BackendFixedJobService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.BackendFixedJob',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-后端固定定时任务',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get('list', { ...options, params });
  }

  @CRUD.Op({ confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-后端固定定时任务',
    action: '查看详情',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', { ...options, params });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-后端固定定时任务',
    action: '更新',
  })
  async update(data: BackendFixedJobUpdate, options?: any) {
    return this.put('update', { ...options, data });
  }
}

export const backendFixedJobService = new BackendFixedJobService();
