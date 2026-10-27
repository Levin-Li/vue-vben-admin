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
  basePath: '/SupportMailboxSettingAction',
  controllerClass:
    'com.levin.oak.base.controller.BizSupportMailboxSettingActionController',
  title: '客服邮箱设置',
  type: '业务数据-客服邮箱设置',
})
export class SupportMailboxSettingService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({ label: '新增客服邮箱设置' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服邮箱设置',
    action: '新增客服邮箱设置',
  })
  async create(
    data: SupportScope & { config: MailboxConfig },
  ): Promise<MailboxRecord> {
    return this.post('create', { data });
  }

  @CRUD.Op({ label: '停用客服邮箱设置' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服邮箱设置',
    action: '停用客服邮箱设置',
  })
  async disable(
    data: SupportScope & { id: string; optimisticLock: number },
  ): Promise<MailboxRecord> {
    return this.post('disable', { data });
  }

  @CRUD.Op({ label: '启用客服邮箱设置' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服邮箱设置',
    action: '启用客服邮箱设置',
  })
  async enable(
    data: SupportScope & { id: string; optimisticLock: number },
  ): Promise<MailboxRecord> {
    return this.post('enable', { data });
  }

  @CRUD.Op({ label: '查询客服邮箱设置' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服邮箱设置',
    action: '查询客服邮箱设置',
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

  @CRUD.Op({ label: '查看客服邮箱设置' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服邮箱设置',
    action: '查看客服邮箱设置',
  })
  async retrieve(
    params: SupportScope & { id: string },
  ): Promise<MailboxRecord> {
    return this.get('retrieve', {
      params: toGenericSupportRequestScope(params),
    });
  }

  @CRUD.Op({ label: '修改客服邮箱设置' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服邮箱设置',
    action: '修改客服邮箱设置',
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
export const supportMailboxSettingService = new SupportMailboxSettingService();
