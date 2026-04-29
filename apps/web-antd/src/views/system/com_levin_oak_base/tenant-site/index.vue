<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import type { TenantSiteRecord } from '#/api/com_levin_oak_base/tenant-site';

import CrudPage from '../crud-page.vue';
import DnsRecordManager from './dns-record-manager.vue';
import { tenantSitePageCrudConfig } from './config';

const dnsManagerOpen = ref(false);
const selectedSite = ref<null | TenantSiteRecord>(null);

const pageConfig = computed(() => ({
  ...tenantSitePageCrudConfig,
  rowActions: [
    {
      handler: async (record: TenantSiteRecord) => {
        selectedSite.value = record;
        dnsManagerOpen.value = true;
        return record;
      },
      label: '域名解析',
      permission: ['/TenantSite/*/dnsRecords', '/TenantSite/{id}/dnsRecords'],
      reloadAfterAction: false as const,
      successMessage: false as const,
    },
    ...(tenantSitePageCrudConfig.rowActions || []),
  ],
}));

watch(dnsManagerOpen, (open) => {
  if (!open) {
    selectedSite.value = null;
  }
});
</script>

<template>
  <CrudPage :config="pageConfig">
    <template #modals="slotProps">
      <DnsRecordManager
        v-if="selectedSite"
        v-model:open="dnsManagerOpen"
        :site="selectedSite"
        @saved="
          () => (slotProps as Record<string, any>).loadList?.()
        "
      />
    </template>
  </CrudPage>
</template>
