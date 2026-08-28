<script lang="ts" setup>
import type { ContractSealPosition } from '../../components/electronic-contract/contract-document-preview-utils';

import { computed, ref } from 'vue';

import { Alert, Button, Card, Input } from 'ant-design-vue';

import { ElectronicContractDocumentPreview } from '../../components/electronic-contract';
import { electronicContractService } from '../../api/electronic-contract-service';
import CrudPage from '../crud-page.vue';
import { electronicContractPageCrudConfig } from './config';

const previewUrl = ref('');
const previewPositionsText = ref(
  JSON.stringify(
    [
      {
        height: 0.12,
        pageNo: 1,
        signerLabel: '甲方签章',
        source: 'override',
        width: 0.22,
        x: 0.64,
        y: 0.78,
      },
    ],
    null,
    2,
  ),
);
const previewError = ref('');
const simulationContractId = ref('contract-001');
const simulationStatus = ref<'Archived' | 'Canceled' | 'Draft' | 'Expired' | 'Rejected' | 'Signed' | 'Signing'>('Draft');
const simulationMessage = ref('选择草稿合同后，可逐步模拟提交签署、查看日志、复制重签和下载已签文件。');
const simulationMessageType = ref<'info' | 'success' | 'warning'>('info');

previewUrl.value = '/mock-files/electronic-contract-sample.docx';

const previewPositions = computed<ContractSealPosition[]>(() => {
  try {
    previewError.value = '';
    const parsed = JSON.parse(previewPositionsText.value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    previewError.value =
      error instanceof Error ? error.message : '签章位置 JSON 解析失败';
    return [];
  }
});

const canSubmitSigning = computed(() => simulationStatus.value === 'Draft');
const canReceiveCallback = computed(() => simulationStatus.value === 'Signing');
const canReplayCompletedCallback = computed(() => ['Signed', 'Signing'].includes(simulationStatus.value));
const canCancelSigning = computed(() => simulationStatus.value === 'Signing');
const canDownloadSignedFile = computed(() => simulationStatus.value === 'Signed');
const canCopyForResign = computed(() => ['Archived', 'Canceled', 'Expired', 'Rejected', 'Signed'].includes(simulationStatus.value));
const canArchive = computed(() => ['Canceled', 'Expired', 'Rejected', 'Signed'].includes(simulationStatus.value));

async function loadSimulationContract() {
  try {
    const response = await electronicContractService.retrieve({ id: simulationContractId.value });
    const data = response?.data ?? response;
    simulationStatus.value = data?.status || 'Draft';
    simulationMessage.value = `合同 ${data?.contractNo || simulationContractId.value} 已加载，当前状态：${simulationStatus.value}。`;
    simulationMessageType.value = 'success';
  } catch (error) {
    simulationMessage.value = error instanceof Error ? error.message : '加载合同状态失败';
    simulationMessageType.value = 'warning';
  }
}

async function runSimulationAction(
  action: 'archive' | 'cancelSigning' | 'copyForResign' | 'downloadSignedFile' | 'providerCallback' | 'signingLog' | 'submitSigning',
  extraData: Record<string, unknown> = {},
) {
  try {
    const response = await electronicContractService[action]({ id: simulationContractId.value, ...extraData });
    const data = response?.data ?? response;
    if (data?.status) {
      simulationStatus.value = data.status;
    }
    if (action === 'signingLog') {
      simulationMessage.value = `签署日志读取成功，共 ${Array.isArray(data) ? data.length : 0} 条。`;
    } else if (action === 'downloadSignedFile') {
      simulationMessage.value = `已签文件下载地址：${data?.url || '模拟文件已就绪'}`;
    } else {
      simulationMessage.value = `模拟${action}成功，当前状态：${data?.status || '已更新'}。`;
    }
    if (action === 'copyForResign' && data?.id) {
      simulationContractId.value = data.id;
      simulationStatus.value = 'Draft';
      simulationMessage.value += ` 已自动切换到重签草稿：${data.id}。`;
    }
    simulationMessageType.value = 'success';
  } catch (error) {
    const technicalCallback = action === 'providerCallback' && extraData.status === 'Failed';
    simulationMessage.value = technicalCallback
      ? '供应商技术异常，合同保持签署中，可稍后重试或撤销。'
      : error instanceof Error && error.message
        ? error.message
        : '模拟流程执行失败';
    simulationMessageType.value = 'warning';
  }
}
</script>

<template>
  <div class="electronic-contract-page">
    <Card title="合同文档预览与模拟签章" size="small">
      <div class="electronic-contract-page__inputs">
        <Input
          v-model:value="previewUrl"
          placeholder="输入受控 Word 文件链接后即可预览"
        />
        <Input.TextArea
          v-model:value="previewPositionsText"
          :auto-size="{ minRows: 4, maxRows: 10 }"
          placeholder="输入签章位置 JSON 数组"
        />
      </div>
      <Alert
        v-if="previewError"
        :message="previewError"
        class="electronic-contract-page__alert"
        type="warning"
      />
      <ElectronicContractDocumentPreview
        :document-url="previewUrl"
        :positions="previewPositions"
      />
    </Card>

    <Card title="两方签约模拟流程" size="small">
      <div class="electronic-contract-page__inputs">
        <Input v-model:value="simulationContractId" placeholder="输入电子合同 ID" />
        <Button @click="loadSimulationContract">加载合同状态</Button>
        <Alert :message="`当前合同状态：${simulationStatus}`" type="info" show-icon />
        <div class="electronic-contract-page__actions">
          <Button type="primary" :disabled="!canSubmitSigning" @click="runSimulationAction('submitSigning')">提交签署</Button>
          <Button type="primary" :disabled="!canReceiveCallback" @click="runSimulationAction('providerCallback', { eventId: `complete-${simulationContractId}`, status: 'Signed' })">模拟签署完成回调</Button>
          <Button :disabled="!canReceiveCallback" @click="runSimulationAction('providerCallback', { eventId: `reject-${simulationContractId}`, status: 'Rejected' })">模拟拒签回调</Button>
          <Button :disabled="!canReceiveCallback" @click="runSimulationAction('providerCallback', { eventId: `expired-${simulationContractId}`, status: 'Expired' })">模拟签署过期</Button>
          <Button :disabled="!canReceiveCallback" @click="runSimulationAction('providerCallback', { eventId: `technical-${simulationContractId}`, status: 'Failed' })">模拟供应商技术异常</Button>
          <Button :disabled="!canReplayCompletedCallback" @click="runSimulationAction('providerCallback', { eventId: `complete-${simulationContractId}`, status: 'Signed' })">重复完成回调</Button>
          <Button @click="runSimulationAction('signingLog')">查看签署日志</Button>
          <Button :disabled="!canDownloadSignedFile" @click="runSimulationAction('downloadSignedFile')">下载已签文件</Button>
          <Button :disabled="!canCopyForResign" @click="runSimulationAction('copyForResign')">复制重签</Button>
          <Button danger :disabled="!canCancelSigning" @click="runSimulationAction('cancelSigning')">撤销签署</Button>
          <Button :disabled="!canArchive" @click="runSimulationAction('archive')">归档合同</Button>
        </div>
        <Alert :message="simulationMessage" :type="simulationMessageType" show-icon />
      </div>
    </Card>

    <CrudPage :config="electronicContractPageCrudConfig" />
  </div>
</template>

<style scoped>
.electronic-contract-page {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr);
}

.electronic-contract-page__inputs {
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
}

.electronic-contract-page__alert {
  margin-bottom: 12px;
}

.electronic-contract-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
</style>
