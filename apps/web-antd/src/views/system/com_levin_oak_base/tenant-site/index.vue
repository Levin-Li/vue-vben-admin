<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { tenantSiteService } from '#/api/com_levin_oak_base/tenant-site';

import CrudPage from '../crud-page.vue';
import { tenantSitePageCrudConfig } from './config';

const router = useRouter();

const pageConfig = computed(() => ({
  ...tenantSitePageCrudConfig,
  rowActions: [
    ...(tenantSitePageCrudConfig.rowActions || []),
    {
      confirmText: '确认生成当前站点的NG配置和证书文件吗？',
      handler: async (record: Record<string, any>) => {
        return tenantSiteService.generateNginxConfig(String(record.id || ''));
      },
      label: '生成NG配置和证书文件',
      permission: ['/TenantSite/generateNginxConfig'],
      visible: canGenerateNginxConfig,
    },
    {
      handler: async (record: Record<string, any>) => {
        await router.push({
          path: '/clob/V1/DomainSslCert',
          query: {
            action: 'apply',
            domain: normalizeSiteHost(String(record.domain || '')),
          },
        });
      },
      label: '申请SSL证书',
      visible: canApplySslCert,
    },
  ],
}));

function canGenerateNginxConfig(record: Record<string, any>) {
  const domain = String(record?.domain || '').trim();
  return Boolean(record?.id && domain && !isLocalHostDomain(domain));
}

function canApplySslCert(record: Record<string, any>) {
  const domain = String(record?.domain || '').trim();
  return Boolean(record?.id && domain && !isLocalHostDomain(domain));
}

function isLocalHostDomain(domain: string) {
  const host = normalizeSiteHost(domain);
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host === '0:0:0:0:0:0:0:1' ||
    host === '0.0.0.0' ||
    host === '127.0.0.1' ||
    host.startsWith('127.')
  );
}

function normalizeSiteHost(domain: string) {
  let host = domain.trim().toLowerCase();

  try {
    host = new URL(host.includes('://') ? host : `http://${host}`).hostname;
  } catch {
    host = host.split('/')[0] || '';
  }

  host = host.replace(/^\[(.*)]$/, '$1');
  return host.replace(/\.$/, '');
}
</script>

<template>
  <CrudPage :config="pageConfig" />
</template>
