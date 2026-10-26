import type {
  CrudApiService,
  CrudFieldConfig,
  CrudPageConfig,
  CrudRowAction,
} from '@levin/admin-framework/framework-commons/shared/types';

import type {
  InvitationLinkListQuery,
  InvitationRegistrationChannel,
  InvitationTarget,
  InvitationUsageMode,
  InvitationUserType,
} from '../../api/invitation-link-service';

import { getCrudOpMeta } from '@levin/admin-framework/framework-commons/api-authorize';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { OAK_BASE_API_MODULE } from '../../api/_module';
import { invitationLinkService } from '../../api/invitation-link-service';

export const pageMeta = {
  name: 'InvitationLink',
  title: '邀请链接',
  description: '查询、创建、复制与作废邀请链接。',
} as const;

export const pageOperations = [
  { opName: 'list', apiMethods: [invitationLinkService.list] },
  { opName: 'retrieve', apiMethods: [invitationLinkService.retrieve] },
  {
    opName: 'createInternal',
    apiMethods: [invitationLinkService.createInternal],
  },
  { opName: 'createMember', apiMethods: [invitationLinkService.createMember] },
  {
    opName: 'createCustomer',
    apiMethods: [invitationLinkService.createCustomer],
  },
  {
    opName: 'createSupplierPartner',
    apiMethods: [invitationLinkService.createSupplierPartner],
  },
  {
    opName: 'createChannelPartner',
    apiMethods: [invitationLinkService.createChannelPartner],
  },
  {
    opName: 'inviteChildAdminOption',
    apiMethods: [invitationLinkService.canInviteChildAdmin],
  },
  { opName: 'copyLink', apiMethods: [invitationLinkService.copyLink] },
  { opName: 'revoke', apiMethods: [invitationLinkService.revoke] },
];

export const targetOptions: { label: string; value: InvitationTarget }[] = [
  { label: '内部用户', value: 'Internal' },
  { label: '会员用户', value: 'Member' },
  { label: '客户', value: 'Customer' },
  { label: '供应伙伴', value: 'SupplierPartner' },
  { label: '渠道伙伴', value: 'ChannelPartner' },
];
export const channelOptions: {
  label: string;
  value: InvitationRegistrationChannel;
}[] = [
  { label: '仅手机号', value: 'Phone' },
  { label: '仅邮箱', value: 'Email' },
  { label: '手机号或邮箱', value: 'Either' },
  { label: '仅第三方认证', value: 'ThirdParty' },
  { label: '不限', value: 'Unrestricted' },
];
export const usageOptions: { label: string; value: InvitationUsageMode }[] = [
  { label: '仅一次', value: 'Single' },
  { label: '限定人数', value: 'Limited' },
  { label: '不限人数', value: 'Unlimited' },
];
export const createMethodByTarget = {
  Internal: 'createInternal',
  Member: 'createMember',
  Customer: 'createCustomer',
  SupplierPartner: 'createSupplierPartner',
  ChannelPartner: 'createChannelPartner',
} as const;
/** 五种签发入口沿用真实 API 的按钮元数据和权限，统一交给公共 CRUD 工具栏。 */
export function invitationCreateActions(
  open: (target: InvitationTarget) => Promise<void>,
): CrudRowAction[] {
  return targetOptions.map(({ value }) => {
    const method = createMethodByTarget[value];
    const meta = getCrudOpMeta(invitationLinkService[method]);
    if (!meta) throw new Error(`邀请接口缺少操作声明：${method}`);
    return {
      ...meta,
      label: meta.label || method,
      displayKey: `invitation:${method}`,
      permission: buildApiMethodPermissions(invitationLinkService, method),
      handler: () => open(value),
      successMessage: false,
      reloadAfterAction: false,
      successAction: 'None',
    };
  });
}

