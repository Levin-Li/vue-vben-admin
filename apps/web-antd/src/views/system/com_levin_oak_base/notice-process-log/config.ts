import type { CrudPageConfig } from '../../shared/types';

import {
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
} from '../api-module';

const noticeProcessStatusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.NoticeProcessLog$Status',
);

export const noticeProcessLogPageCrudConfig: CrudPageConfig = {
  apiBase: '/NoticeProcessLog',
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  fields: [
    {
      key: 'tenantId',
      label: '归属租户',
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
      search: true,
      type: 'select',
      visibleForSaasUser: true,
    },
    {
      key: '__tenant',
      label: '归属租户',
      fixed: 'left',
      form: false,
      table: true,
      type: 'tenant',
      visibleForSaasUser: true,
      width: 180,
    },
    {
      key: 'id',
      label: '处理日志ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'noticeId',
      label: '通知ID',
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'inStatus',
      label: '处理状态',
      form: false,
      loadOptions: noticeProcessStatusOptionsLoader,
      multiple: true,
      search: true,
      type: 'select',
    },
    {
      key: 'status',
      label: '处理状态',
      loadOptions: noticeProcessStatusOptionsLoader,
      table: true,
      type: 'select',
      width: 120,
    },
    {
      key: 'remark',
      label: '备注',
      fullRow: true,
      type: 'textarea',
    },
    {
      key: 'createTime',
      label: '创建时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  permissionResourceName: '通知处理日志',
  permissionTypePrefix: '业务数据-',
  title: '通知处理日志管理',
};
