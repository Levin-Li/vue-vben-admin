<script lang="ts" setup>
import type { ContractSealPosition } from '../../components/electronic-contract/contract-document-preview-utils';

import { computed, ref } from 'vue';

import { Alert, Card, Input } from 'ant-design-vue';

import { ElectronicContractDocumentPreview } from '../../components/electronic-contract';
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

    <CrudPage :config="electronicContractPageCrudConfig" />
  </div>
</template>

<style scoped>
.electronic-contract-page {
  display: grid;
  gap: 12px;
}

.electronic-contract-page__inputs {
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
}

.electronic-contract-page__alert {
  margin-bottom: 12px;
}
</style>
