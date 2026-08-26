import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { partnerService } from '../../api/partner-service';
import {
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  FILE_STORAGE_SINGLE_UPLOAD_PATH,
  tenantOptionsLoader,
  withModuleCrudConfig,
} from '../api-module';

const subjectTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.AbstractLegalSubject$SubjectType',
);
const identityTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.AbstractLegalSubject$IdentityType',
);
const categoryOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Partner$Category',
);
export const partnerTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Partner$Type',
);
const certificationStatusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.CertificationStatus',
);

const imageField = (key: string, label: string, layoutOrder: number) => ({
  key,
  label,
  layoutGroup: 'extension',
  layoutOrder: 300 + layoutOrder,
  type: 'image' as const,
  uploadPath: FILE_STORAGE_SINGLE_UPLOAD_PATH,
});

export const partnerPageCrudConfig: CrudPageConfig = withModuleCrudConfig({
  apiBase: '/Partner',
  apiService: partnerService,
  createPath: '/Partner/savePartner',
  updatePath: '/Partner/updatePartner',
  fields: [
    {
      key: 'tenantId', label: '归属租户', layoutGroup: 'ownership', layoutOrder: 10,
      loadOptions: tenantOptionsLoader, remoteSearch: true, search: true, type: 'select', visibleForPlatformUser: true,
    },
    { key: 'id', label: '伙伴ID', fixed: 'left', form: false, search: true, table: true, width: 180 },
    {
      key: 'shortName', label: '合作伙伴简称', layoutGroup: 'basic', layoutGroupTitle: '主体信息', layoutOrder: 10,
      search: true, table: true, width: 180,
    },
    {
      key: 'subjectName', label: '主体名称', layoutGroup: 'basic', layoutOrder: 20,
      required: true, search: true, table: true, width: 220,
    },
    {
      key: 'category', label: '类别', layoutGroup: 'ownership', layoutGroupTitle: '归属与分类', layoutOrder: 20,
      loadOptions: categoryOptionsLoader, required: true, search: true, table: true, type: 'select', width: 120,
    },
    {
      key: 'type', label: '类型', layoutGroup: 'ownership', layoutOrder: 30,
      loadOptions: partnerTypeOptionsLoader, required: true, search: true, table: true, type: 'select', width: 160,
    },
    { key: 'groupName', label: '分组', layoutGroup: 'ownership', layoutOrder: 40, search: true, table: true, width: 150 },
    {
      key: 'subjectType', label: '主体类型', layoutGroup: 'basic', layoutOrder: 60,
      loadOptions: subjectTypeOptionsLoader, required: true, search: true, table: true, type: 'select', width: 140,
    },
    {
      key: 'certificationStatus', label: '认证状态', form: false,
      loadOptions: certificationStatusOptionsLoader, search: true, table: true, type: 'select', width: 140,
    },
    { key: 'taxpayerId', label: '纳税人识别号', layoutGroup: 'content', layoutGroupTitle: '主体证照与地址', layoutOrder: 10, width: 180 },
    { key: 'unifiedSocialCreditCode', label: '统一社会信用代码', layoutGroup: 'content', layoutOrder: 20, width: 200 },
    { key: 'businessLicenseNo', label: '营业执照号', layoutGroup: 'content', layoutOrder: 30, width: 180 },
    {
      key: 'identityType', label: '主体证件类型', layoutGroup: 'content', layoutOrder: 40,
      loadOptions: identityTypeOptionsLoader, type: 'select', width: 140,
    },
    { key: 'identityNo', label: '主体证件号码', layoutGroup: 'content', layoutOrder: 50, table: false, width: 180 },
    { key: 'nationCode', label: '国家编码', layoutGroup: 'content', layoutOrder: 110, width: 120 },
    { key: 'provinceCode', label: '省级行政编码', layoutGroup: 'content', layoutOrder: 120, width: 140 },
    { key: 'cityCode', label: '市级行政编码', layoutGroup: 'content', layoutOrder: 130, width: 140 },
    { key: 'districtCode', label: '区县行政编码', layoutGroup: 'content', layoutOrder: 140, width: 140 },
    { key: 'address', label: '详细地址', fullRow: true, layoutGroup: 'content', layoutNewRow: true, layoutOrder: 150, type: 'textarea' },
    { key: 'legalRepresentativeName', label: '法人姓名', layoutGroup: 'extension', layoutGroupTitle: '法人、联系人与资质照片', layoutOrder: 10, width: 140 },
    { key: 'legalRepresentativePhone', label: '法人电话', layoutGroup: 'extension', layoutOrder: 20, width: 150 },
    { key: 'legalRepresentativeIdentityNo', label: '法人身份证号', layoutGroup: 'extension', layoutOrder: 30, table: false, width: 180 },
    { key: 'contactName', label: '联系人姓名', layoutGroup: 'extension', layoutOrder: 110, required: true, table: true, width: 120 },
    { key: 'contactMobile', label: '联系人电话', layoutGroup: 'extension', layoutOrder: 120, table: true, width: 150 },
    { key: 'contactEmail', label: '联系人邮箱', layoutGroup: 'extension', layoutOrder: 130, table: true, width: 200 },
    { key: 'contactIdentityNo', label: '联系人身份证号', layoutGroup: 'extension', layoutOrder: 140, table: false, width: 180 },
    imageField('businessLicenseFileUrl', '营业执照', 10),
    imageField('legalRepresentativeIdentityFrontImageUrl', '法人身份证正面', 20),
    imageField('legalRepresentativeIdentityBackImageUrl', '法人身份证反面', 30),
    imageField('contactIdentityFrontImageUrl', '联系人身份证正面', 40),
    imageField('contactIdentityBackImageUrl', '联系人身份证反面', 50),
    imageField('storefrontImageUrl', '门头照', 60),
    { key: 'taxRegisteredAddress', label: '税务登记地址', layoutGroup: 'business', layoutGroupTitle: '结算资料', layoutOrder: 10, span: 2 },
    { key: 'taxRegisteredPhone', label: '税务登记电话', layoutGroup: 'business', layoutOrder: 20, width: 160 },
    { key: 'bankName', label: '开户行', layoutGroup: 'business', layoutOrder: 30, span: 2 },
    { key: 'bankAccount', label: '银行账号', layoutGroup: 'business', layoutOrder: 40, width: 220 },
    { key: 'invoiceEmail', label: '发票交付邮箱', layoutGroup: 'business', layoutOrder: 50, width: 220 },
    { key: 'enable', label: '是否启用', layoutGroup: 'business', layoutOrder: 10, search: true, table: true, type: 'switch', valueType: 'boolean', width: 100 },
    { key: 'certificationRejectReason', label: '认证拒绝原因', form: false, table: true, width: 220 },
    { key: 'remark', label: '备注', layoutGroup: 'remark', layoutGroupTitle: '备注', layoutOrder: 10, type: 'textarea', fullRow: true },
    { key: 'createTime', label: '创建时间', form: false, table: true, type: 'datetime', width: 180 },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '合作伙伴',
});
