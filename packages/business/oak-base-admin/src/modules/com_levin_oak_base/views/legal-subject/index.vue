<script lang="ts" setup>
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { legalSubjectService } from '../../api/legal-subject-service';
import CrudPage from '../crud-page.vue';
import { buildCertificationActionPayload } from './certification-payload';
import { legalSubjectPageCrudConfig } from './config';

type LegalSubjectRecord = Record<string, any>;

// 主体认证以法律主体 ID 执行；多条合作关系共享同一认证结果。
function canFireCertificationEvent(record: LegalSubjectRecord, event: string) {
  return (
    Array.isArray(record.supportCertificationEventsByCurrentStatus) &&
    record.supportCertificationEventsByCurrentStatus.includes(event)
  );
}

const pageConfig = {
  ...legalSubjectPageCrudConfig,
  rowActions: [
    {
      handler: (record: LegalSubjectRecord) =>
        legalSubjectService.submitCertification(
          buildCertificationActionPayload(record),
        ),
      label: '提交认证',
      permission: buildApiMethodPermissions(
        legalSubjectService,
        'submitCertification',
      ),
      visible: (record: LegalSubjectRecord) =>
        canFireCertificationEvent(record, '提交认证'),
      visibleOn:
        "(certificationStatus == 'Draft' || certificationStatus == 'AuditRejected')",
    },
    {
      handler: (record: LegalSubjectRecord) =>
        legalSubjectService.approveCertification(
          buildCertificationActionPayload(record),
        ),
      label: '认证通过',
      permission: buildApiMethodPermissions(
        legalSubjectService,
        'approveCertification',
      ),
      visible: (record: LegalSubjectRecord) =>
        canFireCertificationEvent(record, '认证通过'),
      visibleOn: "certificationStatus == 'AuditPending'",
    },
    {
      handler: (record: LegalSubjectRecord) =>
        legalSubjectService.rejectCertification(
          buildCertificationActionPayload(record),
        ),
      label: '认证拒绝',
      reasonRequired: true,
      permission: buildApiMethodPermissions(
        legalSubjectService,
        'rejectCertification',
      ),
      visible: (record: LegalSubjectRecord) =>
        canFireCertificationEvent(record, '认证拒绝'),
      visibleOn: "certificationStatus == 'AuditPending'",
    },
    {
      handler: (record: LegalSubjectRecord) =>
        legalSubjectService.revokeCertification(
          buildCertificationActionPayload(record),
        ),
      label: '撤销认证',
      permission: buildApiMethodPermissions(
        legalSubjectService,
        'revokeCertification',
      ),
      visible: (record: LegalSubjectRecord) =>
        canFireCertificationEvent(record, '撤销认证'),
      visibleOn: "certificationStatus == 'Certified'",
    },
  ],
};
</script>

<template>
  <CrudPage :config="pageConfig" />
</template>
