import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { supplierPartnerService } from '../../api/supplier-partner-service';
import {
  buildEnumOptionsLoader,
  buildModuleOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  withModuleCrudConfig,
} from '../api-module';
import {
  partnerCommonComplexGroups,
  partnerCommonFields,
} from '../partner/config';

// 独立子类型入口承载本类合作关系的权限与业务字段。
const supplierOrgOptionsLoader = buildModuleOptionsLoader(
  '/Org/list',
  'name',
  'id',
  { pageIndex: 1, pageSize: 500, type: 'SupplierPartner' },
  'containsName',
);

export const pageMeta = {
  name: 'SupplierPartner',
  title: '供应伙伴',
  description: '维护供应伙伴及法律主体关联。',
} as const;
export const supplierPartnerPageCrudConfig: CrudPageConfig =
  withModuleCrudConfig({
    allowDelete: false,
    apiBase: '/SupplierPartner',
    domainObject: true,
    apiService: supplierPartnerService,
    listPath: '/SupplierPartner/list',
    detailPath: '/SupplierPartner/retrieve',
    createPath: '/SupplierPartner/saveSupplierPartner',
    updatePath: '/SupplierPartner/updateSupplierPartner',
    defaultFormValues: { enable: true },
    complexGroups: partnerCommonComplexGroups,
    modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
    title: '供应伙伴',
    fields: [
      ...partnerCommonFields.map((field) =>
        field.key === 'orgId'
          ? {
              ...field,
              label: '供应伙伴组织节点',
              loadOptions: supplierOrgOptionsLoader,
              remoteSearch: true,
            }
          : field,
      ),
      {
        key: 'type',
        label: '供应商类型',
        required: true,
        table: true,
        type: 'select',
        loadOptions: buildEnumOptionsLoader(
          'com.levin.oak.base.entities.SupplierPartner$Type',
        ),
        layoutGroup: 'business',
        layoutOrder: 10,
      },
    ],
  });
