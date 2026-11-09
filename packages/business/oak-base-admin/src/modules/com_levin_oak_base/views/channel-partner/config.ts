import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { channelPartnerService } from '../../api/channel-partner-service';
import { fixedCrudDataAttrTargets } from '../../api/standard-crud-data-attr-targets';
import {
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  withModuleCrudConfig,
} from '../api-module';
import {
  partnerCommonComplexGroups,
  partnerCommonFields,
} from '../partner/config';

// 独立子类型入口承载本类合作关系的权限与业务字段。

export const pageMeta = {
  name: 'ChannelPartner',
  title: '渠道伙伴',
  description: '快速建档并维护渠道伙伴，法律主体可后续补全。',
} as const;
export const channelPartnerPageCrudConfig: CrudPageConfig =
  withModuleCrudConfig({
    allowDelete: false,
    apiBase: '/ChannelPartner',
    domainObject: true,
    apiService: channelPartnerService,
    listOperations: [
      { key: 'ChannelPartner:quickAdd', label: '快捷添加', placement: 'left' },
    ],
    dataAttrTargets: fixedCrudDataAttrTargets(channelPartnerService, {
      retrieve: { method: 'GET', path: 'retrieve' },
    }),
    listPath: '/ChannelPartner/list',
    createPath: '/ChannelPartner/saveChannelPartner',
    updatePath: '/ChannelPartner/updateChannelPartner',
    defaultFormValues: { enable: true },
    complexGroups: partnerCommonComplexGroups,
    modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
    title: '渠道伙伴',
    fields: [
      ...partnerCommonFields,
      {
        key: 'type',
        label: '渠道类型',
        required: true,
        search: true,
        table: true,
        type: 'select',
        loadOptions: buildEnumOptionsLoader(
          'com.levin.oak.base.entities.ChannelPartner$Type',
        ),
        layoutGroup: 'business',
        layoutOrder: 10,
      },
    ],
  });
