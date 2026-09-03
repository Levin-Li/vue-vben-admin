<script lang="ts" setup>
import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { computed, ref } from 'vue';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { IconifyIcon } from '@vben/icons';
import { Button, message, Tooltip } from 'ant-design-vue';

import { openAreaService } from '../../api/open-area-service';
import CrudPage from '../crud-page.vue';
import { getOpenAreaDisplayNames, openAreaPageCrudConfig } from './config';
import OpenAreaCodeListEditorModal from './open-area-code-list-editor-modal.vue';

const codeEditorOpen = ref(false);
const codeEditorSaving = ref(false);
const pageKey = ref(0);
const selectedRecord = ref<null | Record<string, any>>(null);

const pageConfig = computed<CrudPageConfig>(() => ({
  ...openAreaPageCrudConfig,
  rowActions: [
    {
      handler: async (record: Record<string, any>) => {
        selectedRecord.value = record;
        codeEditorOpen.value = true;
      },
      label: '开通区域',
      permission: buildApiMethodPermissions(openAreaService, 'update'),
      reloadAfterAction: false,
      successMessage: false,
    },
    ...(openAreaPageCrudConfig.rowActions || []),
  ],
}));

function handleCodeEditorOpen(open: boolean) {
  codeEditorOpen.value = open;

  if (!open) {
    selectedRecord.value = null;
  }
}

async function saveAreaCodeList(areaCodeList: string[]) {
  const record = selectedRecord.value;

  if (!record?.id) {
    return;
  }

  codeEditorSaving.value = true;
  try {
    await openAreaService.update({
      areaCodeList,
      forceUpdateFields: ['areaCodeList'],
      id: record.id,
      optimisticLock: record.optimisticLock,
    });
    message.success('开通区域已保存');
    codeEditorOpen.value = false;
    selectedRecord.value = null;
    pageKey.value += 1;
  } finally {
    codeEditorSaving.value = false;
  }
}

async function copyOpenAreaNames(record: Record<string, any>) {
  await navigator.clipboard?.writeText(
    getOpenAreaDisplayNames(record).join('\n'),
  );
  message.success('已复制开通区域名称');
}
</script>

<template>
  <CrudPage :key="pageKey" :config="pageConfig">
    <template #table-cell-areaCodeList="{ record }">
      <Tooltip placement="topLeft">
        <template #title>
          <div class="w-80 max-w-[70vw]">
            <div class="mb-2 flex items-center justify-between gap-3">
              <span>已开通区域</span>
              <Tooltip title="复制全部">
                <Button
                  aria-label="复制全部"
                  class="text-white hover:!text-white"
                  size="small"
                  type="text"
                  @click="copyOpenAreaNames(record)"
                >
                  <IconifyIcon class="size-4" icon="lucide:copy" />
                </Button>
              </Tooltip>
            </div>
            <div class="max-h-60 select-text overflow-y-auto pr-1">
              <div
                v-for="name in getOpenAreaDisplayNames(record)"
                :key="name"
                class="leading-6"
              >
                {{ name }}
              </div>
            </div>
          </div>
        </template>
        <span class="block truncate">
          {{ getOpenAreaDisplayNames(record).join('、') }}
        </span>
      </Tooltip>
    </template>
  </CrudPage>
  <OpenAreaCodeListEditorModal
    :area-code-list="selectedRecord?.areaCodeList"
    :open="codeEditorOpen"
    :saving="codeEditorSaving"
    @save="saveAreaCodeList"
    @update:open="handleCodeEditorOpen"
  />
</template>
