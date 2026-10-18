import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { customerService } from '../../api/customer-service';
import {
  buildDictOptionsLoader,
  buildEnumOptionsLoader,
  buildModuleOptionsLoader,
  confidentialLevelOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
  userOptionsLoader,
  withModuleCrudConfig,
} from '../api-module';

// 客户仅引用已有法律主体，主体资料仍在法律主体页面维护。
const legalSubjectOptionsLoader = buildModuleOptionsLoader(
  '/LegalSubject/list',
  'subjectName',
  'id',
  { pageIndex: 1, pageSize: 50 },
  'containsSubjectName',
);
const typeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Customer$Type',
);
const investmentRelationOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.InvestmentRelation',
);
const levelOptionsLoader = buildDictOptionsLoader(
  'com.levin.oak.base.entities.Customer.level',
);

export const pageMeta = {
  name: 'Customer',
  title: '客户',
  description: '维护法律主体对应的直接或渠道客户资料。',
} as const;

export const customerPageCrudConfig: CrudPageConfig = withModuleCrudConfig({
  allowDelete: false,
  apiBase: '/Customer',
  domainObject: true,
  apiService: customerService,
  createPath: '/Customer/saveCustomer',
  updatePath: '/Customer/updateCustomer',
  defaultFormValues: { enable: true },
  transformSubmit: (values) => {
    // 直接客户不得携带渠道关联；服务端仍独立校验不可变字段与渠道权限。
    if (values.type !== 'ChannelCustomer') {
      const { channelPartnerId: _channelPartnerId, ...directValues } = values;
      return directValues;
    }
    return values;
  },
  fields: [
    {
      key: 'tenantId',
      label: '归属租户',
      layoutGroup: 'ownership',
      layoutGroupTitle: '管理归属',
      layoutOrder: 10,
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
      search: true,
      type: 'select',
      visibleForPlatformUser: true,
    },
    {
      key: 'id',
      label: '客户ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'legalSubjectId',
      disabledOnEdit: true,
      label: '法律主体',
      help: '请选择已有且有权访问的法律主体；主体资料请在法律主体页面维护。',
      layoutGroup: 'basic',
      layoutGroupTitle: '客户身份',
      layoutOrder: 10,
      loadOptions: legalSubjectOptionsLoader,
      remoteSearch: true,
      required: true,
      search: true,
      table: true,
      type: 'select',
      width: 220,
    },
    {
      key: 'legalSubjectName',
      label: '主体名称',
      form: false,
      table: true,
      width: 220,
    },
    {
      key: 'type',
      disabledOnEdit: true,
      label: '客户类型',
      layoutGroup: 'basic',
      layoutOrder: 20,
      loadOptions: typeOptionsLoader,
      required: true,
      search: true,
      table: true,
      type: 'select',
      width: 140,
    },
    {
      key: 'channelPartnerId',
      disabledOnEdit: true,
      label: '渠道伙伴',
      help: '渠道客户必须关联有权访问的渠道伙伴。',
      layoutGroup: 'basic',
      layoutOrder: 30,
      table: true,
      width: 180,
      validator: (value, formState) =>
        formState.type === 'ChannelCustomer' &&
        (value === undefined || value === null || String(value).trim() === '')
          ? '渠道客户请选择渠道伙伴'
          : undefined,
    },
    {
      key: 'channelPartnerName',
      label: '渠道伙伴名称',
      form: false,
      table: true,
      width: 180,
    },
    {
      key: 'orgId',
      disabledOnEdit: true,
      label: '管理组织',
      layoutGroup: 'ownership',
      layoutOrder: 20,
      required: true,
      type: 'org-tree-select',
    },
    {
      key: 'ownerId',
      disabledOnEdit: true,
      label: '所有者',
      layoutGroup: 'ownership',
      layoutOrder: 30,
      loadOptions: userOptionsLoader,
      remoteSearch: true,
      type: 'select',
    },
    {
      key: 'contactName',
      label: '联系人姓名',
      layoutGroup: 'contact',
      layoutGroupTitle: '客户联系人',
      layoutOrder: 10,
      table: true,
      width: 140,
    },
    {
      key: 'contactPhone',
      label: '联系人电话',
      layoutGroup: 'contact',
      layoutOrder: 20,
      table: true,
      width: 160,
    },
    {
      key: 'contactEmail',
      label: '联系人邮箱',
      layoutGroup: 'contact',
      layoutOrder: 30,
      table: true,
      width: 200,
    },
    {
      key: 'groupName',
      label: '分组',
      layoutGroup: 'business',
      layoutGroupTitle: '客户运营',
      layoutOrder: 10,
      table: true,
      width: 150,
    },
    { key: 'containsGroupName', label: '分组', form: false, search: true },
    {
      key: 'industries',
      label: '所属行业',
      help: '可输入多个行业，按回车确认。',
      layoutGroup: 'business',
      layoutOrder: 20,
      search: true,
      table: true,
      type: 'tags',
      width: 150,
    },
    {
      key: 'investmentRelation',
      label: '投资关系',
      layoutGroup: 'business',
      layoutOrder: 30,
      loadOptions: investmentRelationOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 130,
    },
    {
      key: 'level',
      label: '客户等级',
      layoutGroup: 'business',
      layoutOrder: 40,
      loadOptions: levelOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 120,
    },
    {
      key: 'confidentialLevel',
      label: '机密等级',
      layoutGroup: 'business',
      layoutOrder: 50,
      loadOptions: confidentialLevelOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      valueType: 'number',
      width: 120,
    },
    {
      key: 'expiredTime',
      label: '有效期至',
      layoutGroup: 'business',
      layoutOrder: 60,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'enable',
      label: '是否启用',
      layoutGroup: 'business',
      layoutOrder: 70,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
    },
    {
      key: 'remark',
      label: '客户备注',
      fullRow: true,
      layoutGroup: 'business',
      layoutOrder: 80,
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
  title: '客户',
});
