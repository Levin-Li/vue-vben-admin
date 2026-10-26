import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { customerService } from '../../api/customer-service';
import { getLegalSubjectStatus } from '../../api/legal-subject-status';
import { fixedCrudDataAttrTargets } from '../../api/standard-crud-data-attr-targets';
import {
  buildDictOptionsLoader,
  buildEnumOptionsLoader,
  buildModuleOptionsLoader,
  confidentialLevelOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
  withModuleCrudConfig,
} from '../api-module';
import { buildOrgAssignmentOptionsLoader } from '../org-assignment-options';

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
// 所选内部组织作为新客户节点的父级。
const customerOrgOptionsLoader = buildOrgAssignmentOptionsLoader();

export const pageMeta = {
  name: 'Customer',
  title: '客户',
  description: '快速建档并维护直接或渠道客户资料，法律主体可后续补全。',
} as const;

export const customerPageCrudConfig: CrudPageConfig = withModuleCrudConfig({
  allowDelete: false,
  apiBase: '/Customer',
  domainObject: true,
  apiService: customerService,
  dataAttrTargets: fixedCrudDataAttrTargets(customerService, {
    list: { method: 'GET', path: 'list' },
    retrieve: { method: 'GET', path: 'retrieve' },
  }),
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
      label: '法律主体',
      help: '可暂不选择，后续补全；已关联的法律主体不能更换。',
      layoutGroup: 'basic',
      layoutGroupTitle: '客户身份',
      layoutOrder: 10,
      loadOptions: legalSubjectOptionsLoader,
      remoteSearch: true,
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
      key: 'legalSubjectStatus',
      label: '主体资料状态',
      form: false,
      table: true,
      tableValue: getLegalSubjectStatus,
      export: false,
      width: 130,
    },
    {
      key: 'customerName',
      label: '客户名称',
      help: '将作为自动创建的客户组织名称。',
      layoutGroup: 'basic',
      layoutOrder: 15,
      formCreate: true,
      formEdit: false,
      required: true,
      table: false,
      detail: false,
      validator: (value) =>
        String(value ?? '').trim()
          ? undefined
          : '自动创建客户组织时请输入客户名称',
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
      formCreate: true,
      formEdit: false,
      detail: false,
      table: false,
      label: '新客户组织的内部父级',
      help: '可选；未选择时使用当前登录用户所属的内部组织。保存时创建客户外部组织节点，不可选择已有外部节点。',
      layoutGroup: 'ownership',
      layoutOrder: 20,
      loadOptions: customerOrgOptionsLoader,
      remoteSearch: true,
      type: 'select',
      placeholder: '留空使用当前用户所属组织，或搜索内部父组织',
    },
    {
      key: 'orgName',
      label: '客户组织节点',
      formCreate: false,
      formEdit: true,
      disabledOnEdit: true,
      omitOnEdit: true,
      layoutGroup: 'ownership',
      layoutOrder: 21,
      table: true,
      search: false,
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
