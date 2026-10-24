<script lang="ts" setup>
import { h, ref } from 'vue';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { Button, message, Modal } from 'ant-design-vue';

import { electronicContractService } from '../../api/electronic-contract-service';
import CrudPage from '../crud-page.vue';
import { electronicContractPageCrudConfig } from './config';
import ContractCounterpartyPicker from './contract-counterparty-picker.vue';
import ContractPreviewPanel from './contract-preview-panel.vue';
import ContractTemplateValues from './contract-template-values.vue';

const { hasPermission } = useRbacAccess();
const signingEntryPermission = buildApiMethodPermissions(
  electronicContractService,
  'signingEntry',
);
const detailPermission = buildApiMethodPermissions(
  electronicContractService,
  'retrieve',
);
const previewOpen = ref(false);
const previewContract = ref<Record<string, any>>();

// 预览只读取当前合同的受控正文，示例 Word 不再占据管理页。
async function openPreview(record: Record<string, any>) {
  try {
    const response = await electronicContractService.retrieve({
      id: record.id,
      tenantId: record.tenantId,
      orgId: record.orgId,
      ownerId: record.ownerId,
    });
    const payload =
      response && typeof response === 'object' && 'data' in response
        ? response.data
        : response;
    previewContract.value = payload as Record<string, any>;
    previewOpen.value = true;
  } catch (error_) {
    message.error(error_ instanceof Error ? error_.message : '加载合同失败');
  }
}

// 签署入口按甲乙方分别领取；仅展示本次响应中的短时安全链接。
async function openSigningEntry(
  record: Record<string, any>,
  signerIndex: 0 | 1,
) {
  try {
    const response = await electronicContractService.signingEntry({
      id: String(record.id),
      signerIndex,
      tenantId: record.tenantId,
      orgId: record.orgId,
      ownerId: record.ownerId,
    });
    const payload =
      response && typeof response === 'object' && 'data' in response
        ? response.data
        : response;
    const url = (payload as { url?: string })?.url;
    if (!url) throw new Error('签署入口无效');

    // 仅允许 HTTPS、本站地址或受控本机模拟器地址进入可点击链接。
    const target = new URL(url, window.location.origin);
    const localSimulation =
      target.origin === 'http://127.0.0.1:8081' &&
      target.pathname.startsWith(
        '/com.levin.oak.base/V1/api/EContractSimulation/esign/',
      );
    if (
      target.protocol !== 'https:' &&
      target.origin !== window.location.origin &&
      !localSimulation
    ) {
      throw new Error('签署入口无效');
    }
    Modal.info({
      title: signerIndex === 0 ? '甲方签署入口' : '乙方签署入口',
      content: h(
        'a',
        { href: target.href, target: '_blank', rel: 'noopener noreferrer' },
        '打开签署页面',
      ),
    });
  } catch (error_) {
    message.error(
      error_ instanceof Error ? error_.message : '领取签署入口失败',
    );
  }
}
</script>

<template>
  <div class="electronic-contract-page">
    <!-- 电子合同沿用标准 CRUD；仅在新增表单补充两方选择和模板变量。 -->
    <CrudPage :config="electronicContractPageCrudConfig">
      <template #form-field-counterpartyId="{ disabled, formState }">
        <ContractCounterpartyPicker
          v-model="formState.counterpartyId"
          :disabled="disabled"
          :kind="formState.counterpartyKind"
        />
      </template>
      <template #form-field-templateValues="{ disabled, formState }">
        <ContractTemplateValues
          v-model="formState.templateValues"
          :disabled="disabled"
          :template-id="formState.templateId"
          :tenant-id="formState.tenantId"
        />
      </template>
      <template #row-actions="{ record }">
        <Button
          v-if="hasPermission(detailPermission)"
          size="small"
          type="link"
          @click="openPreview(record)"
        >
          预览合同
        </Button>
        <template
          v-if="
            record.status === 'Signing' && hasPermission(signingEntryPermission)
          "
        >
          <Button size="small" type="link" @click="openSigningEntry(record, 0)">
            甲方签署入口
          </Button>
          <Button size="small" type="link" @click="openSigningEntry(record, 1)">
            乙方签署入口
          </Button>
        </template>
      </template>
    </CrudPage>
    <Modal
      v-model:open="previewOpen"
      :footer="null"
      title="合同预览"
      width="900px"
    >
      <ContractPreviewPanel
        v-if="previewContract"
        :contract="previewContract"
      />
    </Modal>
  </div>
</template>
