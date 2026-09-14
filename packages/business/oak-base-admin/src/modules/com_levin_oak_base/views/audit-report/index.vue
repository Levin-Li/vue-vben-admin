<script lang="ts" setup>
import { computed, ref } from 'vue';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { auditReportService } from '../../api/audit-report-service';
import CrudPage from '../crud-page.vue';
import { auditReportPageCrudConfig } from './config';
import AuditReportViewer from './audit-report-viewer.vue';

// 报告查看与通用详情分离，避免详情弹窗承担正文编辑器渲染职责。
const reportViewerOpen = ref(false);
const selectedReport = ref<null | Record<string, any>>(null);

// 查看报告复用详情读取权限，保证按钮可见性与报告正文读取边界一致。
const pageConfig = computed(() => ({
  ...auditReportPageCrudConfig,
  rowActions: [
    ...(auditReportPageCrudConfig.rowActions || []),
    {
      handler: async (record: Record<string, any>) => {
        selectedReport.value = record;
        reportViewerOpen.value = true;
      },
      label: '查看报告',
      permission: buildApiMethodPermissions(auditReportService, 'retrieve'),
      reloadAfterAction: false,
    },
  ],
}));
</script>

<template>
  <CrudPage :config="pageConfig" />
  <AuditReportViewer v-model:open="reportViewerOpen" :record="selectedReport" />
</template>
