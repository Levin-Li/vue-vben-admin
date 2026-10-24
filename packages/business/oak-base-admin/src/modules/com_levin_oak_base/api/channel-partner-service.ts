import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';
import { withLegalSubjectStatus } from './legal-subject-status';

@Service({
  basePath: '/ChannelPartner',
  controllerClass: 'com.levin.oak.base.controller.BizChannelPartnerController',
  description: '渠道伙伴管理',
  title: '渠道伙伴',
  type: '业务数据-渠道伙伴',
})
export class ChannelPartnerService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({
    label: '保存渠道伙伴',
    opRefTargetType: 'None',
    confirmText: 'None',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-渠道伙伴',
    action: '保存渠道伙伴',
  })
  async create(data?: any, options?: any) {
    return this.post('saveChannelPartner', { ...options, data });
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.ChannelPartner',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-渠道伙伴',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get('list', { ...options, params });
  }

  @CRUD.Op({ confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-渠道伙伴',
    action: '查看详情',
  })
  async retrieve(params?: any, options?: any) {
    return withLegalSubjectStatus(
      await this.get('retrieve', { ...options, params }),
    );
  }

  @CRUD.Op({ confirmText: 'None', label: '更新渠道伙伴' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-渠道伙伴',
    action: '更新渠道伙伴',
  })
  async update(data?: any, options?: any) {
    return this.put('updateChannelPartner', { ...options, data });
  }
}

export const channelPartnerService = new ChannelPartnerService();
