<script lang="ts" setup>
import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { computed, ref } from 'vue';

import { Empty, Modal, Timeline, TimelineItem } from 'ant-design-vue';

import CrudPage from '../crud-page.vue';
import { partnerCertificationActions } from './certification-actions';
import {
  buildPartnerCertificationLog,
  buildPartnerCertificationLogAction,
} from './certification-log';
import { isLegalSubjectPickerLocked } from './legal-subject-edit-lock';
import LegalSubjectPicker from './legal-subject-picker.vue';

const props = defineProps<{ config: CrudPageConfig }>();
const logOpen = ref(false);
const logItems = ref<ReturnType<typeof buildPartnerCertificationLog>>([]);

// 两类伙伴页面保留独立配置，共用认证事件与日志的局部交互。
const pageConfig = computed<CrudPageConfig>(() => ({
  ...props.config,
  rowActions: [
    ...(props.config.rowActions || []),
    ...partnerCertificationActions,
    ...(props.config.apiService
      ? [
          buildPartnerCertificationLogAction(
            props.config.apiService,
            (logs) => {
              logItems.value = logs;
              logOpen.value = true;
            },
          ),
        ]
      : []),
  ],
}));
</script>

<template>
  <CrudPage :config="pageConfig">
    <template
      #form-field-legalSubjectId="{ disabled, editingRecord, formState }"
    >
      <LegalSubjectPicker
        v-model="formState.legalSubjectId"
        :disabled="isLegalSubjectPickerLocked(disabled, editingRecord)"
      />
    </template>
  </CrudPage>

  <!-- 流程日志固定按时间、操作人、状态迁移、非空备注展示。 -->
  <Modal v-model:open="logOpen" title="流程日志" :footer="null">
    <Timeline v-if="logItems.length > 0" class="pt-4">
      <TimelineItem v-for="item in logItems" :key="item.key">
        <div>{{ item.occurTime }}</div>
        <div>{{ item.operator }}</div>
        <div>{{ item.transition }}</div>
        <div v-if="item.remark">{{ item.remark }}</div>
      </TimelineItem>
    </Timeline>
    <Empty v-else description="暂无流程日志" />
  </Modal>
</template>
