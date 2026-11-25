<script setup lang="ts">
import type { ReportRuntimePage } from './report-runtime';
import type { UserOrgSelectorModelValue } from '@levin/admin-framework';

import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useAccessStore, useUserStore } from '@vben/runtime/stores';

import { UserOrgSelector } from '@levin/admin-framework';
import { notifyApiErrorOnce } from '@levin/admin-framework/framework-commons/app/api';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { Alert, Button, Input, message, Modal, Spin } from 'ant-design-vue';

import { ReportCopyService } from '../../api/report-copy-service';
import { isReportRateLimited } from '../../api/report-rate-limit';
import { reportDefinitionManagementService } from '../../api/report-definition-management-service';
import { ReportRuntimeService } from '../../api/report-runtime-service';
import ReportRuntimeView from './report-runtime-view.vue';
import { omitReportMenu } from './report-menu-visibility';

const reportCopyService = new ReportCopyService(true);
const reportRuntimeService = new ReportRuntimeService(true);

const route = useRoute();
const user = useUserStore();
const access = useAccessStore();
const { hasPermission } = useRbacAccess();
// 具体报表由服务器签发的菜单固定参数定位，URL 查询参数不能更换报表。
const reportId = computed(() => {
  const fixed = route.meta.fixedQuery;
  const id =
    fixed && typeof fixed === 'object' && !Array.isArray(fixed)
      ? (fixed as Record<string, unknown>).reportId
      : undefined;
  return typeof id === 'string' && id.trim() && id.length <= 64
    ? id
    : undefined;
});
const context = computed(() =>
  JSON.stringify({ user: user.userInfo, permissions: access.accessCodes }),
);
const page = ref<ReportRuntimePage>();
const error = ref('');
const loading = ref(false);
let generation = 0;
let suspended = false;
const copyOpen = ref(false);
const copyAvailable = ref(false);
const copying = ref(false);
const copyName = ref('');
const copyOrg = ref('');
const uncertainCopies = ref<Record<string, { name: string; orgId: string }>>({});
const copyKey = computed(() => JSON.stringify({ user: user.userInfo?.userId || user.userInfo?.id,
  tenant: user.userInfo?.tenantId, report: reportId.value }));
const copyUncertain = computed(() => Boolean(uncertainCopies.value[copyKey.value]));
const canCopy = computed(() => Boolean(copyAvailable.value && page.value?.global && user.userInfo?.tenantId
    && (user.userInfo?.userId || user.userInfo?.id))
  && hasPermission(buildApiMethodPermissions(reportCopyService, 'copy'))
  && hasPermission(buildApiMethodPermissions(reportDefinitionManagementService, 'catalog')));

function hideCurrentMenu() {
  access.setAccessMenus(omitReportMenu(access.accessMenus, route.path));
}

function openCopy() {
  if (!canCopy.value) return;
  const uncertain = uncertainCopies.value[copyKey.value];
  copyName.value = uncertain?.name ?? `${page.value?.title || '报表'}副本`.slice(0, 128);
  copyOrg.value = uncertain?.orgId ?? String(user.userInfo?.orgId || '');
  copyOpen.value = true;
}

function setCopyOrg(value: UserOrgSelectorModelValue) {
  copyOrg.value = typeof value === 'string' ? value : '';
}

async function copyReport() {
  if (copying.value || copyUncertain.value || !canCopy.value || !reportId.value) return;
  if (!copyName.value.trim()) return void message.warning('请填写报表名称');
  if (!copyOrg.value) return void message.warning('请选择所属组织');
  const serial = generation;
  const sourceReportId = reportId.value;
  const submittedKey = copyKey.value;
  uncertainCopies.value[submittedKey] = { name: copyName.value.trim(), orgId: copyOrg.value };
  copying.value = true;
  try {
    await reportCopyService.copy({ sourceReportId, name: copyName.value.trim(), orgId: copyOrg.value });
    delete uncertainCopies.value[submittedKey];
    if (serial !== generation) return;
    copyOpen.value = false;
    message.success('已创建报表草稿，请前往报表中心配置菜单并发布');
  } catch (cause) {
    if (isReportRateLimited(cause)) delete uncertainCopies.value[submittedKey];
    if (serial === generation) notifyApiErrorOnce(cause);
  } finally {
    copying.value = false;
  }
}