const statuses: Record<string, string> = {
  Active: '有效',
  Expired: '已到期',
  Revoked: '已作废',
  Exhausted: '次数已用尽',
};
const organizationOptions = [
  { label: '加入邀请人组织', value: 'JoinInviterOrg' },
  { label: '为每人创建子组织', value: 'CreateChildOrg' },
];
const childOrgOptions = [
  { label: '公司', value: 'Company' },
  { label: '分公司', value: 'Branch' },
  { label: '部门', value: 'Department' },
  { label: '团队', value: 'Team' },
  { label: '小组', value: 'Group' },
];

type InvitationCrudField = CrudFieldConfig & {
  formVisibleWhen?: (state: Record<string, any>) => boolean;
};

/** 每种目标在公共表单打开前固定，策略、权限与提交接口使用同一目标。 */
export function createInvitationLinkCrudConfig(options: {
  apiService: CrudApiService;
  canCreate: boolean;
  canInviteChildAdmin: boolean;
  createActions?: CrudRowAction[];
  target: InvitationTarget;
}): CrudPageConfig {
  const { target, canInviteChildAdmin, apiService, canCreate } = options;
  const method = createMethodByTarget[target];
  const external = ['ChannelPartner', 'Customer', 'SupplierPartner'].includes(
    target,
  );
  const userTypeOptions: { label: string; value: InvitationUserType }[] = [
    { label: '普通用户', value: 'Employee' },
    ...(canInviteChildAdmin
      ? [{ label: '子组织管理员', value: 'Administrator' as const }]
      : []),
  ];
  return {
    apiBase: '/InvitationLink',
    apiModuleBase: OAK_BASE_API_MODULE,
    apiService,
    queryPermission: buildApiMethodPermissions(invitationLinkService, 'list'),
    createPermission: buildApiMethodPermissions(invitationLinkService, method),
    detailPermission: buildApiMethodPermissions(
      invitationLinkService,
      'retrieve',
    ),
    dataAttrTargets: {
      list: {
        method: 'POST',
        path: `${OAK_BASE_API_MODULE}/InvitationLink/list`,
      },
      create: {
        method: 'POST',
        path: `${OAK_BASE_API_MODULE}/InvitationLink/${method}`,
      },
      retrieve: {
        method: 'POST',
        path: `${OAK_BASE_API_MODULE}/InvitationLink/retrieve`,
      },
    },
    title: pageMeta.title,
    description: pageMeta.description,
    createButtonVisible: false,
    rowActions: options.createActions,
    defaultQuery: { pageIndex: 1, pageSize: 20 },
    defaultFormValues: {
      ...(target === 'Member' ? { userType: 'Employee' } : {}),
      ...(external ? { organizationMode: 'CreateChildOrg' } : {}),
      ...(external ? { childOrgType: target } : {}),
    },
    createSubmitKeys: ['userType', 'organizationMode', 'childOrgType'],
    formMaxColumns: 2,
    modalWidth: 960,
    allowCreate: canCreate,
    allowEdit: false,
    allowDelete: false,
    allowRetrieve: true,
    allowExport: false,
    fields: [
      {
        key: 'targetType',
        label: '邀请目标',
        type: 'select',
        options: targetOptions,
        search: true,
        table: true,
        form: false,
        width: 140,
      },
      {
        key: 'userType',
        label: '用户类型',
        type: 'select',
        options: userTypeOptions,
        search: true,
        table: true,
        form: target !== 'Member',
        required: target !== 'Member',
        width: 130,
      },
      {
        key: 'registrationChannel',
        label: '注册方式',
        type: 'select',
        options: channelOptions,
        search: true,
        table: true,
        required: true,
        width: 160,
        defaultValue: 'Either',
      },
      {
        key: 'usageMode',
        label: '使用次数',
        type: 'select',
        options: usageOptions,
        search: true,
        table: true,
        required: true,
        defaultValue: 'Single',
        width: 120,
      },
      {
        key: 'expiresAfter',
        label: '到期时间起',
        type: 'datetime',
        form: false,
        detail: false,
        table: false,
        search: true,
      },
      {
        key: 'expiresBefore',
        label: '到期时间止',
        type: 'datetime',
        form: false,
        detail: false,
        table: false,
        search: true,
      },
      {
        key: 'organizationMode',
        label: '组织安排',
        type: 'select',
        options: organizationOptions,
        form: !external,
        table: false,
        required: !external,
        defaultValue: 'JoinInviterOrg',
        validator: (value, state) =>
          state.userType === 'Administrator' && value !== 'CreateChildOrg'
            ? '子组织管理员必须创建新子组织'
            : undefined,
      },
      {
        key: 'childOrgType',
        label: '新子组织类型',
        type: 'select',
        options: childOrgOptions,
        form: !external,
        table: false,
        formVisibleWhen: (state) => state.organizationMode === 'CreateChildOrg',
        required: !external,
      },
      {
        key: 'customerType',
        label: '客户类型',
        type: 'select',
        options: [
          { label: '直接客户', value: 'DirectCustomer' },
          { label: '渠道客户', value: 'ChannelCustomer' },
        ],
        form: target === 'Customer',
        table: false,
        required: target === 'Customer',
      },
      {
        key: 'channelPartnerId',
        label: '渠道伙伴',
        type: 'select',
        form: target === 'Customer',
        table: false,
        formVisibleWhen: (state) => state.customerType === 'ChannelCustomer',
        required: target === 'Customer',
      },
      {
        key: 'supplierPartnerType',
        label: '供应伙伴类型',
        type: 'select',
        options: [
          'Goods',
          'RawMaterials',
          'Parts',
          'Service',
          'Logistics',
          'Technology',
          'Operation',
          'Other',
        ].map((value) => ({ label: value, value })),
        form: target === 'SupplierPartner',
        table: false,
        required: target === 'SupplierPartner',
      },
      {
        key: 'channelPartnerType',
        label: '渠道伙伴类型',
        type: 'select',
        options: [
          'Dealer',
          'Distributor',
          'Agent',
          'OnlineStore',
          'OfflineStore',
        ].map((value) => ({ label: value, value })),
        form: target === 'ChannelPartner',
        table: false,
        required: target === 'ChannelPartner',
      },
      {
        key: 'expiresAt',
        label: '到期时间',
        type: 'datetime',
        table: true,
        required: true,
        width: 190,
        validator: (value) => {
          const expires = new Date(String(value)).getTime();
          const limit = new Date();
          limit.setDate(limit.getDate() + 366);
          return !value ||
            !Number.isFinite(expires) ||
            expires <= Date.now() ||
            expires >= limit.getTime()
            ? '到期时间须为未来且小于366天'
            : undefined;
        },
      },
      {
        key: 'maxRegistrations',
        label: '人数上限',
        type: 'number',
        table: false,
        required: true,
        formVisibleWhen: (state) => state.usageMode === 'Limited',
        validator: (value) =>
          !Number.isInteger(Number(value)) ||
          Number(value) < 1 ||
          Number(value) > 10_000
            ? '限定人数须为1到10000的整数'
            : undefined,
      },
      {
        key: 'successCount',
        label: '成功人数',
        form: false,
        table: true,
        width: 110,
      },
      {
        key: 'status',
        label: '状态',
        form: false,
        table: true,
        width: 120,
        tableValue: (record) => statuses[record.status] || record.status,
      },
      {
        key: 'createdAt',
        label: '创建时间',
        type: 'datetime',
        form: false,
        table: true,
        width: 190,
      },
      { key: 'id', label: '链接ID', form: false, table: false, detail: true },
    ] as InvitationCrudField[],
  };
}

export function normalizeInvitationListQuery(
  params: Record<string, any>,
): InvitationLinkListQuery {
  const query: InvitationLinkListQuery = {
    pageIndex: Math.max(1, Number(params.pageIndex) || 1),
    pageSize: Math.min(100, Math.max(1, Number(params.pageSize) || 20)),
  };
  for (const key of [
    'targetType',
    'userType',
    'registrationChannel',
    'usageMode',
    'expiresAfter',
    'expiresBefore',
  ] as const) {
    if (
      params[key] !== undefined &&
      params[key] !== null &&
      params[key] !== ''
    ) {
      Object.assign(query, { [key]: params[key] });
    }
  }
  return query;
}
