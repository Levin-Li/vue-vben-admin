import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { standardCrudDataAttrTargets } from '../../api/standard-crud-data-attr-targets';
import { uiSettingService } from '../../api/ui-setting-service';
import {
  buildDictOptionsLoader,
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
} from '../api-module';

export const GLOBAL_ORG_SELECTOR_SETTING_CODE = '全局组织与用户选择器';
export const GLOBAL_ORG_SELECTOR_SETTING_EDITOR =
  'class:com.levin.oak.base.biz.bo.component.UserOrgSelectorConfig';
export const GLOBAL_ORG_SELECTOR_SETTING_TYPE = 'Json';

const orgCategoryOptionsLoader = buildDictOptionsLoader(
  'com.levin.oak.base.entities.Org.category',
);
const orgTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Org$Type',
);
const userCategoryOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.User$Category',
);
const userTypeOptionsLoader = buildDictOptionsLoader(
  'com.levin.oak.base.entities.User.type',
);

function transformGlobalOrgSelectorSettingSubmit(values: Record<string, any>) {
  return {
    ...values,
    code: GLOBAL_ORG_SELECTOR_SETTING_CODE,
    editor: GLOBAL_ORG_SELECTOR_SETTING_EDITOR,
    type: GLOBAL_ORG_SELECTOR_SETTING_TYPE,
  };
}

export const pageMeta = {
  name: 'GlobalOrgSelectorSetting',
  title: '全局组织与用户选择器配置',
  description: '维护全局组织与用户选择器配置。',
} as const;

export const globalOrgSelectorSettingPageCrudConfig: CrudPageConfig = {
  apiBase: '/UiSetting',
  domainObject: true,
  apiService: uiSettingService,
  dataAttrTargets: standardCrudDataAttrTargets(uiSettingService),
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
  // 单独声明详情字段，保留表格、查询和提交配置。
  detailExtraFields: [
    {
      key: 'type',
      label: '设置项类型',
      layoutGroup: 'scope',
      layoutGroupOrder: -10,
      layoutGroupTitle: '适用范围',
      layoutOrder: 20,
    },
    {
      key: 'code',
      label: '设置项编码',
      layoutGroup: 'scope',
      layoutGroupOrder: -10,
      layoutGroupTitle: '适用范围',
      layoutOrder: 25,
    },
    { key: 'editor', label: '值编辑器', detail: false },
    {
      key: 'tenantName',
      label: '租户名称',
      detail: false,
    },
    {
      key: 'domainId',
      label: '领域标识',
      detail: false,
    },
    {
      key: 'creator',
      label: '创建者',
      detail: false,
    },
    {
      key: 'optimisticLock',
      label: '乐观锁版本号',
      detail: false,
    },
  ],
  fields: [
    {
      key: 'tenantId',
      label: '归属租户',
      layoutGroup: 'scope',
      layoutGroupOrder: -10,
      layoutGroupTitle: '适用范围',
      layoutOrder: 5,
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
      key: 'id',
      label: '界面设置 ID',
      layoutGroup: 'scope',
      layoutGroupOrder: -10,
      layoutGroupTitle: '适用范围',
      layoutOrder: 10,
      fixed: 'left',
      form: false,
      table: true,
      width: 180,
    },
    {
      key: 'name',
      label: '名称',
      layoutGroupTitle: '适用范围',
      layoutGroup: 'scope',
      layoutGroupOrder: -10,
      layoutOrder: 15,
      required: true,
      table: true,
      width: 180,
    },
    {
      key: 'domain',
      label: '域名',
      layoutGroupTitle: '适用范围',
      layoutGroup: 'scope',
      layoutGroupOrder: -10,
      layoutOrder: 50,
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'orgCategory',
      label: '组织类别',
      layoutGroupTitle: '适用范围',
      layoutGroup: 'scope',
      layoutGroupOrder: -10,
      layoutOrder: 35,
      loadOptions: orgCategoryOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 140,
    },
    {
      key: 'orgType',
      label: '组织类型',
      layoutGroupTitle: '适用范围',
      layoutGroup: 'scope',
      layoutGroupOrder: -10,
      layoutOrder: 30,
      loadOptions: orgTypeOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 140,
    },
    {
      key: 'userCategory',
      label: '用户类别',
      layoutGroupTitle: '适用范围',
      layoutGroup: 'scope',
      layoutGroupOrder: -10,
      layoutOrder: 45,
      loadOptions: userCategoryOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 140,
    },
    {
      key: 'userType',
      label: '用户类型',
      layoutGroupTitle: '适用范围',
      layoutGroup: 'scope',
      layoutGroupOrder: -10,
      layoutOrder: 40,
      loadOptions: userTypeOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 140,
    },
    {
      key: 'valueContent',
      label: '组织选择器配置',
      layoutGroup: 'configuration',
      layoutGroupOrder: 20,
      layoutGroupTitle: '选择器配置',
      layoutNewRow: true,
      layoutOrder: 10,
      type: 'json',
    },
    {
      key: 'orderCode',
      label: '排序代码',
      layoutGroup: 'status',
      layoutGroupOrder: 80,
      layoutGroupTitle: '状态与排序',
      layoutOrder: 10,
      type: 'number',
    },
    {
      key: 'enable',
      label: '是否启用',
      layoutGroup: 'status',
      layoutGroupOrder: 80,
      layoutGroupTitle: '状态与排序',
      layoutOrder: 20,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
    },
    {
      key: 'editable',
      label: '是否可编辑',
      layoutGroup: 'status',
      layoutGroupOrder: 80,
      layoutGroupTitle: '状态与排序',
      layoutOrder: 30,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 110,
    },
    {
      key: 'createTime',
      label: '创建时间',
      layoutOrder: 905,
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'lastUpdateTime',
      label: '更新时间',
      layoutOrder: 910,
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'remark',
      label: '备注',
      fullRow: true,
      layoutOrder: 900,
      type: 'textarea',
    },
  ],
  formMaxColumns: 3,
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '全局组织与用户选择器配置',
  transformSubmit: transformGlobalOrgSelectorSettingSubmit,
};
