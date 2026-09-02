import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { uiSettingService } from '../../api/ui-setting-service';
import {
  buildDictOptionsLoader,
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
} from '../api-module';

export const GLOBAL_ORG_SELECTOR_SETTING_CODE = '全局组织选择器';
export const GLOBAL_ORG_SELECTOR_SETTING_EDITOR =
  'class:com.levin.oak.base.biz.bo.component.UserOrgSelectorConfig';
export const GLOBAL_ORG_SELECTOR_SETTING_TYPE = 'Json';

const orgCategoryOptionsLoader = buildDictOptionsLoader(
  'com.levin.oak.base.entities.Org.category',
);
const orgTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Org$Type',
);
const userCategoryOptionsLoader = buildEnumOptionsLoader('com.levin.oak.base.entities.User$Category');
const userTypeOptionsLoader = buildDictOptionsLoader('com.levin.oak.base.entities.User.type');

function transformGlobalOrgSelectorSettingSubmit(values: Record<string, any>) {
  return {
    ...values,
    code: GLOBAL_ORG_SELECTOR_SETTING_CODE,
    editor: GLOBAL_ORG_SELECTOR_SETTING_EDITOR,
    type: GLOBAL_ORG_SELECTOR_SETTING_TYPE,
  };
}

export const globalOrgSelectorSettingPageCrudConfig: CrudPageConfig = {
  apiBase: '/UiSetting',
  apiService: uiSettingService,
  defaultFormValues: {
    code: GLOBAL_ORG_SELECTOR_SETTING_CODE,
    editable: true,
    editor: GLOBAL_ORG_SELECTOR_SETTING_EDITOR,
    enable: true,
    name: GLOBAL_ORG_SELECTOR_SETTING_CODE,
    orderCode: 100,
    type: GLOBAL_ORG_SELECTOR_SETTING_TYPE,
    valueContent: {},
  },
  defaultQuery: {
    code: GLOBAL_ORG_SELECTOR_SETTING_CODE,
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
      table: true,
      width: 180,
    },
    {
      key: 'name',
      label: '名称',
      required: true,
      table: true,
      width: 180,
    },
    {
      key: 'domain',
      label: '域名',
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'orgCategory',
      label: '组织类别',
      loadOptions: orgCategoryOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 140,
    },
    {
      key: 'orgType',
      label: '组织类型',
      loadOptions: orgTypeOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 140,
    },
    { key: 'userCategory', label: '用户类别', loadOptions: userCategoryOptionsLoader, search: true, table: true, type: 'select', width: 140 },
    {
      key: 'userType',
      label: '用户类型',
      loadOptions: userTypeOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 140,
    },
    {
      key: 'valueContent',
      label: '组织选择器配置',
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
    { key: 'remark', label: '备注', fullRow: true, type: 'textarea' },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '全局组织选择器配置',
  transformSubmit: transformGlobalOrgSelectorSettingSubmit,
};
