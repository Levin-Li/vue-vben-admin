<script lang="ts" setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';

import type { TenantSiteRecord } from '#/api/com_levin_oak_base/tenant-site';

import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { Button, Form, Input, Modal, Select, message } from 'ant-design-vue';

import CrudPage from '../crud-page.vue';
import {
  getTenantSiteSslRenewBeforeDays,
  getTenantSiteSuffixApplyApi,
  getTenantSiteVendorApplyApi,
  getTenantSiteVendorSuffixOptions,
  loadTenantSiteSslRenewBeforeDays,
  modulePostCrudAction,
  tenantOptionsLoader,
  tenantSiteVendorOptionsLoader,
} from '../api-module';
import { tenantSitePageCrudConfig } from './config';
import DnsRecordManager from './dns-record-manager.vue';

const SSL_CERT_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

const dnsManagerOpen = ref(false);
const domainApplyOpen = ref(false);
const domainApplying = ref(false);
const domainApplyTargetSite = ref<null | TenantSiteRecord>(null);
const selectedSite = ref<null | TenantSiteRecord>(null);
const domainVendorOptions = ref<Array<{ label: string; value: any }>>([]);
const tenantOptions = ref<Array<{ label: string; value: any }>>([]);
const userStore = useUserStore();

const currentUserTenantId = computed(() =>
  String((userStore.userInfo as Record<string, any>)?.tenantId || '').trim(),
);
const isTenantlessUser = computed(() => !currentUserTenantId.value);
const domainApplyTitle = computed(() =>
  domainApplyTargetSite.value ? '重新申请域名' : '申请域名',
);

const applyDomainForm = reactive({
  domain: '',
  domainApplyApi: undefined as string | undefined,
  domainPrefix: '',
  domainSuffix: undefined as string | undefined,
  domainVendor: undefined as string | undefined,
  tenantId: undefined as string | undefined,
});

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
    {
      confirmText: '确认申请当前站点的 SSL 证书吗？',
      handler: async (record: TenantSiteRecord) => {
        await modulePostCrudAction(`/TenantSite/${record.id}/applySslCert`, undefined, {
          timeout: SSL_CERT_REQUEST_TIMEOUT_MS,
        });
      },
      label: '申请SSL证书',
      permission: [
        '/TenantSite/*/applySslCert',
        '/TenantSite/{id}/applySslCert',
      ],
      visible: canApplySslCert,
    },
    {
      handler: async (record: TenantSiteRecord) => {
        openDomainReapply(record);
        return record;
      },
      label: '重新申请域名',
      permission: ['/TenantSite/*/applyDomain', '/TenantSite/{id}/applyDomain'],
      reloadAfterAction: false as const,
      successMessage: false as const,
      visible: canReapplyProviderDomain,
    },
    ...(tenantSitePageCrudConfig.rowActions || []),
  ],
}));

watch(dnsManagerOpen, (open) => {
  if (!open) {
    selectedSite.value = null;
  }
});

function filterSelectOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  if (!keyword) {
    return true;
  }

  const label = String(option?.label ?? '').toLowerCase();
  const value = String(option?.value ?? '').toLowerCase();

  return label.includes(keyword) || value.includes(keyword);
}

function normalizeDomainSuffix(suffix?: string) {
  const normalizedSuffix = String(suffix || '').trim();

  if (!normalizedSuffix) {
    return '';
  }

  return normalizedSuffix.startsWith('.')
    ? normalizedSuffix
    : `.${normalizedSuffix}`;
}

function normalizeDomainPrefix(prefix?: string) {
  return String(prefix || '')
    .trim()
    .replace(/^\.+/, '')
    .replace(/\.+$/, '');
}

function buildApplyDomain(prefix?: string, suffix?: string) {
  const normalizedPrefix = normalizeDomainPrefix(prefix);
  const normalizedSuffix = normalizeDomainSuffix(suffix);

  return normalizedPrefix && normalizedSuffix
    ? `${normalizedPrefix}${normalizedSuffix}`
    : '';
}

