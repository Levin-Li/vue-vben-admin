<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { domainService, type DomainRecord } from '../../api/domain-service';

import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { Button, Form, Input, Modal, Select, message } from 'ant-design-vue';

import {
  getTenantSiteSuffixApplyApi,
  getTenantSiteVendorApplyApi,
  getTenantSiteVendorDomainRenewBeforeDays,
  getTenantSiteVendorSuffixOptions,
  tenantOptionsLoader,
  tenantSiteVendorOptionsLoader,
} from '../api-module';
import CrudPage from '../crud-page.vue';
import { domainPageCrudConfig } from './config';
import DnsRecordManager from './dns-record-manager.vue';

const dnsManagerOpen = ref(false);
const selectedDomain = ref<DomainRecord | null>(null);
const domainApplyOpen = ref(false);
const domainApplying = ref(false);
const providerOptions = ref<Array<{ label: string; value: any }>>([]);
const tenantOptions = ref<Array<{ label: string; value: any }>>([]);
const userStore = useUserStore();

const applyDomainForm = reactive({
  domain: '',
  domainApplyApi: undefined as string | undefined,
  domainPrefix: '',
  domainSuffix: undefined as string | undefined,
  providerName: undefined as string | undefined,
  tenantId: undefined as string | undefined,
});

const pageConfig = computed(() => ({
  ...domainPageCrudConfig,
  rowActions: [
    {
      handler: async (record: DomainRecord) => {
        selectedDomain.value = record;
        dnsManagerOpen.value = true;
        return record;
      },
      label: '域名解析',
      permission: buildApiMethodPermissions(domainService, 'listDnsRecords'),
      reloadAfterAction: false as const,
      successMessage: false as const,
      visible: canUseDomainProviderActions,
    },
    {
      handler: async (record: DomainRecord) => {
        await domainService.syncDomainStatus(String(record.id || ''));
      },
      label: '同步状态',
      permission: buildApiMethodPermissions(domainService, 'syncDomainStatus'),
      visible: canUseDomainProviderActions,
    },
    {
      handler: async (record: DomainRecord) => {
        if (!isDomainRenewDue(record)) {
          message.warning(
            `域名[${record.name || '-'}]还没有进入提前续期窗口，暂时无需续期`,
          );
          return record;
        }
        const confirmed = await confirmRenewDomain(record);
        if (!confirmed) {
          return record;
        }
        await domainService.renewDomain(String(record.id || ''));
        message.success('续期域名成功');
      },
      label: '续期域名',
      permission: buildApiMethodPermissions(domainService, 'renewDomain'),
      successMessage: false as const,
      visible: canShowRenewDomain,
    },
  ],
}));

function canUseDomainProviderActions(record: Record<string, any>) {
  return Boolean(record?.id && isRealDomainName(record?.name));
}

function isRealDomainName(domain: unknown) {
  const host = normalizeDomainHost(domain);

  if (!host || host === 'localhost' || host.endsWith('.localhost')) {
    return false;
  }

  if (isIpAddress(host)) {
    return false;
  }

  if (host.length > 253 || host.startsWith('.') || host.endsWith('.')) {
    return false;
  }

  const labels = host.split('.');
  if (labels.length < 2) {
    return false;
  }

  return (
    /^[a-z]{2,63}$/.test(labels[labels.length - 1] || '') &&
    labels.every((label) =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
    )
  );
}

function normalizeDomainHost(domain: unknown) {
  let host = String(domain || '')
    .trim()
    .toLowerCase();

  try {
    host = new URL(host.includes('://') ? host : `http://${host}`).hostname;
  } catch {
    host = host.split('/')[0] || '';
  }

  host = host.replace(/^\[(.*)]$/, '$1');
  return host.replace(/\.$/, '');
}

function isIpAddress(host: string) {
  return isIpv4Address(host) || host.includes(':');
}

function isIpv4Address(host: string) {
  const parts = host.split('.');
  return (
    parts.length === 4 &&
    parts.every((part) => {
      if (!/^\d{1,3}$/.test(part)) {
        return false;
      }
      const value = Number(part);
      return value >= 0 && value <= 255;
    })
  );
}

function filterSelectOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  if (!keyword) {
    return true;
  }

  const label = String(option?.label ?? '').toLowerCase();
  const value = String(option?.value ?? '').toLowerCase();

  return label.includes(keyword) || value.includes(keyword);
}

const isSaasUser = computed(() => {
  const userInfo = userStore.userInfo as Record<string, any>;
  let roles: any[] = [];

  if (Array.isArray(userInfo?.roles)) {
    roles = userInfo.roles;
  } else if (Array.isArray(userInfo?.roleList)) {
    roles = userInfo.roleList;
  }

  return (
    userInfo?.saasUser === true ||
    userInfo?.isSaasUser === true ||
    userInfo?.saasAdmin === true ||
    userInfo?.isSaasAdmin === true ||
    roles.some((role) => String(role || '').startsWith('R_SAAS'))
  );
});

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
    ? `${normalizedPrefix}${normalizedSuffix}`.toLowerCase()
    : '';
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

