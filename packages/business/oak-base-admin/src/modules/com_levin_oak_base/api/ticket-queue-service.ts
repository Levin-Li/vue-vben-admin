import type {
  QueueInput,
  QueueRecord,
  SupportPage,
  SupportScope,
} from './support-workbench-types';

import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';
import { toGenericSupportRequestScope } from './support-request-scope';

/** 只绑定独立业务控制器，不使用私有实体的默认 CRUD。 */
@Service({
  basePath: '/TicketQueueAction',
  controllerClass: 'com.levin.oak.base.controller.TicketQueueActionController',
  title: '工单受理队列',
  type: '业务数据-工单受理队列',
})
export class TicketQueueService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({ label: '查询工单受理队列' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-工单受理队列',
    action: '查询工单受理队列',
  })
  async list(
    params: SupportScope & {
      code?: string;
      pageIndex: number;
      pageSize: number;
    },
  ): Promise<SupportPage<QueueRecord>> {
    return this.get('list', { params: toGenericSupportRequestScope(params) });
  }

  @CRUD.Op({ label: '查看工单受理队列' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-工单受理队列',
    action: '查看工单受理队列',
  })
  async retrieve(params: SupportScope & { id: string }): Promise<QueueRecord> {
    return this.get('retrieve', {
      params: toGenericSupportRequestScope(params),
    });
  }

  @CRUD.Op({ label: '保存工单受理队列' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-工单受理队列',
    action: '保存工单受理队列',
  })
  async save(data: QueueInput): Promise<QueueRecord> {
    const {
      tenantId,
      orgId,
      id,
      optimisticLock,
      code,
      name,
      enabled,
      handlerUserIds,
      handlerRoleCodes,
    } = data;
    return this.post('save', {
      data: {
        tenantId,
        orgId,
        id,
        optimisticLock,
        code,
        name,
        enabled,
        handlerUserIds,
        handlerRoleCodes,
      },
    });
  }

  @CRUD.Op({ label: '启用或停用工单受理队列' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-工单受理队列',
    action: '启用或停用工单受理队列',
  })
  async setEnabled(
    data: SupportScope & {
      enabled: boolean;
      id: string;
      optimisticLock: number;
    },
  ): Promise<QueueRecord> {
    return this.post('setEnabled', { data });
  }
}
export const ticketQueueService = new TicketQueueService();
