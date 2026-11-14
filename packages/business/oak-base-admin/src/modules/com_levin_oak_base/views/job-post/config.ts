import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { jobPostService } from '../../api/job-post-service';
import { standardCrudDataAttrTargets } from '../../api/standard-crud-data-attr-targets';
import {
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
} from '../api-module';

const jobPostTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.JobPost$Type',
);

export const pageMeta = {
  name: 'JobPost',
  title: '工作岗位管理',
  description: '维护工作岗位信息。',
} as const;

export const jobPostPageCrudConfig: CrudPageConfig = {
  apiBase: '/JobPost',
  domainObject: true,
  apiService: jobPostService,
  dataAttrTargets: standardCrudDataAttrTargets(jobPostService),
  defaultFormValues: {
    editable: true,
    enable: true,
    orderCode: 100,
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  // 单独声明详情字段，保留表格、查询和提交配置。
  detailExtraFields: [
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
      key: 'id',
      label: '岗位ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
      layoutOrder: 20,
    },
    { key: 'containsCode', label: '编码', form: false, search: true },
    { key: 'containsName', label: '名称', form: false, search: true },
    {
      key: 'code',
      layoutOrder: 40,
      label: '编码',
      required: true,
      table: true,
      width: 140,
    },
    {
      key: 'name',
      label: '名称',
      layoutOrder: 30,
      required: true,
      table: true,
      width: 160,
    },
    {
      key: 'inType',
      label: '类型',
      form: false,
      loadOptions: jobPostTypeOptionsLoader,
      multiple: true,
      search: true,
      type: 'select',
    },
    {
      key: 'type',
      label: '类型',
      layoutOrder: 50,
      loadOptions: jobPostTypeOptionsLoader,
      required: true,
      table: true,
      type: 'select',
      width: 120,
    },
    {
      key: 'gteCreateTime',
      label: '创建时间开始',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lteCreateTime',
      label: '创建时间结束',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'enable',
      label: '是否启用',
      layoutOrder: 80,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
    },
    {
      key: 'editable',
      label: '是否可编辑',
      layoutOrder: 90,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 110,
    },
    {
      key: 'orderCode',
      label: '排序代码',
      layoutOrder: 70,
      type: 'number',
    },
    {
      key: 'remark',
      label: '备注',
      fullRow: true,
      layoutOrder: 100,
      type: 'textarea',
    },
    {
      key: 'createTime',
      label: '创建时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
      layoutOrder: 110,
    },
    {
      key: 'lastUpdateTime',
      label: '更新时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
      layoutOrder: 120,
    },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '工作岗位管理',
};
