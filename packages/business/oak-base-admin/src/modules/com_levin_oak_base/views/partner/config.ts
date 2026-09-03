import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { partnerService } from '../../api/partner-service';
import {
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
  withModuleCrudConfig,
} from '../api-module';
import {
  getSubjectIdentityHelp,
  getSubjectIdentityImageHelp,
  getSubjectIdentityImageLabel,
  getSubjectIdentityLabel,
  getSubjectIdentityPlaceholder,
  validateSubjectIdentity,
} from '../legal-subject/subject-identity';

const subjectTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.LegalSubjectType',
);
const identityTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.IdentityType',
);
const categoryOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Partner$Category',
);
export const partnerTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Partner$SubCategory',
);
const certificationStatusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.CertificationStatus',
);
const investmentRelationOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Partner$InvestmentRelation',
);

const imageField = (
  key: string,
  label: string,
  layoutOrder: number,
  complexGroupKey?: string,
) => ({
  complexGroupKey,
  key,
  label,
  layoutGroup: 'extension',
  layoutOrder: 300 + layoutOrder,
  type: 'image' as const,
});

export const partnerPageCrudConfig: CrudPageConfig = withModuleCrudConfig({
  apiBase: '/Partner',
  apiService: partnerService,
  createPath: '/Partner/savePartner',
  updatePath: '/Partner/updatePartner',
  defaultFormValues: {
    enable: true,
  },
  complexGroups: [
    {
      key: 'legal',
      title: '法人信息',
      submitKey: 'legalInfo',
      fieldMappings: {
        legalEmail: 'email',
        legalIdBackImageUrl: 'legalIdBackImageUrl',
        legalIdFrontImageUrl: 'legalIdFrontImageUrl',
        legalIdNo: 'idCard',
        legalIdType: 'idType',
        legalName: 'name',
        legalPhone: 'mobilePhone',
      },
    },
    {
      key: 'contact',
      title: '联系人信息',
      submitKey: 'contactInfo',
      fieldMappings: {
        contactEmail: 'email',
        contactIdBackImageUrl: 'legalIdBackImageUrl',
        contactIdFrontImageUrl: 'legalIdFrontImageUrl',
        contactIdNo: 'idCard',
        contactIdType: 'idType',
        contactMobile: 'mobilePhone',
        contactName: 'name',
      },
    },
    {
      key: 'invoice',
      title: '开票信息',
      submitKey: 'invoiceInfo',
      fieldMappings: {
        bankAccount: 'bankAccount',
        bankName: 'bankName',
        invoiceEmail: 'invoiceEmail',
        invoiceName: 'name',
        invoiceTaxNo: 'taxNo',
        taxRegisteredAddress: 'taxRegisteredAddress',
        taxRegisteredPhone: 'taxRegisteredPhone',
      },
    },
    {
      key: 'shipping',
      title: '邮寄信息',
      submitKey: 'shippingInfo',
      fieldMappings: {
        shippingAddress: 'address',
        shippingCityCode: 'cityCode',
        shippingContactName: 'contactName',
        shippingContactPhone: 'contactPhone',
        shippingDistrictCode: 'districtCode',
        shippingNationCode: 'nationCode',
        shippingProvinceCode: 'provinceCode',
        shippingZipCode: 'zipCode',
      },
    },
  ],
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
    { key: 'containsSubjectName', label: '主体名称', form: false, search: true },
    {
      key: 'subjectName', label: '主体名称', layoutGroup: 'basic', layoutOrder: 20,
      required: true, table: true, width: 220,
    },
    {
      key: 'category', label: '类别', layoutGroup: 'ownership', layoutGroupTitle: '归属与分类', layoutOrder: 20,
      loadOptions: categoryOptionsLoader, required: true, search: true, table: true, type: 'select', width: 120,
    },
    {
      key: 'subCategory', label: '子类别', layoutGroup: 'ownership', layoutOrder: 30,
      loadOptions: partnerTypeOptionsLoader, required: true, search: true, table: true, type: 'select', width: 160,
    },
    { key: 'containsGroupName', label: '分组', form: false, search: true },
    { key: 'groupName', label: '分组', layoutGroup: 'ownership', layoutOrder: 40, table: true, width: 150 },
    {
      key: 'industries', label: '所属行业', layoutGroup: 'ownership', layoutOrder: 50,
      help: '可输入多个行业，按回车确认。', search: true, table: true, type: 'tags', width: 150,
    },
    {
      key: 'investmentRelation', label: '投资关系', layoutGroup: 'ownership', layoutOrder: 60,
      loadOptions: investmentRelationOptionsLoader, search: true, table: true, type: 'select', width: 130,
    },
    {
      key: 'subjectType', label: '主体类型', layoutGroup: 'basic', layoutOrder: 60,
      loadOptions: subjectTypeOptionsLoader, required: true, search: true, table: true, type: 'select', width: 140,
    },
    {
      key: 'certificationStatus', label: '认证状态', form: false,
      loadOptions: certificationStatusOptionsLoader, search: true, table: true, type: 'select', width: 140,
    },
    {
      key: 'unifiedCreditNo', label: '主体身份标识', formLabel: getSubjectIdentityLabel,
      help: getSubjectIdentityHelp, layoutGroup: 'content', layoutGroupTitle: '主体证照与地址',
      layoutOrder: 10, placeholder: getSubjectIdentityPlaceholder, validator: validateSubjectIdentity, width: 200,
    },
    {
      key: 'identityType', label: '主体证件类型', layoutGroup: 'content', layoutOrder: 40,
      loadOptions: identityTypeOptionsLoader, type: 'select', width: 140,
    },
    {
      key: 'identityImg',
      label: '主体证件图片',
      formLabel: getSubjectIdentityImageLabel,
      layoutGroup: 'content',
      layoutNewRow: true,
      layoutOrder: 50,
      type: 'image',
      multiple: true,
      maxUploadCount: (formState) => formState.subjectType === 'Person' ? 2 : 1,
      help: getSubjectIdentityImageHelp,
    },
    {
      key: 'businessPremises',
      label: '营业场所照片',
      layoutGroup: 'content',
      layoutOrder: 60,
      type: 'image',
      multiple: true,
      help: '可上传多张营业场所照片。',
    },
    {
      key: 'cityCode', label: '城市编码', layoutGroup: 'content', layoutOrder: 70,
      areaCascader: { selectableLevels: ['city'], valueKey: 'cityCode' }, type: 'area-cascader', width: 140,
    },
    { key: 'legalName', label: '法人姓名', complexGroupKey: 'legal', layoutGroup: 'extension', layoutOrder: 10, required: true, width: 140 },
    { key: 'legalPhone', label: '法人电话', complexGroupKey: 'legal', layoutGroup: 'extension', layoutOrder: 20, required: true, width: 150 },
    { key: 'legalIdNo', label: '法人身份证号', complexGroupKey: 'legal', layoutGroup: 'extension', layoutOrder: 30, table: false, width: 180 },
    { key: 'legalIdType', label: '法人证件类型', complexGroupKey: 'legal', layoutGroup: 'extension', layoutOrder: 35, loadOptions: identityTypeOptionsLoader, type: 'select', width: 140 },
    imageField('legalIdFrontImageUrl', '法人身份证正面', 20, 'legal'),
    imageField('legalIdBackImageUrl', '法人身份证反面', 30, 'legal'),
    { key: 'contactName', label: '联系人姓名', complexGroupKey: 'contact', layoutGroup: 'extension', layoutOrder: 110, required: true, table: true, width: 120 },
    { key: 'contactMobile', label: '联系人电话', complexGroupKey: 'contact', layoutGroup: 'extension', layoutOrder: 120, required: true, table: true, width: 150 },
    { key: 'contactEmail', label: '联系人邮箱', complexGroupKey: 'contact', layoutGroup: 'extension', layoutOrder: 130, table: true, width: 200 },
    { key: 'contactIdNo', label: '联系人身份证号', complexGroupKey: 'contact', layoutGroup: 'extension', layoutOrder: 140, table: false, width: 180 },
    { key: 'contactIdType', label: '联系人证件类型', complexGroupKey: 'contact', layoutGroup: 'extension', layoutOrder: 145, loadOptions: identityTypeOptionsLoader, type: 'select', width: 140 },
    imageField('contactIdFrontImageUrl', '联系人身份证正面', 40, 'contact'),
    imageField('contactIdBackImageUrl', '联系人身份证反面', 50, 'contact'),
    { key: 'invoiceName', label: '开票名称', complexGroupKey: 'invoice', layoutGroup: 'business', layoutOrder: 10, required: true, span: 2 },
    { key: 'invoiceTaxNo', label: '纳税人识别号', complexGroupKey: 'invoice', layoutGroup: 'business', layoutOrder: 20, required: true, width: 180 },
    { key: 'taxRegisteredAddress', label: '税务登记地址', complexGroupKey: 'invoice', layoutGroup: 'business', layoutOrder: 30, required: true, span: 2 },
    { key: 'taxRegisteredPhone', label: '税务登记电话', complexGroupKey: 'invoice', layoutGroup: 'business', layoutOrder: 40, required: true, width: 160 },
    { key: 'bankName', label: '开户行名称', complexGroupKey: 'invoice', layoutGroup: 'business', layoutOrder: 50, required: true, width: 220 },
    { key: 'bankAccount', label: '银行账号', complexGroupKey: 'invoice', layoutGroup: 'business', layoutOrder: 60, required: true, width: 220 },
    { key: 'invoiceEmail', label: '发票交付邮箱', complexGroupKey: 'invoice', layoutGroup: 'business', layoutOrder: 70, width: 220 },
    { key: 'shippingContactName', label: '收件联系人', complexGroupKey: 'shipping', layoutGroup: 'extension', layoutOrder: 210, required: true, width: 140 },
    { key: 'shippingContactPhone', label: '收件联系电话', complexGroupKey: 'shipping', layoutGroup: 'extension', layoutOrder: 220, required: true, width: 150 },
    { key: 'shippingNationCode', label: '国家编码', complexGroupKey: 'shipping', layoutGroup: 'extension', layoutOrder: 230, maxLength: 24, width: 120 },
    { key: 'shippingProvinceCode', label: '省级行政编码', areaCascader: { selectableLevels: ['province'], valueKey: 'shippingProvinceCode' }, complexGroupKey: 'shipping', layoutGroup: 'extension', layoutOrder: 240, type: 'area-cascader', width: 140 },
    { key: 'shippingCityCode', label: '市级行政编码', areaCascader: { selectableLevels: ['city'], valueKey: 'shippingCityCode' }, complexGroupKey: 'shipping', layoutGroup: 'extension', layoutOrder: 250, type: 'area-cascader', width: 140 },
    { key: 'shippingDistrictCode', label: '区县行政编码', areaCascader: { selectableLevels: ['district'], valueKey: 'shippingDistrictCode' }, complexGroupKey: 'shipping', layoutGroup: 'extension', layoutOrder: 260, type: 'area-cascader', width: 140 },
    { key: 'shippingAddress', label: '详细地址', complexGroupKey: 'shipping', layoutGroup: 'extension', layoutOrder: 270, required: true, maxLength: 384, fullRow: true, type: 'textarea' },
    { key: 'shippingZipCode', label: '邮政编码', complexGroupKey: 'shipping', layoutGroup: 'extension', layoutOrder: 280, maxLength: 32, width: 140 },
    { key: 'enable', label: '是否启用', layoutGroup: 'business', layoutOrder: 80, search: true, table: true, type: 'switch', valueType: 'boolean', width: 100 },
    { key: 'certificationRejectReason', label: '认证拒绝原因', form: false, table: true, width: 220 },
    { key: 'remark', label: '备注', layoutGroup: 'remark', layoutGroupTitle: '备注', layoutOrder: 10, type: 'textarea', fullRow: true },
    { key: 'createTime', label: '创建时间', form: false, table: true, type: 'datetime', width: 180 },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '合作伙伴',
});
