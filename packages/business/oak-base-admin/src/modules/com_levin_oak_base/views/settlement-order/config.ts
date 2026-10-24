import type { DetailDisplayEntry } from '@levin/admin-framework/framework-commons/shared/detail-display';
import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import type { SettlementRecord } from '../../api/settlement-order-service';
import type { SettlementActionMethod } from './actions';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { settlementOrderService } from '../../api/settlement-order-service';
import {
  buildEnumOptionsLoader,
  buildModuleOptionsLoader,
  tenantOptionsLoader,
  withModuleCrudConfig,
} from '../api-module';
import {
  canRunSettlementAction,
  positiveMoney,
  settlementActions,
} from './actions';

export const pageMeta = {
  name: 'SettlementOrder',
  title: '结算单',
  description: '维护合作关系结算、分笔打款及授权财务资料。',
} as const;
// 财务资料权限与其它动作同样从 API 方法注解读取。
export const settlementFinancialPermission = buildApiMethodPermissions(
  settlementOrderService,
  'readFinancialDetails',
);
const partnerOptions = buildModuleOptionsLoader(
  '/Partner/list',
  'displayName',
  'id',
  { pageIndex: 1, pageSize: 50 },
  'containsDisplayName',
);

const financialContentFields = [
  { key: 'payeeBankAccount', label: '收款账户' },
  { key: 'payerInvoiceInfo', label: '付款方开票资料' },
  { key: 'invoiceDocuments', label: '发票单据' },
  { key: 'paymentDocuments', label: '付款单据' },
  { key: 'settlementContent', label: '结算业务内容' },
] as const;

// 财务详情只承载专用接口实际返回的字段组，未知或未授权组不生成展示项。
export function buildSettlementFinancialEntries(
  record?: SettlementRecord,
): DetailDisplayEntry[] {
  return financialContentFields
    .filter((group) => {
      const value = record?.[group.key];
      return value !== null && value !== undefined;
    })
    .map((group) => ({
      key: group.key,
      kind: 'json',
      label: group.label,
      value: record?.[group.key],
      field: { key: group.key, label: group.label, type: 'json' },
    }));
}

// 只提交保存 DTO 的字段；金额、时间及内容按有效参与字段校验，不恢复被排除项。
export function validateSettlementSave(
  values: Record<string, any>,
  editing: null | Record<string, any>,
) {
  if ('settlementAmount' in values) {
    const error = positiveMoney(values.settlementAmount);
    if (error) throw new Error(error);
    if (
      editing &&
      String(values.settlementAmount) !== String(editing.settlementAmount)
    )
      throw new Error('金额调整请使用协商调整金额操作');
  }
  if (
    values.startTime &&
    values.endTime &&
    new Date(values.endTime).getTime() <= new Date(values.startTime).getTime()
  )
    throw new Error('结算结束时间必须晚于开始时间');
  if ('settlementContent' in values) {
    const content =
      typeof values.settlementContent === 'string'
        ? JSON.parse(values.settlementContent)
        : values.settlementContent;
    if (
      !content ||
      Array.isArray(content) ||
      typeof content !== 'object' ||
      Object.keys(content).length === 0
    )
      throw new Error('结算内容必须为非空 JSON 对象');
    values = { ...values, settlementContent: content };
  }
  return values;
}

