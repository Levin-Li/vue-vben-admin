<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { Alert, Descriptions, Modal, Spin } from 'ant-design-vue';

import JsonEditorField from '@levin/admin-framework/framework-commons/shared/json-editor-field.vue';
import JsonSchemaEditorField from '@levin/admin-framework/framework-commons/shared/json-schema-editor-field.vue';

import { auditReportService } from '../../api/audit-report-service';
import { buildEnumOptionsLoader } from '../api-module';

const props = defineProps<{
  open: boolean;
  record: null | Record<string, any>;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

type SelectOption = { label: string; value: unknown };

// 当前报告始终来自详情接口，避免把列表中的截断正文当成完整报告。
const detailReport = ref<null | Record<string, any>>(null);
const loading = ref(false);
const loadError = ref('');
let loadSequence = 0;

// 机密等级沿用实体枚举的显示标签，避免直接把枚举数值暴露给用户。
const confidentialLevelOptions = ref<SelectOption[]>([]);
const loadConfidentialLevelOptions = buildEnumOptionsLoader(
  'com.levin.commons.rbac.ConfidentialLevel',
);

const reportContent = computed<Record<string, any>>(() => {
  const content = detailReport.value?.content;

  if (content && typeof content === 'object' && !Array.isArray(content)) {
    return content;
  }

  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }

  return {};
});

const auditConclusion = computed(() => {
  const summary = reportContent.value.summary;
  return summary === undefined || summary === null || summary === ''
    ? '-'
    : String(summary);
});

const confidentialLevel = computed(() => {
  const value = detailReport.value?.confidentialLevel;

  if (value === undefined || value === null || value === '') {
    return '-';
  }

  return (
    confidentialLevelOptions.value.find(
      (option) => String(option.value) === String(value),
    )?.label || String(value)
  );
});

const reportTitle = computed(() => detailReport.value?.title || '审计报告');
const editorSource = computed(() => String(detailReport.value?.editor || '').trim());

async function loadReport() {
  if (!props.open || !props.record?.id) return;

  const sequence = ++loadSequence;
  loading.value = true;
  loadError.value = '';
  detailReport.value = null;

  try {
    // 读取详情时沿用通用详情的 orgId 上下文，确保数据范围由服务端继续校验。
    const report = (await auditReportService.retrieve({
      id: props.record.id,
      orgId: props.record.orgId,
    })) as Record<string, any>;
    if (sequence !== loadSequence) return;

    detailReport.value = report;

    // 枚举标签加载失败不影响报告正文读取，仍以原值提供可追溯的只读展示。
    try {
      confidentialLevelOptions.value = await loadConfidentialLevelOptions();
    } catch (error) {
      console.error(error);
    }
  } catch (error) {
    if (sequence !== loadSequence) return;
    console.error(error);
    loadError.value = '审计报告加载失败，请稍后重试';
  } finally {
    if (sequence === loadSequence) loading.value = false;
  }
}

watch(
  () => [props.open, props.record?.id, props.record?.orgId],
  () => {
    void loadReport();
  },
  { immediate: true },
);
</script>

<template>
  <Modal
    :footer="null"
    :mask-closable="false"
    :open="open"
    :title="reportTitle"
    width="min(90vw, 1280px)"
    @cancel="emit('update:open', false)"
  >
    <Spin :spinning="loading">
      <Alert v-if="loadError" :message="loadError" show-icon type="error" />

      <template v-else-if="detailReport">
        <!-- 结论与机密等级属于报告外层摘要，不依赖正文 Schema 才可阅读。 -->
        <Descriptions bordered class="mb-5" size="small" :column="2">
          <Descriptions.Item label="审计结论" :span="2">
            {{ auditConclusion }}
          </Descriptions.Item>
          <Descriptions.Item label="机密等级">
            {{ confidentialLevel }}
          </Descriptions.Item>
          <Descriptions.Item label="审计时间范围">
            {{ detailReport.startTime || '-' }} 至 {{ detailReport.endTime || '-' }}
          </Descriptions.Item>
        </Descriptions>

        <!-- 报告正文严格按服务端记录的编辑器声明以只读 Schema 表单呈现。 -->
        <JsonSchemaEditorField
          v-if="editorSource"
          disabled
          inline
          :model-value="detailReport.content"
          :schema-source="editorSource"
          :title="reportTitle"
        />
        <JsonEditorField
          v-else
          disabled
          inline
          :model-value="detailReport.content"
          :title="reportTitle"
        />
      </template>
    </Spin>
  </Modal>
</template>
