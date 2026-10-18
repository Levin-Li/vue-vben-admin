import type { CrudRowAction } from '@levin/admin-framework/framework-commons/shared/types';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { partnerService } from '../../api/partner-service';

function actionRequest(record: Record<string, any>) {
  return {
    id: record.id,
    tenantId: record.tenantId,
    orgId: record.orgId,
    optimisticLock: record.optimisticLock,
    remark: record._operatorAction || undefined,
  };
}

// 支持事件与服务端可见条件同时限制动作，实际权限由对应 API 方法派生。
export const partnerCertificationActions: CrudRowAction[] = [
  {
    displayKey: 'submitCertification',
    label: '提交认证',
    flowFormFields: [],

    permission: buildApiMethodPermissions(
      partnerService,
      'submitCertification',
    ),
    visibleOn:
      "(certificationStatus == 'Draft' || certificationStatus == 'AuditRejected')",
    visible: (record) =>
      Array.isArray(record.supportEventsByCurrentStatus) &&
      record.supportEventsByCurrentStatus.includes('提交认证'),
    handler: (record) =>
      partnerService.submitCertification(actionRequest(record)),
  },
  {
    displayKey: 'approveCertification',
    label: '认证通过',
    flowFormFields: [],

    permission: buildApiMethodPermissions(
      partnerService,
      'approveCertification',
    ),
    visibleOn: "certificationStatus == 'AuditPending'",
    visible: (record) =>
      Array.isArray(record.supportEventsByCurrentStatus) &&
      record.supportEventsByCurrentStatus.includes('认证通过'),
    handler: (record) =>
      partnerService.approveCertification(actionRequest(record)),
  },
  {
    displayKey: 'rejectCertification',
    label: '认证拒绝',
    flowFormFields: ['_operatorAction'],
    reasonRequired: true,
    permission: buildApiMethodPermissions(
      partnerService,
      'rejectCertification',
    ),
    visibleOn: "certificationStatus == 'AuditPending'",
    visible: (record) =>
      Array.isArray(record.supportEventsByCurrentStatus) &&
      record.supportEventsByCurrentStatus.includes('认证拒绝'),
    handler: (record) =>
      partnerService.rejectCertification(actionRequest(record)),
  },
  {
    displayKey: 'revokeCertification',
    label: '撤销认证',
    flowFormFields: [],

    permission: buildApiMethodPermissions(
      partnerService,
      'revokeCertification',
    ),
    visibleOn: "certificationStatus == 'Certified'",
    visible: (record) =>
      Array.isArray(record.supportEventsByCurrentStatus) &&
      record.supportEventsByCurrentStatus.includes('撤销认证'),
    handler: (record) =>
      partnerService.revokeCertification(actionRequest(record)),
  },
];
