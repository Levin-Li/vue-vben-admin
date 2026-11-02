import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { userOptionsLoader } from './api-module';

// 主档各方使用独立的组织和负责人，负责人候选不依赖同方组织。
type Party =
  | 'aftersales'
  | 'finance'
  | 'maintain'
  | 'presales'
  | 'sales'
  | 'subject';
type PartyDefinition = readonly [Party, string];

export const customerPartnerParties: readonly PartyDefinition[] = [
  ['subject', '主体方'],
  ['sales', '销售'],
  ['presales', '售前'],
  ['aftersales', '售后'],
  ['finance', '财务'],
];

// 服务端 admin 是管理员身份的聚合结果；角色显示名不能授予重新分派能力。
function isPartyReassignmentDisabled({ userInfo }: { userInfo: unknown }) {
  const user = (userInfo || {}) as Record<string, unknown>;
  return user.admin !== true && user.isAdmin !== true;
}

export function buildMasterPartyFields(
  parties: readonly PartyDefinition[],
  subjectOrgReadOnly = false,
): CrudPageConfig['fields'] {
  return parties.flatMap(([party, label], index) => {
    const readOnly = party === 'subject' && subjectOrgReadOnly;
    return [
      {
        key: `${party}OrgId`,
        label: `${label}组织`,
        layoutGroup: 'participants',
        layoutGroupTitle: '参与组织与负责人',
        layoutOrder: index * 20 + 10,
        type: 'org-tree-select' as const,
        formCreate: !readOnly,
        disabledOnEdit: readOnly || isPartyReassignmentDisabled,
        omitOnEdit: readOnly,
        search: false,
        table: true,
        width: 180,
        tableValue: (record: Record<string, any>) =>
          record[`${party}Org`]?.name || record[`${party}OrgId`] || '',
      },
      {
        key: `${party}UserId`,
        label: `${label}负责人`,
        layoutGroup: 'participants',
        layoutGroupTitle: '参与组织与负责人',
        layoutOrder: index * 20 + 20,
        disabledOnEdit: isPartyReassignmentDisabled,
        loadOptions: userOptionsLoader,
        remoteSearch: true,
        type: 'select' as const,
        search: false,
        table: true,
        width: 160,
        tableValue: (record: Record<string, any>) =>
          record[`${party}User`]?.name || record[`${party}UserId`] || '',
      },
    ];
  });
}

// 关联对象仅用于 ID 字段回显，哈希、版本与动作清单不作为额外详情字段展示。
export function buildMasterDetailMetadata(
  parties: readonly PartyDefinition[],
): CrudPageConfig['fields'] {
  const hiddenFields = [
    ...parties.flatMap(([party, label]) => [
      [`${party}Org`, `${label}组织关联`],
      [`${party}User`, `${label}负责人关联`],
    ]),
    ['tenantName', '租户名称'],
    ['domainId', '领域标识'],
    ['creator', '创建人标识'],
    ['optimisticLock', '数据版本'],
    ['orderCode', '排序编码'],
    ['invoiceInfoHash', '开票资料校验值'],
    ['shippingInfoHash', '邮寄资料校验值'],
    ['bankAccountHash', '银行账户校验值'],
    ['certificationLog', '认证流程内部记录'],
    ['actionLog', '流程内部记录'],
    ['supportCertificationEventsByCurrentStatus', '认证可用动作'],
    ['supportEventsByCurrentStatus', '可用动作'],
    ['legalSubject', '法律主体关联'],
    ['channelPartner', '渠道伙伴关联'],
  ];
  return [
    ...hiddenFields.map(([key, label]) => ({
      key: key as string,
      label: label as string,
      detail: false,
      form: false,
      table: false,
      search: false,
      export: false,
    })),
    {
      key: 'lastStatusTime',
      label: '最近状态变更时间',
      type: 'datetime',
      form: false,
      table: false,
      layoutGroup: 'management',
      layoutGroupTitle: '管理信息',
    },
    {
      key: 'lastStatusDesc',
      label: '最近状态说明',
      form: false,
      table: false,
      layoutGroup: 'management',
      layoutGroupTitle: '管理信息',
    },
    {
      key: 'lastUpdateTime',
      label: '更新时间',
      type: 'datetime',
      form: false,
      table: false,
    },
  ];
}
