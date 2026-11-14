import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { electronicContractService } from '../../api/electronic-contract-service';
import {
  buildEnumOptionsLoader,
  buildModuleOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  legalSubjectOptionsLoader,
  tenantOptionsLoader,
  withModuleCrudConfig,
} from '../api-module';

const confidentialLevelOptionsLoader = buildEnumOptionsLoader(
  'com.levin.commons.rbac.ConfidentialLevel',
);
const electronicContractStatusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.ElectronicContractFlowStatus',
);
const templateOptionsLoader = buildModuleOptionsLoader(
  '/EContractTemplate/list',
  'name',
  'id',
  { pageIndex: 1, pageSize: 100, status: 'Published' },
);
const eSigningTechServiceProviderOptionsLoader = buildModuleOptionsLoader(
  '/EContract/eSigningTechServiceProviders',
  'name',
  'code',
  {},
);

type ContractAction = 'archive' | 'cancelSigning' | 'submitSigning';

// 合同状态动作只调用业务接口，状态仍由服务端 FSM 校验。
function contractAction(method: ContractAction) {
  return (record: Record<string, any>) =>
    electronicContractService[method]({
      id: record.id,
      tenantId: record.tenantId,
      orgId: record.orgId,
      ownerId: record.ownerId,
    });
}

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
    // 本页新增走 createFromTemplate，字段策略须按实际 HTTP 路径解析。
    queryPermission: buildApiMethodPermissions(
      electronicContractService,
      'list',
    ),
    detailPermission: buildApiMethodPermissions(
      electronicContractService,
      'retrieve',
    ),
    editPermission: buildApiMethodPermissions(
      electronicContractService,
      'update',
    ),
    deletePermission: buildApiMethodPermissions(
      electronicContractService,
      'delete',
    ),
    deleteVisibleOn: "status == 'Draft'",
    allowCreate: true,
    createPath: '/EContract/createFromTemplate',
    createPermission: buildApiMethodPermissions(
      electronicContractService,
      'createFromTemplate',
    ),
    defaultFormValues: { counterpartyKind: 'Customer', templateValues: {} },
    // 新增只提交受控模板出约请求；编辑保留普通草稿字段。
    transformSubmit: (values, record) => {
      if (record) return values;
      const keys = [
        'tenantId',
        'orgId',
        'ownerId',
        'templateId',
        'contractNo',
        'name',
        'partyALegalSubjectId',
        'counterpartyKind',
        'counterpartyId',
        'templateValues',
        'providerCode',
      ];
      return Object.fromEntries(
        keys
          .filter((key) => values[key] !== undefined)
          .map((key) => [key, values[key]]),
      );
    },
    updatePath: '/EContract/updateDraft',
    editVisibleOn: "status == 'Draft' && !__record.templateId",
    // 单独声明详情字段，保留表格、查询和提交配置。
    detailExtraFields: [
      { key: 'orgId', label: '组织标识', detail: false },
      { key: 'ownerId', label: '所有者标识', detail: false },
      {
        key: 'tenantName',
        label: '租户名称',
        detail: false,
      },
      {
        key: 'orgName',
        label: '组织名称',
        detail: false,
      },
      {
        key: 'ownerName',
        label: '拥有者名称',
      },
      {
        key: 'owner',
        label: '所有者',
        detail: false,
      },
      {
        key: 'fileResId',
        label: '合同文件资源ID',
      },
      {
        key: 'submittedTime',
        label: '提交签署时间',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 65,
        type: 'datetime',
      },
      {
        key: 'completedTime',
        label: '签署完成时间',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 75,
        type: 'datetime',
      },
      {
        key: 'canceledTime',
        label: '撤销时间',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 80,
        type: 'datetime',
      },
      {
        key: 'archivedTime',
        label: '归档时间',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 85,
        type: 'datetime',
      },
      {
        key: 'lastCallbackTime',
        label: '最近回调时间',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 90,
        type: 'datetime',
      },
      {
        key: 'lastStatusTime',
        label: '最后一次状态变更时间',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 95,
        type: 'datetime',
      },
      {
        key: 'lastStatusDesc',
        label: '最后签约状态说明',
      },
      {
        key: 'signedFileResId',
        label: '已签文件资源ID',
      },
      {
        key: 'signedFileName',
        label: '已签文件名',
      },
      {
        key: 'signedFileHash',
        label: '已签文件哈希',
        detail: false,
      },
      {
        key: 'signedFileMimeType',
        label: '已签文件类型',
      },
      {
        key: 'signingProcessSnapshotList',
        label: '电子合同签署技术服务商过程快照列表',
        detail: false,
      },
      {
        key: 'supportEventsByCurrentStatus',
        label: '当前状态可执行事件列表',
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
        key: 'lastUpdateTime',
        label: '更新时间',
        layoutOrder: 925,
        type: 'datetime',
      },
      {
        key: 'orderCode',
        label: '排序代码',
        layoutOrder: 900,
      },
      {
        key: 'enable',
        label: '是否启用',
        layoutOrder: 905,
        type: 'switch',
      },
      {
        key: 'editable',
        label: '是否可编辑',
        layoutOrder: 910,
        type: 'switch',
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
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 5,
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
        width: 180,
      },
      { key: 'containsContractNo', label: '合同号', form: false, search: true },
      {
        key: 'contractNo',
        label: '合同号',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 20,
        required: true,
        table: true,
        width: 180,
      },
      {
        key: 'requestNo',
        label: '合同申请号',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 25,
        form: false,
        width: 180,
      },
      {
        key: 'name',
        label: '合同名称',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 15,
        required: true,
        search: true,
        table: true,
        width: 220,
      },
      {
        key: 'bizType',
        label: '业务类型',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 30,
        formCreate: false,
        search: true,
        width: 140,
      },
      {
        key: 'bizOrderId',
        label: '业务订单ID',
        formCreate: false,
        search: true,
        width: 160,
      },
      {
        key: 'category',
        label: '类别',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 35,
        formCreate: false,
        required: true,
        table: true,
        width: 140,
      },
      {
        key: 'confidentialLevel',
        label: '机密等级',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 45,
        formCreate: false,
        loadOptions: confidentialLevelOptionsLoader,
        type: 'select',
        valueType: 'number',
        width: 130,
      },
      {
        key: 'eSigningTechServiceProviderCode',
        label: '签署技术服务商',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 50,
        formCreate: false,
        loadOptions: eSigningTechServiceProviderOptionsLoader,
        type: 'select',
        width: 160,
      },
      {
        key: 'templateId',
        label: '合同模板',
        loadOptions: templateOptionsLoader,
        remoteSearch: true,
        required: true,
        formCreate: true,
        formEdit: false,
        table: true,
        type: 'select',
        width: 220,
      },
      {
        key: 'partyALegalSubjectId',
        label: '本方法律主体',
        required: true,
        formCreate: true,
        formEdit: false,
        loadOptions: legalSubjectOptionsLoader,
        remoteSearch: true,
        type: 'select',
      },
      {
        key: 'counterpartyKind',
        label: '签约对方类型',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 55,
        required: true,
        formCreate: true,
        formEdit: false,
        type: 'select',
        options: [
          { label: '客户', value: 'Customer' },
          { label: '供应伙伴', value: 'SupplierPartner' },
          { label: '渠道伙伴', value: 'ChannelPartner' },
        ],
      },
      {
        key: 'counterpartyId',
        label: '签约对方',
        required: true,
        formCreate: true,
        formEdit: false,
        type: 'select',
      },
      {
        key: 'templateValues',
        label: '模板变量',
        formCreate: true,
        formEdit: false,
        type: 'json',
        span: 2,
      },
      {
        key: 'providerCode',
        label: '签署技术服务商',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 60,
        formCreate: true,
        formEdit: false,
        loadOptions: eSigningTechServiceProviderOptionsLoader,
        type: 'select',
      },
      {
        key: 'fileName',
        label: '合同文件名',
        form: false,
        width: 220,
      },
      { key: 'fileUrl', label: '合同文件链接', form: false, span: 2 },
      {
        key: 'contentHash',
        label: '合同内容哈希值',
        form: false,
        width: 180,
      },
      { key: 'mimeType', label: '合同文件类型', form: false, width: 180 },
      {
        key: 'expireTime',
        label: '签署截止时间',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 70,
        form: false,
        type: 'datetime',
        table: true,
        width: 180,
      },
      {
        key: 'signingSubjectList',
        label: '甲乙双方签约主体快照',
        form: false,
        help: '仅支持 PartyA（甲方，签署顺序 1）与 PartyB（乙方，签署顺序 2）各一方；不支持第三方或多方签署。',
        type: 'json',
      },
      {
        key: 'sealPositionRules',
        form: false,
        jsonSchema: sealPositionOverridesJsonSchema,
        jsonSchemaMode: 'popup',
        label: '签章位置覆盖',
        type: 'json',
      },
      {
        key: 'status',
        label: '签署状态',
        layoutGroup: 'basic',
        layoutGroupOrder: -10,
        layoutGroupTitle: '基础信息',
        layoutOrder: 40,
        loadOptions: electronicContractStatusOptionsLoader,
        search: true,
        table: true,
        width: 120,
        form: false,
        type: 'select',
      },
      {
        key: 'providerFlowId',
        label: '供应商流程号',
        form: false,
        width: 180,
      },
      {
        key: 'signedFileUrl',
        label: '已签文件链接',
        form: false,
        width: 220,
      },
      { key: 'signingLog', label: '签署日志', form: false, type: 'json' },
      {
        key: 'remark',
        label: '备注',
        layoutOrder: 915,
        formCreate: false,
        type: 'textarea',
        span: 2,
      },
      {
        key: 'createTime',
        label: '创建时间',
        layoutOrder: 920,
        form: false,
        table: true,
        type: 'datetime',
        width: 180,
      },
    ],
    modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
    rowActions: [
      {
        label: '提交签署',
        handler: contractAction('submitSigning'),
        permission: buildApiMethodPermissions(
          electronicContractService,
          'submitSigning',
        ),
        visibleOn: "status == 'Draft'",
        flowFormFields: [],
      },
      {
        label: '撤销',
        handler: contractAction('cancelSigning'),
        permission: buildApiMethodPermissions(
          electronicContractService,
          'cancelSigning',
        ),
        visibleOn: "status == 'Signing'",
        flowFormFields: [],
      },
      {
        label: '归档',
        handler: contractAction('archive'),
        permission: buildApiMethodPermissions(
          electronicContractService,
          'archive',
        ),
        visibleOn:
          "(status == 'Signed' || status == 'Rejected' || status == 'Canceled' || status == 'Expired')",
        flowFormFields: [],
      },
    ],
    title: '电子合同',
  });
