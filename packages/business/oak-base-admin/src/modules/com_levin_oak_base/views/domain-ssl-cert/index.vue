<script lang="ts" setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import type {
  DomainSslCertManualConfig,
  DomainSslCertRecord,
} from '@levin/oak-base-admin/modules/com_levin_oak_base/api/domain-ssl-cert';

import { Form, Input, Modal, Spin, message } from 'ant-design-vue';

import { domainSslCertService } from '@levin/oak-base-admin/modules/com_levin_oak_base/api/domain-ssl-cert';

import CrudPage from '../crud-page.vue';
import { domainSslCertPageCrudConfig } from './config';

const SSL_CERT_REQUEST_TIMEOUT_MS = 180_000;

const route = useRoute();
const manualOpen = ref(false);
const manualSubmitting = ref(false);
const manualTargetCert = ref<DomainSslCertRecord | null>(null);
const pageReady = ref(false);
let lastPreparedKey = '';

const manualForm = reactive<DomainSslCertManualConfig>({
  id: '',
  remark: '',
  sslCertChainPem: '',
  sslPrivateKeyPem: '',
});

const pageConfig = computed(() => ({
  ...domainSslCertPageCrudConfig,
  defaultQuery: {
    ...domainSslCertPageCrudConfig.defaultQuery,
    ...buildRouteQueryDefaults(),
  },
  rowActions: [
    {
      confirmText: '确认申请当前域名的 SSL 证书吗？',
      handler: async (record: DomainSslCertRecord) => {
        await domainSslCertService.applySslCert(
          {
            id: record.id,
          },
          {
            timeout: SSL_CERT_REQUEST_TIMEOUT_MS,
          },
        );
      },
      label: '申请SSL证书',
      visible: canApplySslCert,
    },
    {
      handler: async (record: DomainSslCertRecord) => {
        openManualConfig(record);
        return record;
      },
      label: '手动配置证书',
      reloadAfterAction: false as const,
      successMessage: false as const,
      visible: hasCertDomain,
    },
    {
      handler: async (record: DomainSslCertRecord) => {
        await domainSslCertService.downloadCert({
          domain: record.domain,
          id: record.id,
        });
      },
      label: '下载证书',
      reloadAfterAction: false as const,
      successMessage: false as const,
      visible: canUseCertFileAction,
    },
  ],
}));

function firstQueryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function getRouteString(key: string) {
  return String(firstQueryValue(route.query[key]) || '').trim();
}

function getRoutePrepareKey() {
  const action = getRouteString('action');
  const domain = getRouteString('domain');
  const recordId = getRouteString('recordId');
  return action === 'apply' && domain ? `${domain}:${recordId}` : '';
}

function buildRouteQueryDefaults() {
  const domain = getRouteString('domain');
  return domain ? { domain } : {};
}

function resetManualForm() {
  Object.assign(manualForm, {
    id: '',
    remark: '',
    sslCertChainPem: '',
    sslPrivateKeyPem: '',
  });
}

function getListItems(data: any): DomainSslCertRecord[] {
  if (Array.isArray(data)) {
    return data;
  }
  return data?.items || data?.records || data?.list || [];
}

async function prepareCertRecordFromRoute() {
  const prepareKey = getRoutePrepareKey();
  if (!prepareKey || prepareKey === lastPreparedKey) {
    return;
  }

  lastPreparedKey = prepareKey;

  const domain = getRouteString('domain').toLowerCase();
  const rootDomain = getRouteString('rootDomain').toLowerCase();

  if (!validateDomain(domain)) {
    return;
  }

  const existed = getListItems(
    await domainSslCertService.list({
      domain,
      pageIndex: 1,
      pageSize: 1,
      requireResultList: true,
      requireTotals: true,
    }),
  )[0];

  if (existed) {
    message.info('该域名已经有SSL证书记录，请在当前页面操作');
    return;
  }

  await domainSslCertService.create({
    domain,
    editable: true,
    enable: true,
    name: domain,
    orderCode: 100,
    sslApplyStatus: 'UnCommit',
    rootDomain: rootDomain || undefined,
  });
  message.success('已创建SSL证书记录，请在当前页面申请证书');
}

