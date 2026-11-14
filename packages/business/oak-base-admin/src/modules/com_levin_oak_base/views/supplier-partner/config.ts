import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { fixedCrudDataAttrTargets } from '../../api/standard-crud-data-attr-targets';
import { supplierPartnerService } from '../../api/supplier-partner-service';
import {
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  withModuleCrudConfig,
} from '../api-module';
import {
  partnerCommonComplexGroups,
  partnerCommonFields,
} from '../partner/config';

// 独立子类型入口承载本类合作关系的权限与业务字段。

export const pageMeta = {
  name: 'SupplierPartner',
  title: '供应伙伴',
  description: '快速建档并维护供应伙伴，法律主体可后续补全。',
} as const;
export const supplierPartnerPageCrudConfig: CrudPageConfig =
  withModuleCrudConfig({
    allowDelete: false,
    apiBase: '/SupplierPartner',
    domainObject: true,
    apiService: supplierPartnerService,
    listOperations: [
      { key: 'SupplierPartner:quickAdd', label: '快捷添加', placement: 'left' },
    ],
    dataAttrTargets: fixedCrudDataAttrTargets(supplierPartnerService, {
      retrieve: { method: 'GET', path: 'retrieve' },
    }),
    listPath: '/SupplierPartner/list',
    createPath: '/SupplierPartner/saveSupplierPartner',
    updatePath: '/SupplierPartner/updateSupplierPartner',
    defaultFormValues: { enable: true },
    complexGroups: partnerCommonComplexGroups,
    modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
    title: '供应伙伴',
    detailExtraFields: [
      { key: 'tenantName', label: '租户名称', detail: false },
      { key: 'subjectOrgId', label: '主体组织' },
      { key: 'subjectUserId', label: '主体方负责人' },
      { key: 'businessOrgId', label: '商务对接部门' },
      { key: 'businessUserId', label: '商务对接人' },
      { key: 'presalesOrgId', label: '售前组织' },
      { key: 'presalesUserId', label: '售前方负责人' },
      { key: 'aftersalesOrgId', label: '售后组织' },
      { key: 'aftersalesUserId', label: '售后方负责人' },
      { key: 'financeOrgId', label: '财务组织' },
      { key: 'financeUserId', label: '财务方负责人' },
      { key: 'subjectOrg', label: '主体组织', detail: false },
      { key: 'subjectUser', label: '主体方负责人', detail: false },
      { key: 'businessOrg', label: '商务对接部门', detail: false },
      { key: 'businessUser', label: '商务对接人', detail: false },
      { key: 'presalesOrg', label: '售前组织', detail: false },
      { key: 'presalesUser', label: '售前方负责人', detail: false },
      { key: 'aftersalesOrg', label: '售后组织', detail: false },
      { key: 'aftersalesUser', label: '售后方负责人', detail: false },
      { key: 'financeOrg', label: '财务组织', detail: false },
      { key: 'financeUser', label: '财务方负责人', detail: false },
      { key: 'legalSubject', label: '法律主体', detail: false },
      { key: 'bankAccountHash', label: '专用银行账户哈希值', detail: false },
      { key: 'invoiceInfoHash', label: '专用开票资料哈希值', detail: false },
      { key: 'shippingInfoHash', label: '专用邮寄资料哈希值', detail: false },
      {
        key: 'lastStatusTime',
        label: '最后状态变更时间',
        type: 'datetime',
        layoutGroup: 'basic',
        layoutGroupOrder: 10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 150,
      },
      { key: 'lastStatusDesc', label: '最后状态说明' },
      { key: 'actionLog', label: '流程日志', detail: false },
      {
        key: 'supportEventsByCurrentStatus',
        label: '当前状态可执行动作',
        detail: false,
      },
      { key: 'domainId', label: '领域标识' },
      { key: 'creator', label: '创建者' },
      {
        key: 'lastUpdateTime',
        label: '更新时间',
        type: 'datetime',
        layoutGroup: 'audit',
        layoutGroupOrder: 100,
        layoutGroupTitle: '维护时间',
        layoutOrder: 20,
      },
      { key: 'orderCode', label: '排序代码' },
      { key: 'editable', label: '是否可编辑' },
      { key: 'optimisticLock', label: '乐观锁版本号', detail: false },
      { key: 'bankAccount', label: '结算账户信息', detail: false },
      { key: 'invoiceInfo', label: '开票信息', detail: false },
      { key: 'contactInfo', label: '合作联系人', detail: false },
      { key: 'shippingInfo', label: '收寄信息', detail: false },
    ],
    fields: [
      ...partnerCommonFields,
      {
        key: 'type',
        label: '供应商类型',
        required: true,
        table: true,
        type: 'select',
        loadOptions: buildEnumOptionsLoader(
          'com.levin.oak.base.entities.SupplierPartner$Type',
        ),
        layoutGroup: 'basic',
        layoutGroupOrder: 10,
        layoutOrder: 45,
        layoutGroupTitle: '基础信息',
      },
    ],
  });