function extractDomainPrefix(domain?: string, suffix?: string) {
  const normalizedDomain = String(domain || '').trim();
  const normalizedSuffix = normalizeDomainSuffix(suffix);

  if (!normalizedDomain || !normalizedSuffix) {
    return '';
  }

  return normalizedDomain.endsWith(normalizedSuffix)
    ? normalizeDomainPrefix(normalizedDomain.slice(0, -normalizedSuffix.length))
    : '';
}

function isProviderManagedDomain(record?: null | Record<string, any>) {
  return Boolean(record?.domainVendor);
}

function isCertificateEligibleDomain(domain?: string) {
  const normalizedDomain = String(domain || '').trim().toLowerCase();

  if (!normalizedDomain || normalizedDomain === 'localhost') {
    return false;
  }

  return !/^((25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(25[0-5]|2[0-4]\d|[01]?\d?\d)$/.test(
    normalizedDomain,
  );
}

function canReapplyProviderDomain(record: Record<string, any>) {
  return Boolean(
    record?.id &&
    record?.domainVendor &&
    record?.domain &&
    record?.domainApplyApi &&
    record.domainApplyStatus !== 'Applying' &&
    record.domainApplyStatus !== 'Renewing',
  );
}

function parseDateTimeValue(value: unknown) {
  if (!value) {
    return Number.NaN;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const normalized = String(value).trim().replace(' ', 'T');
  return new Date(normalized).getTime();
}

function isSslCertDue(record: Record<string, any>) {
  if (record?.domainSslCertApplyStatus === 'Failed') {
    return true;
  }

  if (!record?.domainSslCertExpiredTime) {
    return true;
  }

  const expiredAt = parseDateTimeValue(record.domainSslCertExpiredTime);
  const renewBeforeMs =
    getTenantSiteSslRenewBeforeDays() * 24 * 60 * 60 * 1000;
  return Number.isNaN(expiredAt)
    ? false
    : expiredAt <= Date.now() + renewBeforeMs;
}

function canApplySslCert(record: Record<string, any>) {
  return Boolean(
    record?.id &&
    isCertificateEligibleDomain(record?.domain) &&
    record.domainApplyStatus !== 'Applying' &&
    record.domainApplyStatus !== 'Renewing' &&
    record.domainSslCertApplyStatus !== 'Applying' &&
    record.domainSslCertApplyStatus !== 'Renewing' &&
    isSslCertDue(record),
  );
}

function resetApplyDomainForm() {
  applyDomainForm.domain = '';
  applyDomainForm.domainApplyApi = undefined;
  applyDomainForm.domainPrefix = '';
  applyDomainForm.domainSuffix = undefined;
  applyDomainForm.domainVendor = undefined;
  applyDomainForm.tenantId = undefined;
}

function syncApplyDomain() {
  applyDomainForm.domain = buildApplyDomain(
    applyDomainForm.domainPrefix,
    applyDomainForm.domainSuffix,
  );
}

function getApplyDomainSuffixOptions() {
  return applyDomainForm.domainVendor
    ? getTenantSiteVendorSuffixOptions(applyDomainForm.domainVendor)
    : [];
}

function openDomainApply() {
  resetApplyDomainForm();
  domainApplyTargetSite.value = null;
  domainApplyOpen.value = true;
}

function fillApplyDomainFormFromRecord(record: TenantSiteRecord) {
  resetApplyDomainForm();
  applyDomainForm.domainVendor = (record as Record<string, any>).domainVendor;
  applyDomainForm.domainSuffix = (record as Record<string, any>).domainSuffix;
  applyDomainForm.domainApplyApi = (
    record as Record<string, any>
  ).domainApplyApi;
  applyDomainForm.tenantId = (record as Record<string, any>).tenantId;
  applyDomainForm.domainPrefix = extractDomainPrefix(
    record.domain,
    applyDomainForm.domainSuffix,
  );
  syncApplyDomain();
}

function openDomainReapply(record: TenantSiteRecord) {
  domainApplyTargetSite.value = record;
  fillApplyDomainFormFromRecord(record);
  domainApplyOpen.value = true;
}

function closeDomainApply() {
  domainApplyOpen.value = false;
  domainApplyTargetSite.value = null;
  resetApplyDomainForm();
}

function handleApplyDomainVendorChange(vendor?: string) {
  applyDomainForm.domainVendor = vendor;
  applyDomainForm.domainApplyApi = vendor
    ? getTenantSiteVendorApplyApi(vendor) || undefined
    : undefined;

  const suffixOptions = getTenantSiteVendorSuffixOptions(vendor);
  const suffixStillMatches =
    applyDomainForm.domainSuffix &&
    suffixOptions.some(
      (option) => option.value === applyDomainForm.domainSuffix,
    );

  if (!suffixStillMatches) {
    applyDomainForm.domainSuffix = undefined;
  }

  syncApplyDomain();
}

function handleApplyDomainSuffixChange(suffix?: string) {
  applyDomainForm.domainSuffix = suffix;
  applyDomainForm.domainApplyApi =
    (applyDomainForm.domainVendor
      ? getTenantSiteVendorApplyApi(applyDomainForm.domainVendor)
      : undefined) ||
    getTenantSiteSuffixApplyApi(suffix) ||
    undefined;
  syncApplyDomain();
}

function handleApplyDomainPrefixChange(prefix?: string) {
  applyDomainForm.domainPrefix = prefix || '';
  syncApplyDomain();
}

async function submitDomainApply(loadList?: () => void | Promise<void>) {
  const domainSuffix = normalizeDomainSuffix(applyDomainForm.domainSuffix);
  const domainPrefix = normalizeDomainPrefix(applyDomainForm.domainPrefix);
  const domain = buildApplyDomain(domainPrefix, domainSuffix);
  const domainApplyApi =
    applyDomainForm.domainApplyApi ||
    (applyDomainForm.domainVendor
      ? getTenantSiteVendorApplyApi(applyDomainForm.domainVendor)
      : undefined) ||
    getTenantSiteSuffixApplyApi(domainSuffix);

  if (!applyDomainForm.domainVendor) {
    message.warning('请选择域名供应商');
    return;
  }

  if (isTenantlessUser.value && !applyDomainForm.tenantId) {
    message.warning('请选择归属租户');
    return;
  }

  if (!domainSuffix) {
    message.warning('请选择域名后缀');
    return;
  }

  if (!domainPrefix) {
    message.warning('请输入域名前缀');
    return;
  }

  if (!domainApplyApi) {
    message.warning('未找到域名申请 API');
    return;
  }

  domainApplying.value = true;

  try {
    const applyPath = domainApplyTargetSite.value?.id
      ? `/TenantSite/${domainApplyTargetSite.value.id}/applyDomain`
      : '/TenantSite/applyDomain';

    await modulePostCrudAction(applyPath, {
      domain,
      domainApplyApi,
      domainSuffix,
      name: domainApplyTargetSite.value?.name || domain,
      tenantId: isTenantlessUser.value ? applyDomainForm.tenantId : undefined,
    });
    message.success(
      domainApplyTargetSite.value ? '域名重新申请成功' : '域名申请成功',
    );
    closeDomainApply();
    await loadList?.();
  } catch (error) {
    console.error(error);
  } finally {
    domainApplying.value = false;
  }
}

onMounted(async () => {
  const [vendors, tenants] = await Promise.all([
    tenantSiteVendorOptionsLoader(),
    tenantOptionsLoader(),
    loadTenantSiteSslRenewBeforeDays(),
  ]);
  domainVendorOptions.value = vendors;
  tenantOptions.value = tenants;
});
</script>

<template>
  <CrudPage :config="pageConfig">
    <template #toolbar-extra>
      <Button type="primary" @click="openDomainApply">
        <IconifyIcon class="size-4" icon="lucide:globe-2" />
        申请域名
      </Button>
    </template>
    <template #form-field-domain="{ field, formState, editingRecord }">
      <Input
        v-model:value="formState[field.key]"
        class="w-full"
        :disabled="isProviderManagedDomain(editingRecord)"
        :placeholder="
          isProviderManagedDomain(editingRecord)
            ? '供应商域名不可在编辑表单修改'
            : `请输入${field.label}`
        "
      />
    </template>
    <template #form-field-domainVendor="{ field, formState, editingRecord }">
      <Select
        v-model:value="formState[field.key]"
        allow-clear
        class="w-full"
        disabled
        :filter-option="filterSelectOption"
        :options="domainVendorOptions"
        :placeholder="
          isProviderManagedDomain(editingRecord)
            ? `请选择${field.label}`
            : '自有域名无供应商'
        "
        show-search
      />
    </template>
    <template #form-field-domainSuffix="{ field, formState, editingRecord }">
      <Input
        v-model:value="formState[field.key]"
        class="w-full"
        disabled
        :placeholder="
          isProviderManagedDomain(editingRecord)
            ? `请输入${field.label}`
            : '自有域名自动识别后缀'
        "
      />
    </template>
    <template #modals="slotProps">
      <DnsRecordManager
        v-if="selectedSite"
        v-model:open="dnsManagerOpen"
        :site="selectedSite"
        @saved="() => (slotProps as Record<string, any>).loadList?.()"
      />
      <Modal
        v-model:open="domainApplyOpen"
        :confirm-loading="domainApplying"
        destroy-on-close
        :title="domainApplyTitle"
        @cancel="closeDomainApply"
        @ok="
          () => submitDomainApply((slotProps as Record<string, any>).loadList)
        "
      >
        <Form layout="vertical">
          <Form.Item v-if="isTenantlessUser" label="归属租户" required>
            <Select
              v-model:value="applyDomainForm.tenantId"
              allow-clear
              class="w-full"
              :filter-option="filterSelectOption"
              :options="tenantOptions"
              placeholder="请选择归属租户"
              show-search
            />
          </Form.Item>
          <Form.Item label="域名供应商" required>
            <Select
              v-model:value="applyDomainForm.domainVendor"
              allow-clear
              class="w-full"
              :filter-option="filterSelectOption"
              :options="domainVendorOptions"
              placeholder="请选择域名供应商"
              show-search
              @change="
                (value) =>
                  handleApplyDomainVendorChange(value as string | undefined)
              "
            />
          </Form.Item>
          <Form.Item label="域名后缀" required>
            <Select
              v-model:value="applyDomainForm.domainSuffix"
              allow-clear
              class="w-full"
              :disabled="!applyDomainForm.domainVendor"
              :filter-option="filterSelectOption"
              :options="getApplyDomainSuffixOptions()"
              placeholder="请先选择域名供应商"
              show-search
              @change="
                (value) =>
                  handleApplyDomainSuffixChange(value as string | undefined)
              "
            />
          </Form.Item>
          <Form.Item label="域名前缀" required>
            <Input
              :value="applyDomainForm.domainPrefix"
              class="w-full"
              placeholder="请输入域名前缀"
              @update:value="
                (value) =>
                  handleApplyDomainPrefixChange(value as string | undefined)
              "
            />
          </Form.Item>
          <Form.Item label="完整域名">
            <Input
              :value="applyDomainForm.domain"
              class="w-full"
              disabled
              placeholder="由前缀和后缀自动生成"
            />
          </Form.Item>
        </Form>
      </Modal>
    </template>
  </CrudPage>
</template>
