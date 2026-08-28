<script lang="ts" setup>
import { computed, reactive, ref } from 'vue';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  message,
  Modal,
  Tag,
} from 'ant-design-vue';

import { electronicInvoiceProviderConnectionService } from '../../api/electronic-invoice-provider-connection-service';
import CrudPage from '../crud-page.vue';
import {
  electronicInvoiceProviderConnectionPageCrudConfig,
  electronicInvoiceProviderOptions,
  getElectronicInvoiceProviderGuide,
} from './config';

const authorizationOpen = ref(false);
const authorizationSaving = ref(false);
const selected = ref<any>();
const reloadConnections = ref<(() => Promise<void> | void) | undefined>();
const providerGuideOpen = ref(false);
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

const providerGuides = computed(() =>
  electronicInvoiceProviderOptions.map((provider) => ({
    ...provider,
    guide: getElectronicInvoiceProviderGuide(provider.value),
  })),
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

  if (!selected.value?.partnerId || !authorizationRef) {
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
      partnerId: selected.value.partnerId,
      providerCode: selected.value.providerCode,
      tenantId: selected.value.tenantId,
      authorizationRef,
      expiredTime: form.expiredTime,
      providerMerchantId: providerMerchantId || undefined,
      terminalRef: terminalRef || undefined,
      invoiceTypeList: invoiceTypeList.length > 0 ? invoiceTypeList : undefined,
    });
    message.success(`${guide.name}商户授权已确认`);
    authorizationOpen.value = false;
    await reloadConnections.value?.();
  } catch (error) {
    console.error(error);
    message.error('确认商户授权失败');
  } finally {
    authorizationSaving.value = false;
  }
}
</script>
<template>
  <div class="electronic-invoice-provider-connection-page">
    <Alert
      message="商户自助接入说明"
      description="我们当前支持商户在系统内自行发起电子发票接入。建议先开启模拟器走完整个授权、开票、回调与补偿闭环，再切换到正式环境。腾讯电子发票默认按灰度/模拟联调处理。"
      show-icon
      type="info"
    />

    <Card title="供应商接入概览" size="small">
      <div class="provider-guide-grid">
        <article
          v-for="provider in providerGuides"
          :key="provider.value"
          class="provider-guide-card"
        >
          <div class="provider-guide-card__header">
            <div>
              <div class="provider-guide-card__title">
                {{ provider.guide.name }}
              </div>
              <div class="provider-guide-card__summary">
                {{ provider.guide.summary }}
              </div>
            </div>
            <Tag
              :color="
                provider.guide.supportLevel === 'limited'
                  ? 'warning'
                  : 'success'
              "
            >
              {{ provider.guide.statusTag }}
            </Tag>
          </div>
          <div class="provider-guide-card__section-title">商户需先完成</div>
          <ul class="provider-guide-card__list">
            <li
              v-for="step in provider.guide.authorizationSteps"
              :key="`${provider.value}-${step}`"
            >
              {{ step }}
            </li>
          </ul>
          <div class="provider-guide-card__footer">
            {{ provider.guide.merchantFit }}
          </div>
        </article>
      </div>
      <div class="provider-guide-actions">
        <Button type="primary" @click="providerGuideOpen = true">
          查看正式接入清单
        </Button>
      </div>
    </Card>

    <CrudPage :config="pageConfig">
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
          确认商户授权
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
    title="确认商户供应商授权"
    @ok="submitAuthorization"
  >
    <Alert
      :description="selectedGuide.authorizationRefHelp"
      :message="selectedGuide.productionGuard"
      :type="selectedGuide.supportLevel === 'limited' ? 'warning' : 'info'"
      class="mb-4"
      show-icon
    />
    <Form layout="vertical">
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

  <Modal
    v-model:open="providerGuideOpen"
    :footer="null"
    :mask-closable="true"
    destroy-on-close
    title="电子发票供应商正式接入清单"
  >
    <div class="provider-guide-modal">
      <section
        v-for="provider in providerGuides"
        :key="`${provider.value}-checklist`"
        class="provider-guide-modal__section"
      >
        <div class="provider-guide-modal__header">
          <strong>{{ provider.guide.name }}</strong>
          <Tag
            :color="
              provider.guide.supportLevel === 'limited'
                ? 'warning'
                : 'processing'
            "
          >
            {{ provider.guide.statusTag }}
          </Tag>
        </div>
        <div class="provider-guide-modal__block-title">正式接入前检查</div>
        <ul class="provider-guide-card__list">
          <li
            v-for="item in provider.guide.liveRequirements"
            :key="`${provider.value}-requirement-${item}`"
          >
            {{ item }}
          </li>
        </ul>
        <Alert
          :message="provider.guide.productionGuard"
          :type="provider.guide.supportLevel === 'limited' ? 'warning' : 'info'"
          show-icon
        />
      </section>
    </div>
  </Modal>
</template>

<style scoped>
.electronic-invoice-provider-connection-page {
  display: grid;
  gap: 12px;
}

.provider-guide-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.provider-guide-card {
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  display: grid;
  gap: 10px;
  padding: 16px;
}

.provider-guide-card__header,
.provider-guide-modal__header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.provider-guide-card__title {
  color: hsl(var(--foreground));
  font-size: 15px;
  font-weight: 600;
}

.provider-guide-card__summary,
.provider-guide-card__footer {
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  line-height: 1.6;
}

.provider-guide-card__section-title,
.provider-guide-modal__block-title {
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
}

.provider-guide-card__list {
  color: hsl(var(--foreground));
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 18px;
}

.provider-guide-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.provider-guide-modal {
  display: grid;
  gap: 16px;
}

.provider-guide-modal__section {
  display: grid;
  gap: 10px;
}
</style>
