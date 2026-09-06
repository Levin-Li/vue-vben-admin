import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { noticeProcessLogService } from '../../api/notice-process-log-service';
import {
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
  userOptionsLoader,
} from '../api-module';

const noticeProcessStatusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.NoticeProcessLog$Status',
);

export const pageMeta = {
  name: 'NoticeProcessLog',
  title: '通知处理日志管理',
  description: '查询通知处理日志。',
} as const;

export const noticeProcessLogPageCrudConfig: CrudPageConfig = {
  apiBase: '/NoticeProcessLog',
  apiService: noticeProcessLogService,
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  fields: [
    {
      key: 'tenantId',
      label: '归属租户',
      layoutGroup: 'ownership',
      layoutOrder: 10,
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
      search: true,
      type: 'select',
      visibleForPlatformUser: true,
    },
    {
      key: '__tenant',
      detail: false,
      label: '归属租户',
      fixed: 'left',
      form: false,
      table: true,
      type: 'tenant',
      visibleForPlatformUser: true,
      width: 180,
    },
    {
      key: 'orgId',
      label: '所属组织',
      layoutGroup: 'ownership',
      layoutOrder: 20,
      type: 'org-tree-select',
    },
    {
      key: 'ownerId',
      label: '所属用户',
      layoutGroup: 'ownership',
      layoutOrder: 30,
      loadOptions: userOptionsLoader,
      remoteSearch: true,
      type: 'select',
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
      layoutGroup: 'basic',
      layoutOrder: 10,
      required: true,
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
      layoutGroup: 'basic',
      layoutOrder: 20,
      loadOptions: noticeProcessStatusOptionsLoader,
      required: true,
      table: true,
      type: 'select',
      width: 120,
    },
    {
      key: 'remark',
      label: '备注',
      fullRow: true,
      layoutGroup: 'remark',
      layoutOrder: 10,
      required: true,
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
  title: '通知处理日志管理',
};
