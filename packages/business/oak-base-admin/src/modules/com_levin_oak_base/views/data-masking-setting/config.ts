import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { dataMaskingSettingService } from '../../api/data-masking-setting-service';
import { standardCrudDataAttrTargets } from '../../api/standard-crud-data-attr-targets';
import {
  buildDictOptionsLoader,
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
} from '../api-module';
import { validateMaskingRuleContent } from './rules';

export const pageMeta = {
  name: 'DataMaskingSetting',
  title: '数据脱敏设置',
  description: '按适用范围配置接口字段处理规则。',
} as const;

export const dataMaskingSettingPageCrudConfig: CrudPageConfig = {
  apiBase: '/DataMaskingSetting',
  apiService: dataMaskingSettingService,
  dataAttrTargets: standardCrudDataAttrTargets(dataMaskingSettingService),
  defaultFormValues: {
    editable: true,
    enable: true,
    orderCode: 100,
    valueContent: [],
  },
  defaultQuery: { pageIndex: 1, pageSize: 10 },
  domainObject: true,
  fields: [
    {
      key: 'tenantId',
      label: '归属租户',
      layoutGroup: 'scope',
      layoutGroupTitle: '适用范围',
      layoutOrder: 10,
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
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
      label: '配置 ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    { key: 'containsName', label: '名称', form: false, search: true },
    { key: 'domain', label: '域名', form: false, search: true },
    {
      key: 'orgCategory',
      label: '组织类别',
      form: false,
      search: true,
      loadOptions: buildDictOptionsLoader(
        'com.levin.oak.base.entities.Org.category',
      ),
      type: 'select',
    },
    {
      key: 'orgType',
      label: '组织类型',
      form: false,
      search: true,
      loadOptions: buildEnumOptionsLoader(
        'com.levin.oak.base.entities.Org$Type',
      ),
      type: 'select',
    },
    {
      key: 'userCategory',
      label: '用户类别',
      form: false,
      search: true,
      loadOptions: buildEnumOptionsLoader(
        'com.levin.oak.base.entities.User$Category',
      ),
      type: 'select',
    },
    {
      key: 'userType',
      label: '用户类型',
      form: false,
      search: true,
      loadOptions: buildDictOptionsLoader(
        'com.levin.oak.base.entities.User.type',
      ),
      type: 'select',
    },
    {
      key: 'name',
      label: '名称',
      layoutGroup: 'scope',
      layoutOrder: 20,
      required: true,
      table: true,
      width: 180,
    },
    {
      key: 'domain',
      label: '域名',
      layoutGroup: 'scope',
      layoutOrder: 30,
      table: true,
      width: 180,
    },
    {
      key: 'orgCategory',
      label: '组织类别',
      layoutGroup: 'scope',
      layoutOrder: 40,
      loadOptions: buildDictOptionsLoader(
        'com.levin.oak.base.entities.Org.category',
      ),
      table: true,
      type: 'select',
      width: 140,
    },
    {
      key: 'orgType',
      label: '组织类型',
      layoutGroup: 'scope',
      layoutOrder: 50,
      loadOptions: buildEnumOptionsLoader(
        'com.levin.oak.base.entities.Org$Type',
      ),
      table: true,
      type: 'select',
      width: 140,
    },
    {
      key: 'userCategory',
      label: '用户类别',
      layoutGroup: 'scope',
      layoutOrder: 60,
      loadOptions: buildEnumOptionsLoader(
        'com.levin.oak.base.entities.User$Category',
      ),
      table: true,
      type: 'select',
      width: 140,
    },
    {
      key: 'userType',
      label: '用户类型',
      layoutGroup: 'scope',
      layoutOrder: 70,
      loadOptions: buildDictOptionsLoader(
        'com.levin.oak.base.entities.User.type',
      ),
      table: true,
      type: 'select',
      width: 140,
    },
    {
      key: 'valueContent',
      label: '字段脱敏规则',
      layoutGroup: 'rules',
      layoutGroupTitle: '字段规则',
      layoutOrder: 10,
      fullRow: true,
      layoutNewRow: true,
      table: false,
      type: 'json',
    },
    {
      key: 'orderCode',
      label: '排序代码',
      layoutGroup: 'status',
      layoutGroupTitle: '状态与排序',
      layoutOrder: 10,
      type: 'number',
    },
    {
      key: 'enable',
      label: '是否启用',
      layoutGroup: 'status',
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
      layoutOrder: 30,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 110,
    },
    {
      key: 'remark',
      label: '备注',
      fullRow: true,
      layoutOrder: 10,
      type: 'textarea',
    },
  ],
  formMaxColumns: 3,
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '数据脱敏设置',
  transformSubmit(values) {
    // 先校验类型化 JSON 规则，再交给公共 CRUD 的提交流程。
    validateMaskingRuleContent(values.valueContent);
    return values;
  },
};