function parseDateTimeValue(value: unknown) {
  if (!value) {
    return Number.NaN;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  return new Date(String(value).trim().replace(' ', 'T')).getTime();
}

function isCertificateEligibleDomain(domain?: string) {
  const normalizedDomain = String(domain || '')
    .trim()
    .toLowerCase();

  if (!normalizedDomain || normalizedDomain === 'localhost') {
    return false;
  }

  return !/^((25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(25[0-5]|2[0-4]\d|[01]?\d?\d)$/.test(
    normalizedDomain,
  );
}

function hasCertDomain(record: Record<string, any>) {
  return isCertificateEligibleDomain(record?.domain);
}

function hasCertMaterial(record: Record<string, any>) {
  return Boolean(
    String(record?.sslCertChainPem || '').trim() &&
    String(record?.sslPrivateKeyPem || '').trim(),
  );
}

function canApplySslCert(record: Record<string, any>) {
  if (!hasCertDomain(record)) {
    return false;
  }

  if (
    record.sslApplyStatus === 'Applying' ||
    record.sslApplyStatus === 'Renewing'
  ) {
    return false;
  }

  if (record.sslApplyStatus === 'Failed' || !record.sslCertExpiredTime) {
    return true;
  }

  const expiredAt = parseDateTimeValue(record.sslCertExpiredTime);
  const renewBeforeMs = 30 * 24 * 60 * 60 * 1000;
  return Number.isNaN(expiredAt)
    ? false
    : expiredAt <= Date.now() + renewBeforeMs;
}

function canUseCertFileAction(record: Record<string, any>) {
  return Boolean(
    hasCertDomain(record) && record?.id && hasCertMaterial(record),
  );
}

function openManualConfig(record: DomainSslCertRecord) {
  manualTargetCert.value = record;
  Object.assign(manualForm, {
    id: record.id || '',
    remark: '',
    sslCertChainPem: '',
    sslPrivateKeyPem: '',
  });
  manualOpen.value = true;
}

function closeManualModal() {
  manualOpen.value = false;
  manualTargetCert.value = null;
  resetManualForm();
}

function validateDomain(domain?: string) {
  if (!isCertificateEligibleDomain(domain)) {
    message.warning('请输入可申请证书的域名');
    return false;
  }
  return true;
}

async function submitManual(loadList?: () => void | Promise<void>) {
  manualForm.sslCertChainPem = String(manualForm.sslCertChainPem || '').trim();
  manualForm.sslPrivateKeyPem = String(
    manualForm.sslPrivateKeyPem || '',
  ).trim();

  const certDomain = String(manualTargetCert.value?.domain || '').trim();
  if (!validateDomain(certDomain)) {
    return;
  }
  if (!manualForm.id) {
    message.warning('证书记录ID不能为空');
    return;
  }
  if (!manualForm.sslCertChainPem) {
    message.warning('请输入证书链PEM');
    return;
  }
  if (!manualForm.sslPrivateKeyPem) {
    message.warning('请输入私钥PEM');
    return;
  }

  manualSubmitting.value = true;
  try {
    await domainSslCertService.configManualSslCert(manualForm, {
      timeout: SSL_CERT_REQUEST_TIMEOUT_MS,
    });
    message.success('SSL证书已配置');
    closeManualModal();
    await loadList?.();
  } finally {
    manualSubmitting.value = false;
  }
}

onMounted(async () => {
  resetManualForm();
  try {
    await prepareCertRecordFromRoute();
  } finally {
    pageReady.value = true;
  }
});

watch(
  () => route.query,
  () => {
    if (!manualOpen.value) {
      resetManualForm();
    }
    const prepareKey = getRoutePrepareKey();
    if (prepareKey && prepareKey !== lastPreparedKey) {
      void prepareCertRecordFromRoute();
    }
  },
);
</script>

<template>
  <Spin v-if="!pageReady" class="flex min-h-80 items-center justify-center" />
  <CrudPage v-else :config="pageConfig">
    <template #modals="slotProps">
      <Modal
        v-model:open="manualOpen"
        :confirm-loading="manualSubmitting"
        :width="960"
        destroy-on-close
        title="手动配置证书"
        @cancel="closeManualModal"
        @ok="() => submitManual((slotProps as Record<string, any>).loadList)"
      >
        <Form layout="vertical">
          <div class="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
            <Form.Item label="证书域名" required>
              <Input
                :value="manualTargetCert?.domain || ''"
                disabled
                placeholder="例如 a.example.com"
              />
            </Form.Item>
            <Form.Item label="备注">
              <Input.TextArea
                v-model:value="manualForm.remark"
                :auto-size="{ minRows: 1, maxRows: 3 }"
                placeholder="可选"
              />
            </Form.Item>
            <Form.Item
              class="md:col-span-2"
              label="证书链PEM"
              required
              extra="完整证书链PEM，叶子证书在前，后面跟中间证书。"
            >
              <Input.TextArea
                v-model:value="manualForm.sslCertChainPem"
                :auto-size="{ minRows: 9, maxRows: 14 }"
                placeholder="-----BEGIN CERTIFICATE-----"
              />
            </Form.Item>
            <Form.Item
              class="md:col-span-2"
              label="私钥PEM"
              required
              extra="支持 BEGIN PRIVATE KEY 和 BEGIN RSA PRIVATE KEY，不支持加密私钥。"
            >
              <Input.TextArea
                v-model:value="manualForm.sslPrivateKeyPem"
                :auto-size="{ minRows: 9, maxRows: 14 }"
                placeholder="-----BEGIN PRIVATE KEY-----"
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </template>
  </CrudPage>
</template>
