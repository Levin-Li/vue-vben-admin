import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { electronicContractService } from '../../api/electronic-contract-service';
import {
  buildEnumOptionsLoader,
  buildModuleOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
  withModuleCrudConfig,
} from '../api-module';

const confidentialLevelOptionsLoader = buildEnumOptionsLoader(
  'com.levin.commons.rbac.ConfidentialLevel',
);
const templateOptionsLoader = buildModuleOptionsLoader(
  '/EContractTemplate/list',
  'name',
  'id',
);
const eSigningTechServiceProviderOptionsLoader = buildModuleOptionsLoader(
  '/EContract/eSigningTechServiceProviders',
  'name',
  'code',
  {},
);

const sealPositionOverridesJsonSchema = {
  additionalProperties: false,
  properties: {
    effectivePositions: {
      description: '只填写需要覆盖模板默认规则的签章位置。',
      items: {
        additionalProperties: false,
        properties: {
          height: {
            description: '0 到 1，相对于页面高度',
            maximum: 1,
            minimum: 0,
            title: '相对高度',
            type: 'number',
          },
          keyword: {
            description: '优先使用关键字定位；坐标字段可作为兜底。',
            title: '关键字',
            type: 'string',
          },
          pageNo: {
            description: '从 1 开始。',
            minimum: 1,
            title: '页码',
            type: 'integer',
          },
          roleCode: {
            description: '固定为 PartyA 或 PartyB。',
            enum: ['PartyA', 'PartyB'],
            title: '签署角色',
            type: 'string',
          },
          roleName: { title: '签署角色名称', type: 'string' },
          source: {
            description: '业务页面提交的位置请使用业务覆盖。',
            enum: ['override'],
            title: '位置来源',
            type: 'string',
          },
          width: {
            description: '0 到 1，相对于页面宽度',
            maximum: 1,
            minimum: 0,
            title: '相对宽度',
            type: 'number',
          },
          x: {
            description: '0 到 1，相对于页面宽度',
            maximum: 1,
            minimum: 0,
            title: '横向相对坐标',
            type: 'number',
          },
          y: {
            description: '0 到 1，相对于页面高度',
            maximum: 1,
            minimum: 0,
            title: '纵向相对坐标',
            type: 'number',
          },
        },
        required: ['roleCode', 'source'],
        type: 'object',
      },
      title: '签章位置列表',
      type: 'array',
    },
  },
  title: '签章位置覆盖',
  type: 'object',
} as const;

export const pageMeta = {
  name: 'ElectronicContract',
  title: '电子合同',
  description: '维护电子合同和签署流程。',
} as const;

export const electronicContractPageCrudConfig: CrudPageConfig =
  withModuleCrudConfig({
    apiBase: '/EContract',
    domainObject: true,
    apiService: electronicContractService,
    createPath: '/EContract/saveDraft',
    updatePath: '/EContract/updateDraft',
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
      {
        key: 'id',
        label: '合同ID',
        form: false,
        search: true,
        table: true,
        width: 180,
      },
      { key: 'containsContractNo', label: '合同号', form: false, search: true },
      {
        key: 'contractNo',
        label: '合同号',
        required: true,
        table: true,
        width: 180,
      },
      {
        key: 'requestNo',
        label: '合同申请号',
        form: false,
        table: true,
        width: 180,
      },
      {
        key: 'name',
        label: '合同名称',
        required: true,
        search: true,
        table: true,
        width: 220,
      },
      {
        key: 'bizType',
        label: '业务类型',
        search: true,
        table: true,
        width: 140,
      },
      {
        key: 'bizOrderId',
        label: '业务订单ID',
        search: true,
        table: true,
        width: 160,
      },
      {
        key: 'category',
        label: '类别',
        required: true,
        table: true,
        width: 140,
      },
      {
        key: 'confidentialLevel',
        label: '机密等级',
        loadOptions: confidentialLevelOptionsLoader,
        type: 'select',
        valueType: 'number',
        width: 130,
      },
      {
        key: 'eSigningTechServiceProviderCode',
        label: '签署技术服务商',
        loadOptions: eSigningTechServiceProviderOptionsLoader,
        type: 'select',
        table: true,
        width: 160,
      },
      {
        key: 'templateId',
        label: '合同模板',
        loadOptions: templateOptionsLoader,
        remoteSearch: true,
        type: 'select',
        width: 220,
      },
      { key: 'fileName', label: '合同文件名', table: true, width: 220 },
      { key: 'fileUrl', label: '合同文件链接', span: 2 },
      { key: 'contentHash', label: '合同内容哈希值', width: 180 },
      { key: 'mimeType', label: '合同文件类型', width: 180 },
      {
        key: 'expireTime',
        label: '签署截止时间',
        type: 'datetime',
        table: true,
        width: 180,
      },
      {
        key: 'signingSubjectList',
        label: '甲乙双方签约主体快照',
        help: '仅支持 PartyA（甲方，签署顺序 1）与 PartyB（乙方，签署顺序 2）各一方；不支持第三方或多方签署。',
        type: 'json',
      },
      {
        key: 'sealPositionRules',
        jsonSchema: sealPositionOverridesJsonSchema,
        jsonSchemaMode: 'popup',
        label: '签章位置覆盖',
        type: 'json',
      },
      {
        key: 'status',
        label: '签署状态',
        search: true,
        table: true,
        width: 120,
        form: false,
      },
      {
        key: 'providerFlowId',
        label: '供应商流程号',
        form: false,
        table: true,
        width: 180,
      },
      {
        key: 'signedFileUrl',
        label: '已签文件链接',
        form: false,
        table: true,
        width: 220,
      },
      { key: 'signingLog', label: '签署日志', form: false, type: 'json' },
      { key: 'remark', label: '备注', type: 'textarea', span: 2 },
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
    title: '电子合同',
  });
