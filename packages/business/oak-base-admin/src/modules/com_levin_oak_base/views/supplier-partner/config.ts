import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { fixedCrudDataAttrTargets } from '../../api/standard-crud-data-attr-targets';
import { supplierPartnerService } from '../../api/supplier-partner-service';
import {
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  withModuleCrudConfig,
} from '../api-module';
import { buildOrgAssignmentOptionsLoader } from '../org-assignment-options';
import {
  partnerCommonComplexGroups,
  partnerCommonFields,
} from '../partner/config';

// 独立子类型入口承载本类合作关系的权限与业务字段。
const supplierOrgOptionsLoader = buildOrgAssignmentOptionsLoader();

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
    fields: [
      ...partnerCommonFields.map((field) =>
        field.key === 'orgId'
          ? {
              ...field,
              label: '新供应伙伴组织的内部父级',
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
