import type {
  CrudApiService,
  CrudRowAction,
} from '@levin/admin-framework/framework-commons/shared/types';

import { buildActionLogTooltipItems } from '@levin/admin-framework/framework-commons/shared/crud-action-log-tooltip';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

const certificationStatusLabels: Record<string, string> = {
  Draft: '未审核',
  AuditPending: '审核中',
  AuditRejected: '认证拒绝',
  Certified: '已认证',
  Revoked: '认证已撤销',
};

// 复用标准四行时间线数据，仅覆盖本领域的状态中文标签。
export function buildPartnerCertificationLog(value: unknown) {
  const logs = Array.isArray(value) ? value : [];

  return buildActionLogTooltipItems(
    logs.map((log) => ({
      ...log,
      beforeStatus:
        certificationStatusLabels[log.beforeStatus] || log.beforeStatus,
      afterStatus:
        certificationStatusLabels[log.afterStatus] || log.afterStatus,
    })),
  );
}

// 日志读取沿用当前子类型页面的详情接口和权限；HTTP 客户端已解包 ApiResp。
export function buildPartnerCertificationLogAction(
  service: CrudApiService,
  onLoaded: (logs: ReturnType<typeof buildPartnerCertificationLog>) => void,
): CrudRowAction {
  return {
    displayKey: 'certificationLog',
    label: '流程日志',
    permission: buildApiMethodPermissions(service, 'retrieve'),
    handler: async (record) => {
      if (!service.retrieve) throw new Error('当前合作伙伴页面未配置详情接口');
      const detail = (await service.retrieve({ id: record.id })) as null | {
        actionLog?: unknown;
      };

      onLoaded(buildPartnerCertificationLog(detail?.actionLog));
    },
    reloadAfterAction: false,
    successMessage: false,
  };
}
