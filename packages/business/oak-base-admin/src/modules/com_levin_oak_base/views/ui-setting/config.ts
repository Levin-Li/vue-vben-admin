import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { uiSettingService } from '../../api/ui-setting-service';
import {
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
} from '../api-module';

const orgTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Partner$SubCategory',
);

function transformUiSettingSubmit(
  values: Record<string, any>,
  record: null | Record<string, any>,
) {
  if (record || values.editable !== undefined) {
    return values;
  }

  return {
    ...values,
    editable: true,
  };
}

export const uiSettingPageCrudConfig: CrudPageConfig = {
  apiBase: '/UiSetting',
  apiService: uiSettingService,
  defaultFormValues: {
    editable: true,
    enable: true,
    orderCode: 100,
  },
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
      visibleForPlatformUser: true,
    },
    {
      key: '__tenant',
      label: '归属租户',
      fixed: 'left',
      form: false,
      table: true,
      type: 'tenant',
      visibleForPlatformUser: true,
      width: 180,
    },
    {
      key: 'id',
      label: '界面设置 ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    { key: 'containsName', label: '名称', form: false, search: true },
    { key: 'code', label: '设置项编码', form: false, search: true },
    { key: 'domain', label: '域名', form: false, search: true },
    {
      key: 'orgType',
      label: '组织类型',
      form: false,
      loadOptions: orgTypeOptionsLoader,
      search: true,
      type: 'select',
    },
    { key: 'userType', label: '用户类型', form: false, search: true },
    { key: 'name', label: '名称', required: true, table: true, width: 180 },
    {
      key: 'code',
      label: '设置项编码',
      required: true,
      table: true,
      width: 180,
    },
    { key: 'type', label: '设置项类型', table: true, width: 140 },
    { key: 'domain', label: '域名', table: true, width: 180 },
    {
      key: 'orgType',
      label: '组织类型',
      loadOptions: orgTypeOptionsLoader,
      table: true,
      type: 'select',
      width: 140,
    },
    { key: 'userType', label: '用户类型', table: true, width: 140 },
    {
      key: 'editor',
      label: '值编辑器',
      fullRow: true,
      type: 'text',
    },
    {
      key: 'valueContent',
      label: '内容值',
      form: false,
      table: false,
      type: 'json',
    },
    { key: 'orderCode', label: '排序代码', type: 'number' },
    {
      key: 'enable',
      label: '是否启用',
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
    },
    {
      key: 'editable',
      label: '是否可编辑',
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 110,
    },
    {
      key: 'createTime',
      label: '创建时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'lastUpdateTime',
      label: '更新时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
    { key: 'remark', label: '备注', type: 'textarea' },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '界面设置管理',
  transformSubmit: transformUiSettingSubmit,
};
