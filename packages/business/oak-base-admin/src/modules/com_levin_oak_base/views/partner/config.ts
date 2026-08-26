import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { partnerService } from '../../api/partner-service';
import {
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
  withModuleCrudConfig,
} from '../api-module';

const legalSubjectTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.AbstractLegalSubject$LegalSubjectType',
);
const identityTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.AbstractLegalSubject$IdentityType',
);

export const partnerPageCrudConfig: CrudPageConfig = withModuleCrudConfig({
  apiBase: '/Partner',
  apiService: partnerService,
  createPath: '/Partner/savePartner',
  updatePath: '/Partner/updatePartner',
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
    { key: 'id', label: '伙伴ID', form: false, search: true, table: true, width: 180 },
    { key: 'subjectName', label: '主体名称', required: true, search: true, table: true, width: 220 },
    { key: 'legalSubjectType', label: '主体类型', loadOptions: legalSubjectTypeOptionsLoader, search: true, table: true, type: 'select', width: 140 },
    { key: 'partnerCategory', label: '合作伙伴类别', search: true, table: true, width: 150 },
    { key: 'partnerType', label: '合作伙伴类型', table: true, width: 150 },
    { key: 'partnerGroup', label: '合作伙伴分组', table: true, width: 150 },
    { key: 'taxpayerId', label: '纳税人识别号', width: 180 },
    { key: 'unifiedSocialCreditCode', label: '统一社会信用代码', width: 200 },
    { key: 'businessLicenseNo', label: '营业执照号', width: 180 },
    { key: 'identityType', label: '证件类型', loadOptions: identityTypeOptionsLoader, type: 'select', width: 140 },
    { key: 'identityNo', label: '证件号码', table: false, width: 180 },
    { key: 'contactName', label: '联系人', required: true, table: true, width: 120 },
    { key: 'contactEmail', label: '联系人邮箱', table: true, width: 200 },
    { key: 'contactMobile', label: '联系人电话', table: true, width: 150 },
    { key: 'enable', label: '是否启用', search: true, table: true, type: 'switch', valueType: 'boolean', width: 100 },
    { key: 'remark', label: '备注', type: 'textarea', span: 2 },
    { key: 'createTime', label: '创建时间', form: false, table: true, type: 'datetime', width: 180 },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '合作伙伴',
});
