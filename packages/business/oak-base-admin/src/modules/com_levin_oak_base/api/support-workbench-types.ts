import type { NotificationChannel } from './workflow-notification-route-service';

/** 配置页面只提供当前选择的受理范围，服务端仍独立校验。 */
export interface SupportScope {
  orgId: string;
  tenantId: string;
}
export interface SupportPage<T> {
  items: T[];
  totals: number;
}
export interface QueueRecord extends SupportScope {
  code: string;
  enabled: boolean;
  handlerRoleCodes: string[];
  handlerUserIds: string[];
  id: string;
  name: string;
  optimisticLock: number;
}
export interface QueueInput extends SupportScope {
  code: string;
  enabled: boolean;
  handlerRoleCodes: string[];
  handlerUserIds: string[];
  id?: string;
  name: string;
  optimisticLock?: number;
}
export interface MailboxConfig {
  defaultAssigneeId?: string;
  defaultOrgId?: string;
  defaultPriority: string;
  email: string;
  emailRelayRouteId?: string;
  inboundChannel: string;
  mailDomainId?: string;
  outboundConfigRef?: string;
  queueId: string;
}
export interface MailboxRecord extends MailboxConfig, SupportScope {
  enabled: boolean;
  id: string;
  optimisticLock: number;
}
export interface AuditRecord {
  attemptCount: number;
  channel: NotificationChannel;
  createTime?: string;
  deliveredTime?: string;
  eventId: string;
  exhausted: boolean;
  id: string;
  lastAttemptTime?: string;
  nextAttemptTime?: string;
  optimisticLock: number;
  status: string;
}
export interface AuditDetail {
  attempts: {
    attemptNo: number;
    finishedTime?: string;
    outcome: string;
    startedTime?: string;
  }[];
  attemptsTruncated: boolean;
  delivery: AuditRecord;
  reviews: {
    action: string;
    afterStatus: string;
    beforeStatus: string;
    occurTime: string;
    operator: string;
    reason: string;
    verificationRef?: string;
    verifiedUnsent: boolean;
  }[];
}
export interface AuditReview {
  id: string;
  optimisticLock: number;
  reason: 'ConfigurationFixed' | 'ServiceRestored' | 'VerifiedUnsent';
  tenantId?: string;
  verificationRef?: string;
  verifiedUnsent?: boolean;
}