async function load() {
  const serial = ++generation;
  const id = reportId.value;
  page.value = undefined;
  copyAvailable.value = false;
  error.value = '';
  if (!id) {
    loading.value = false;
    error.value = '请从已授权的具体报表菜单进入';
    return;
  }
  loading.value = true;
  try {
    const result = await reportRuntimeService.page(id);
    if (serial === generation) {
      page.value = result;
      if (result.global && user.userInfo?.tenantId && hasPermission(buildApiMethodPermissions(reportCopyService, 'copy'))) {
        void reportCopyService.capabilities().then((available) => {
          if (serial === generation && !suspended) copyAvailable.value = available === true;
        }).catch(() => { /* 能力不可用时保持复制入口关闭，不影响报表读取。 */ });
      }
    }
  } catch {
    if (serial === generation) {
      hideCurrentMenu();
      error.value = '报表不可用或当前账号无权访问';
    }
  } finally {
    if (serial === generation) loading.value = false;
  }
}

async function withCurrentReport<T>(run: (id: string) => Promise<T>): Promise<T> {
  const id = reportId.value;
  if (!id) throw new Error('报表不可用');
  const serial = generation;
  try {
    return await run(id);
  } catch (cause) {
    // 组件错误可能只是参数或数据问题；重新读取报表以识别整份报表撤权。
    if (serial === generation && id === reportId.value && !suspended) {
      try {
        await reportRuntimeService.page(id);
      } catch {
        if (serial === generation && id === reportId.value && !suspended) {
          generation += 1;
          hideCurrentMenu();
          page.value = undefined;
          copyOpen.value = false;
          error.value = '报表不可用或当前账号无权访问';
        }
      }
    }
    throw cause;
  }
}

function query(
  componentId: string,
  parameters: Readonly<Record<string, string>>,
) {
  return withCurrentReport((id) => reportRuntimeService.query(id, componentId, parameters));
}

function exportComponent(componentId: string, parameters: Readonly<Record<string, string>>) {
  return withCurrentReport((id) => reportRuntimeService.exportComponent(id, componentId, parameters));
}

watch(
  [reportId, context],
  () => {
    copyOpen.value = false;
    if (!suspended) void load();
  },
  { immediate: true, flush: 'sync' },
);
onActivated(() => {
  if (suspended) {
    suspended = false;
    void load();
  }
});
onDeactivated(() => {
  suspended = true;
  generation += 1;
  page.value = undefined;
  copyAvailable.value = false;
  error.value = '';
  loading.value = false;
  copyOpen.value = false;
});
onBeforeUnmount(() => {
  generation += 1;
  page.value = undefined;
});
</script>

<template>
  <div class="p-4">
    <Spin :spinning="loading">
      <Alert v-if="error" :message="error" type="warning" show-icon />
      <ReportRuntimeView
        v-else-if="page"
        :page="page"
        :query="query"
        :export-component="exportComponent"
        :context-key="context"
      >
        <template #actions>
          <Button v-if="canCopy" @click="openCopy">复制为租户报表</Button>
        </template>
      </ReportRuntimeView>
    </Spin>
    <Modal
      :open="copyOpen"
      title="复制为租户报表"
      ok-text="创建草稿"
      :confirm-loading="copying"
      :ok-button-props="{ disabled: copyUncertain }"
      :closable="!copying"
      :mask-closable="!copying"
      @ok="copyReport"
      @cancel="copyOpen = false"
    >
      <div class="space-y-4">
        <Alert v-if="copyUncertain" type="warning" show-icon message="复制结果尚未确认，请先到报表管理列表核对，避免重复创建。" />
        <label class="block">报表名称 *
          <Input v-model:value="copyName" :maxlength="128" />
        </label>
        <label class="block">所属组织 *
          <UserOrgSelector :model-value="copyOrg || undefined" :selectable-types="['org']"
            :max-select-count="1" value-mode="id" @update:model-value="setCopyOrg" />
        </label>
      </div>
    </Modal>
  </div>
</template>