export function buildSettlementPageConfig(
  openAction: (
    method: SettlementActionMethod,
    record: SettlementRecord,
  ) => Promise<unknown>,
  openFinancial: (record: SettlementRecord) => Promise<unknown>,
): CrudPageConfig {
  return withModuleCrudConfig({
    apiBase: '/SettlementOrder',
    apiService: settlementOrderService,
    listPath: '/SettlementOrder/list',
    detailPath: '/SettlementOrder/retrieve',
    domainObject: true,
    title: '结算单',
    allowDelete: false,
    editVisibleOn: "status == 'PendingConfirmation'",
    createPath: '/SettlementOrder/saveSettlementOrder',
    updatePath: '/SettlementOrder/updateSettlementOrder',
    defaultFormValues: { currencyCode: 'CNY' },
    modalWidth: 1080,
    fields: [
      {
        key: 'id',
        label: '结算单ID',
        form: false,
        search: true,
        table: true,
        width: 180,
      },
      {
        key: 'tenantId',
        label: '归属租户',
        type: 'select',
        loadOptions: tenantOptionsLoader,
        visibleForPlatformUser: true,
        search: true,
        layoutGroup: 'identity',
        layoutGroupTitle: '结算关系',
        layoutOrder: 5,
      },
      {
        key: 'orgId',
        label: '管理组织',
        type: 'org-tree-select',
        disabledOnEdit: true,
        search: true,
        layoutGroup: 'identity',
        layoutOrder: 10,
      },
      {
        key: 'partnerId',
        label: '合作伙伴',
        type: 'select',
        loadOptions: partnerOptions,
        remoteSearch: true,
        required: true,
        disabledOnEdit: true,
        omitOnEdit: true,
        search: true,
        table: true,
        layoutGroup: 'identity',
        layoutOrder: 20,
      },
      {
        key: 'startTime',
        label: '结算开始时间',
        type: 'datetime',
        required: true,
        table: true,
        layoutGroup: 'settlement',
        layoutGroupTitle: '结算信息',
        layoutOrder: 10,
      },
      {
        key: 'endTime',
        label: '结算结束时间',
        type: 'datetime',
        required: true,
        table: true,
        help: '结算范围包含开始时刻，不包含结束时刻。',
        layoutGroup: 'settlement',
        layoutOrder: 20,
      },
      {
        key: 'gteStartTime',
        label: '结算开始时间开始',
        type: 'datetime',
        form: false,
        search: true,
      },
      {
        key: 'lteStartTime',
        label: '结算开始时间结束',
        type: 'datetime',
        form: false,
        search: true,
      },
      {
        key: 'gteEndTime',
        label: '结算结束时间开始',
        type: 'datetime',
        form: false,
        search: true,
      },
      {
        key: 'lteEndTime',
        label: '结算结束时间结束',
        type: 'datetime',
        form: false,
        search: true,
      },
      {
        key: 'settlementAmount',
        label: '当前结算金额',
        required: true,
        disabledOnEdit: true,
        table: true,
        validator: positiveMoney,
        layoutGroup: 'settlement',
        layoutOrder: 30,
      },
      {
        key: 'currencyCode',
        label: '币种',
        maxLength: 3,
        table: true,
        search: true,
        disabledOnEdit: true,
        validator: (value) =>
          value && !/^[A-Z]{3}$/.test(value)
            ? '请输入三个大写字母的币种代码'
            : undefined,
        layoutGroup: 'settlement',
        layoutOrder: 40,
      },
      // 动态结算业务内容没有固定 Schema，按完整 JSON 对象编辑，禁止当作查询或列表字段。
      {
        key: 'settlementContent',
        label: '结算内容',
        type: 'json',
        jsonSchemaEditor: true,
        jsonSchemaMode: 'popup',
        required: true,
        complexValue: true,
        fullRow: true,
        table: false,
        export: false,
        detail: false,
        layoutGroup: 'content',
        layoutGroupTitle: '结算业务内容',
        layoutOrder: 10,
      },
      {
        key: 'initialSettlementAmount',
        label: '原始结算金额',
        form: false,
        table: true,
      },
      { key: 'paidAmount', label: '已打款金额', form: false, table: true },
      {
        key: 'status',
        label: '结算状态',
        form: false,
        table: true,
        type: 'select',
        loadOptions: buildEnumOptionsLoader(
          'com.levin.oak.base.entities.enums.SettlementStatus',
        ),
      },
      {
        key: 'inStatus',
        label: '结算状态',
        form: false,
        search: true,
        type: 'select',
        multiple: true,
        loadOptions: buildEnumOptionsLoader(
          'com.levin.oak.base.entities.enums.SettlementStatus',
        ),
      },
    ],
    transformSubmit: validateSettlementSave,
    rowActions: [
      ...settlementActions.map((action) => ({
        label: action.label,
        displayKey: action.method,
        confirmText: 'None',
        flowFormFields:
          action.method === 'adjustAmount' ? undefined : ['remark'],
        successMessage: false as const,
        permission: buildApiMethodPermissions(
          settlementOrderService,
          action.method,
        ),
        visible: (record: Record<string, any>) =>
          canRunSettlementAction(action.method, record as SettlementRecord),
        handler: (record: SettlementRecord) =>
          openAction(action.method, record),
      })),
      {
        label: '查看结算资料',
        displayKey: 'readFinancialDetails',
        confirmText: 'None',
        permission: settlementFinancialPermission,
        successMessage: false,
        reloadAfterAction: false,
        handler: openFinancial,
      },
    ],
  });
}

// 路由查询设置可以读取静态字段定义，不在模块初始化时发起业务请求。
export const settlementOrderPageCrudConfig = buildSettlementPageConfig(
  async () => undefined,
  async () => undefined,
);
