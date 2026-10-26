<script lang="ts" setup>
import { computed, reactive, ref } from 'vue';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  message,
  Modal,
} from 'ant-design-vue';

import { electronicInvoiceProviderConnectionService } from '../../api/electronic-invoice-provider-connection-service';
import CrudPage from '../crud-page.vue';
import AuthorizationLegalSubjectPicker from './authorization-legal-subject-picker.vue';
import {
  electronicInvoiceProviderConnectionPageCrudConfig,
  getElectronicInvoiceProviderGuide,
} from './config';

const authorizationOpen = ref(false);
const authorizationSaving = ref(false);
const selected = ref<any>();
const reloadConnections = ref<(() => Promise<void> | void) | undefined>();
const form = reactive({
  authorizationRef: '',
  expiredTime: undefined as string | undefined,
  invoiceTypeListText: '',
  providerMerchantId: '',
  terminalRef: '',
});
const { hasPermission } = useRbacAccess();
const completeAuthorizationPermission = buildApiMethodPermissions(
  electronicInvoiceProviderConnectionService,
  'completeAuthorization',
);

const selectedGuide = computed(() =>
  getElectronicInvoiceProviderGuide(selected.value?.providerCode),
);

const pageConfig = computed(
  () => electronicInvoiceProviderConnectionPageCrudConfig,
);

function openAuthorization(record: any, reload: () => Promise<void> | void) {
  selected.value = record;
  reloadConnections.value = reload;
  form.authorizationRef = '';
  form.expiredTime = record?.expiredTime;
  form.providerMerchantId = record?.providerMerchantId || '';
  form.terminalRef = '';
  form.invoiceTypeListText = Array.isArray(record?.invoiceTypeList)
    ? record.invoiceTypeList.join(', ')
    : '';
  authorizationOpen.value = true;
}

async function submitAuthorization() {
  const authorizationRef = form.authorizationRef.trim();
  const providerMerchantId = form.providerMerchantId.trim();
  const terminalRef = form.terminalRef.trim();
  const invoiceTypeList = [
    ...new Set(
      form.invoiceTypeListText
        .split(/[，,\n]/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  const guide = selectedGuide.value;

  if (!selected.value?.legalSubjectId) {
    message.warning('请选择需要开票的法律主体');
    return;
  }
  if (!authorizationRef) {
    message.warning(`请填写${guide.authorizationRefLabel}`);
    return;
  }

  if (guide.terminalRefRequired && !terminalRef) {
    message.warning(`请填写${guide.terminalRefLabel}`);
    return;
  }
  if (invoiceTypeList.some((invoiceType) => invoiceType.length > 64)) {
    message.warning('允许票种中的单个编码不能超过 64 个字符');
    return;
  }

  authorizationSaving.value = true;
  try {
    await electronicInvoiceProviderConnectionService.completeAuthorization({
      legalSubjectId: selected.value.legalSubjectId,
      providerCode: selected.value.providerCode,
      tenantId: selected.value.tenantId,
      authorizationRef,
      expiredTime: form.expiredTime,
      providerMerchantId: providerMerchantId || undefined,
      terminalRef: terminalRef || undefined,
      invoiceTypeList: invoiceTypeList.length > 0 ? invoiceTypeList : undefined,
    });
    message.success(`${guide.name}开票授权已确认`);
    authorizationOpen.value = false;
    await reloadConnections.value?.();
  } catch (error) {
    console.error(error);
    message.error('确认开票授权失败');
  } finally {
    authorizationSaving.value = false;
  }
}
</script>
<template>
  <!-- 日常授权页直接呈现查询和记录，办理提示只在具体操作中展示。 -->
  <div class="electronic-invoice-provider-connection-page">
    <CrudPage :config="pageConfig">
      <template #search-field-legalSubjectId="{ searchState }">
        <AuthorizationLegalSubjectPicker
          v-model="searchState.legalSubjectId"
          :tenant-id="searchState.tenantId"
        />
      </template>
      <template #form-field-legalSubjectId="{ formState }">
        <AuthorizationLegalSubjectPicker
          v-model="formState.legalSubjectId"
          :tenant-id="formState.tenantId"
        />
      </template>
      <template #row-actions="{ record, reload }">
        <Button
          v-if="
            record?.status === 'PendingAuthorization' &&
            hasPermission(completeAuthorizationPermission)
          "
          size="small"
          type="link"
          @click="openAuthorization(record, reload)"
        >
          确认授权
        </Button>
      </template>
    </CrudPage>
  </div>

  <Modal
    v-model:open="authorizationOpen"
    :confirm-loading="authorizationSaving"
    :mask-closable="false"
    destroy-on-close
    ok-text="确认授权"
    title="确认开票授权"
    @ok="submitAuthorization"
  >
    <Alert
      :description="selectedGuide.authorizationRefHelp"
      :message="selectedGuide.productionGuard"
      :type="selectedGuide.supportLevel === 'limited' ? 'warning' : 'info'"
      class="mb-4"
      show-icon
    />
    <Form
      id="electronic-invoice-provider-authorization"
      name="electronicInvoiceProviderAuthorization"
      data-form-id="electronic-invoice-provider-authorization"
      data-form-name="确认开票授权"
      layout="vertical"
    >
      <Form.Item :label="selectedGuide.authorizationRefLabel" required>
        <Input
          v-model:value="form.authorizationRef"
          :maxlength="256"
          :placeholder="selectedGuide.authorizationRefPlaceholder"
        />
      </Form.Item>
      <Form.Item
        :extra="selectedGuide.terminalRefHelp"
        :label="selectedGuide.terminalRefLabel"
      >
        <Input v-model:value="form.terminalRef" :maxlength="128" />
      </Form.Item>
      <Form.Item
        extra="填写供应商授权结果返回的商户号、企业编码或租户标识；不要填写平台 AppId、密钥或税务局账号。"
        label="供应商商户标识"
      >
        <Input v-model:value="form.providerMerchantId" :maxlength="192" />
      </Form.Item>
      <Form.Item
        extra="多个票种编码可用逗号、中文逗号或换行分隔；只填写供应商已授权的非敏感票种编码。"
        label="允许票种"
      >
        <Input.TextArea
          v-model:value="form.invoiceTypeListText"
          :maxlength="1024"
          :rows="2"
        />
      </Form.Item>
      <Form.Item
        extra="供应商明确返回授权或票种有效期时填写；未返回可留空，由后续查询或续期流程更新。"
        label="授权/票种有效期"
      >
        <DatePicker
          v-model:value="form.expiredTime"
          show-time
          value-format="YYYY-MM-DD HH:mm:ss"
        />
      </Form.Item>
    </Form>
  </Modal>
</template>