function getRenewBeforeMs(days?: number) {
  const normalizedDays = Number(days);
  return (
    (Number.isFinite(normalizedDays) && normalizedDays >= 0
      ? normalizedDays
      : 30) *
    24 *
    60 *
    60 *
    1000
  );
}

function isDomainRenewDue(record: Record<string, any>) {
  if (record?.neverExpires) {
    return false;
  }

  const expiredAt = parseDateTimeValue(record?.domainExpiredTime);

  if (Number.isNaN(expiredAt)) {
    return false;
  }

  return (
    expiredAt <=
    Date.now() +
      getRenewBeforeMs(
        getTenantSiteVendorDomainRenewBeforeDays(record?.providerName),
      )
  );
}

function canShowRenewDomain(record: Record<string, any>) {
  return Boolean(
    record?.id &&
    isRealDomainName(record?.name) &&
    isDomainRenewDue(record) &&
    record.domainApplyStatus !== 'Applying' &&
    record.domainApplyStatus !== 'Renewing',
  );
}

function confirmRenewDomain(record: Record<string, any>) {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      cancelText: '取消',
      content: `确认续期域名[${record.name || '-'}]吗？`,
      okText: '确定',
      title: '续期确认',
      onCancel: () => resolve(false),
      onOk: () => resolve(true),
    });
  });
}

function resetApplyDomainForm() {
  applyDomainForm.domain = '';
  applyDomainForm.domainApplyApi = undefined;
  applyDomainForm.domainPrefix = '';
  applyDomainForm.domainSuffix = undefined;
  applyDomainForm.providerName = undefined;
  applyDomainForm.tenantId = undefined;
}

function syncApplyDomain() {
  applyDomainForm.domain = buildApplyDomain(
    applyDomainForm.domainPrefix,
    applyDomainForm.domainSuffix,
  );
}

function getApplyDomainSuffixOptions() {
  return applyDomainForm.providerName
    ? getTenantSiteVendorSuffixOptions(applyDomainForm.providerName)
    : [];
}

function openDomainApply() {
  resetApplyDomainForm();
  domainApplyOpen.value = true;
}

function closeDomainApply() {
  domainApplyOpen.value = false;
  resetApplyDomainForm();
}

function handleApplyDomainVendorChange(vendor?: string) {
  applyDomainForm.providerName = vendor;
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
    (applyDomainForm.providerName
      ? getTenantSiteVendorApplyApi(applyDomainForm.providerName)
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
    (applyDomainForm.providerName
      ? getTenantSiteVendorApplyApi(applyDomainForm.providerName)
      : undefined) ||
    getTenantSiteSuffixApplyApi(domainSuffix);

  if (!applyDomainForm.providerName) {
    message.warning('请选择域名供应商');
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
    await domainService.applyDomain({
      domain,
      domainApplyApi,
      providerName: applyDomainForm.providerName,
      tenantId: isSaasUser.value ? applyDomainForm.tenantId : undefined,
    });
    message.success('域名申请成功');
    closeDomainApply();
    await loadList?.();
  } catch (error) {
    console.error(error);
  } finally {
    domainApplying.value = false;
  }
}

onMounted(async () => {
  providerOptions.value = await tenantSiteVendorOptionsLoader();
  if (isSaasUser.value) {
    tenantOptions.value = await tenantOptionsLoader();
  }
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
    <template #modals="slotProps">
      <DnsRecordManager
        v-if="selectedDomain"
        v-model:open="dnsManagerOpen"
        :domain="selectedDomain"
        @saved="() => (slotProps as Record<string, any>).loadList?.()"
      />
      <Modal
        v-model:open="domainApplyOpen"
        :confirm-loading="domainApplying"
        destroy-on-close
        title="申请域名"
        @cancel="closeDomainApply"
        @ok="
          () => submitDomainApply((slotProps as Record<string, any>).loadList)
        "
      >
        <Form layout="vertical">
          <Form.Item v-if="isSaasUser" label="所属租户">
            <Select
              v-model:value="applyDomainForm.tenantId"
              allow-clear
              class="w-full"
              :filter-option="filterSelectOption"
              :options="tenantOptions"
              placeholder="请选择所属租户"
              show-search
            />
          </Form.Item>
          <Form.Item label="域名供应商" required>
            <Select
              v-model:value="applyDomainForm.providerName"
              allow-clear
              class="w-full"
              :filter-option="filterSelectOption"
              :options="providerOptions"
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
              :disabled="!applyDomainForm.providerName"
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
