import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { settingHistoryDataService } from '../../api/setting-history-data-service';
import {
  buildDictOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
} from '../api-module';

export const pageMeta = {
  name: 'SettingHistoryData',
  title: '设置历史数据',
  description: '查询、查看和删除系统保存的设置历史记录。',
} as const;

export const settingHistoryDataPageCrudConfig: CrudPageConfig = {
  apiBase: '/SettingHistoryData',
  apiService: settingHistoryDataService,
  allowCreate: false,
  allowEdit: false,
  allowDelete: true,
  allowRetrieve: true,
  defaultQuery: { pageIndex: 1, pageSize: 10 },
  fields: [
    {
      key: 'tenantId',
      label: '归属租户',
      search: true,
      type: 'select',
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
      visibleForPlatformUser: true,
    },
    {
      key: 'containsTitle',
      label: '标题',
      form: false,
      detail: false,
      search: true,
    },
    {
      key: 'bizType',
      label: '业务类型',
      search: true,
      table: true,
      type: 'select',
      loadOptions: buildDictOptionsLoader(
        'com.levin.oak.base.entities.SettingHistoryData.bizType',
      ),
      width: 240,
    },
    {
      key: 'bizDataId',
      label: '业务数据 ID',
      search: true,
      table: true,
      width: 200,
    },
    {
      key: 'gteCreateTime',
      label: '版本时间开始',
      form: false,
      detail: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lteCreateTime',
      label: '版本时间结束',
      form: false,
      detail: false,
      search: true,
      type: 'datetime',
    },
    { key: 'title', label: '标题', table: true, width: 280 },
    {
      key: 'createTime',
      label: '版本时间',
      table: true,
      type: 'datetime',
      width: 180,
    },
    { key: 'remark', label: '备注', table: true, width: 200 },
    {
      key: '__tenant',
      label: '归属租户',
      detail: false,
      table: true,
      type: 'tenant',
      visibleForPlatformUser: true,
      width: 180,
    },
    {
      key: 'tenantName',
      label: '租户名称',
      detail: false,
      form: false,
      table: false,
    },
    { key: 'id', label: '历史记录 ID', form: false },
    { key: 'creator', label: '创建者', form: false },
    { key: 'editor', label: '编辑器', form: false },
    {
      key: 'content',
      label: '数据内容',
      form: false,
      fullRow: true,
      type: 'json',
    },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: pageMeta.title,
};
