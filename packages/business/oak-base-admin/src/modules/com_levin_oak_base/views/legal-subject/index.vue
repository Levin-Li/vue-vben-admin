<script lang="ts" setup>
import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { computed, ref } from 'vue';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { Button } from 'ant-design-vue';

import { legalSubjectService } from '../../api/legal-subject-service';
import { createModeFields } from '../create-mode-fields';
import CrudPage from '../crud-page.vue';
import { buildCertificationActionPayload } from './certification-payload';
import { legalSubjectPageCrudConfig } from './config';
import OwnershipRowAction from '../partner/ownership-row-action.vue';
import { legalSubjectOwnershipGroups, ownershipFieldsReadOnlyOnEdit, ownershipSelectorFields } from '../partner/ownership-groups';
import OwnershipCreateSelector from '../partner/ownership-create-selector.vue';

type LegalSubjectRecord = Record<string, any>;
const { hasPermission } = useRbacAccess();
const ownershipFields = ownershipSelectorFields(legalSubjectOwnershipGroups);
const mineMode = ref(false);

// 两个普通建档按钮复用同一表单，但创建路径与可填写的参与方字段各自独立。
function openCreateMode(mine: boolean, openCreate: () => void) {
  mineMode.value = mine;
  openCreate();
}

// 主体认证以法律主体 ID 执行；多条合作关系共享同一认证结果。
function canFireCertificationEvent(record: LegalSubjectRecord, event: string) {
  return (
    Array.isArray(record.supportCertificationEventsByCurrentStatus) &&
    record.supportCertificationEventsByCurrentStatus.includes(event)
  );
}

const pageConfig = computed<CrudPageConfig>(() => ({
  ...legalSubjectPageCrudConfig,
  createButtonVisible: false,
  createPath: () =>
    mineMode.value ? '/LegalSubject/createMine' : '/LegalSubject/create',
  fields: ownershipFieldsReadOnlyOnEdit(createModeFields(legalSubjectPageCrudConfig.fields, mineMode.value).map((field) =>
    !mineMode.value && ['subjectOrgId', 'subjectUserId'].includes(field.key)
      ? { ...field, formCreate: true, required: false }
      : field,
  ), legalSubjectOwnershipGroups),
  listOperations: [
    ...(legalSubjectPageCrudConfig.listOperations || []),
    {
      key: 'LegalSubject:createMine',
      label: '新增我的法律主体',
      placement: 'left',
    },
    { key: 'LegalSubject:createBusiness', label: '新增', placement: 'left' },
  ],
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
}));
</script>

<template>
  <CrudPage :config="pageConfig">
    <template v-for="item in ownershipFields" :key="item.field" #[`form-field-${item.field}`]="{ formState, disabled }">
      <OwnershipCreateSelector :form-state="formState" :field="item.field" :org-field="item.orgField" :user-field="item.userField" :disabled="disabled" />
    </template>
    <template #row-actions="{ record, reload }">
      <OwnershipRowAction :record="record" :reload="reload" :service="legalSubjectService"
        resource="LegalSubject" label="法律主体" :descriptors="legalSubjectOwnershipGroups" />
    </template>
    <template #toolbar-before-create="{ isListOperationVisible, openCreate }">
      <!-- 主体方由服务端确认，商务对接方只在普通新增表单中选择。 -->
      <Button
        v-if="
          isListOperationVisible('LegalSubject:createMine') &&
          hasPermission(
            buildApiMethodPermissions(legalSubjectService, 'createMine'),
          )
        "
        type="primary"
        @click="openCreateMode(true, openCreate)"
        >新增我的法律主体</Button
      >
      <Button
        v-if="
          isListOperationVisible('LegalSubject:createBusiness') &&
          hasPermission(
            buildApiMethodPermissions(legalSubjectService, 'create'),
          )
        "
        type="primary"
        @click="openCreateMode(false, openCreate)"
        >新增</Button
      >
    </template>
  </CrudPage>
</template>
