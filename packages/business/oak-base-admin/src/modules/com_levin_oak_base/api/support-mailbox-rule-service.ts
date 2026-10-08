import type {
  MailboxConfig,
  MailboxRecord,
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
  basePath: '/SupportMailboxRuleAction',
  controllerClass:
    'com.levin.oak.base.controller.BizSupportMailboxRuleActionController',
  title: '支持邮箱受理规则',
  type: '业务数据-支持邮箱受理规则',
})
export class SupportMailboxRuleService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({ label: '创建受理邮箱' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-支持邮箱受理规则',
    action: '创建受理邮箱',
  })
  async create(
    data: SupportScope & { config: MailboxConfig },
  ): Promise<MailboxRecord> {
    return this.post('create', { data });
  }

  @CRUD.Op({ label: '停用受理邮箱' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-支持邮箱受理规则',
    action: '停用受理邮箱',
  })
  async disable(
    data: SupportScope & { id: string; optimisticLock: number },
  ): Promise<MailboxRecord> {
    return this.post('disable', { data });
  }

  @CRUD.Op({ label: '启用受理邮箱' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-支持邮箱受理规则',
    action: '启用受理邮箱',
  })
  async enable(
    data: SupportScope & { id: string; optimisticLock: number },
  ): Promise<MailboxRecord> {
    return this.post('enable', { data });
  }

  @CRUD.Op({ label: '查询受理邮箱' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-支持邮箱受理规则',
    action: '查询受理邮箱',
  })
  async list(
    params: SupportScope & {
      enabled?: boolean;
      pageIndex: number;
      pageSize: number;
    },
  ): Promise<SupportPage<MailboxRecord>> {
    return this.get('list', { params: toGenericSupportRequestScope(params) });
  }

  @CRUD.Op({ label: '查看受理邮箱' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-支持邮箱受理规则',
    action: '查看受理邮箱',
  })
  async retrieve(
    params: SupportScope & { id: string },
  ): Promise<MailboxRecord> {
    return this.get('retrieve', {
      params: toGenericSupportRequestScope(params),
    });
  }

  @CRUD.Op({ label: '修改受理邮箱' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-支持邮箱受理规则',
    action: '修改受理邮箱',
  })
  async update(
    data: SupportScope & {
      config: MailboxConfig;
      id: string;
      optimisticLock: number;
    },
  ): Promise<MailboxRecord> {
    return this.post('update', { data });
  }
}
export const supportMailboxRuleService = new SupportMailboxRuleService();
