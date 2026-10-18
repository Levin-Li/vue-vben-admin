<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue';

import { Button, Select, Spin } from 'ant-design-vue';

import { legalSubjectService } from '../../api/legal-subject-service';
import { buildModuleOptionsLoader } from '../api-module';

type SubjectSummary = {
  certificationStatus?: string;
  id?: number | string;
  subjectName?: string;
  subjectType?: string;
};

const props = defineProps<{
  disabled?: boolean;
  modelValue?: number | string;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: number | string | undefined];
}>();

const loadSubjects = buildModuleOptionsLoader(
  '/LegalSubject/list',
  'subjectName',
  'id',
  { pageIndex: 1, pageSize: 50 },
  'containsSubjectName',
);
const options = ref<{ label: string; value: number | string }[]>([]);
const summary = ref<null | SubjectSummary>(null);
const loading = ref(false);
const optionsError = ref(false);
let requestVersion = 0;
let optionsRequestVersion = 0;

// 选择列表只查询当前操作者可访问的主体；摘要另由主体详情权限校验。
async function searchSubjects(keyword = '') {
  const version = ++optionsRequestVersion;
  optionsError.value = false;
  try {
    const subjects = await loadSubjects(keyword);
    if (version !== optionsRequestVersion) return;
    const nextOptions = subjects.flatMap((option) =>
      typeof option.value === 'string' || typeof option.value === 'number'
        ? [{ label: String(option.label), value: option.value }]
        : [],
    );

    // 当前已授权主体可能不在本次搜索页，保留其显示名称以免编辑时回退为原始 ID。
    const selectedId = props.modelValue;
    const selectedName = summary.value?.subjectName;
    if (
      selectedId !== undefined &&
      selectedName &&
      !nextOptions.some((option) => option.value === selectedId)
    ) {
      nextOptions.unshift({ label: selectedName, value: selectedId });
    }
    options.value = nextOptions;
  } catch {
    if (version === optionsRequestVersion) optionsError.value = true;
  }
}

watch(
  () => props.modelValue,
  async (id) => {
    const version = ++requestVersion;
    summary.value = null;
    if (id === undefined || id === null || id === '') return;
    loading.value = true;
    try {
      const result = (await legalSubjectService.retrieve({ id })) as
        | SubjectSummary
        | { data: SubjectSummary };
      if (version === requestVersion) {
        const subject = 'data' in result ? result.data : result;
        summary.value = {
          certificationStatus: subject.certificationStatus,
          id: subject.id,
          subjectName: subject.subjectName,
          subjectType: subject.subjectType,
        };
        if (
          summary.value?.subjectName &&
          !options.value.some((option) => option.value === id)
        ) {
          options.value = [
            { label: summary.value.subjectName, value: id },
            ...options.value,
          ];
        }
      }
    } catch {
      // 无主体详情权限时不展示摘要；保存仍由服务端校验关联权限。
    } finally {
      if (version === requestVersion) loading.value = false;
    }
  },
  { immediate: true },
);

onMounted(() => {
  void searchSubjects();
});
</script>

<template>
  <div>
    <Select
      :value="modelValue"
      :disabled="disabled"
      :options="options"
      :filter-option="false"
      :show-search="true"
      class="w-full"
      placeholder="搜索并选择已有法律主体"
      @search="searchSubjects"
      @update:value="
        (value) =>
          !disabled &&
          emit(
            'update:modelValue',
            typeof value === 'string' || typeof value === 'number'
              ? value
              : undefined,
          )
      "
    />
    <Spin v-if="loading" size="small" />
    <div v-if="optionsError" class="mt-2 text-sm text-red-500">
      法律主体选项加载失败。
      <Button size="small" type="link" @click="searchSubjects()">重试</Button>
    </div>
    <div v-else-if="summary" class="mt-2 text-sm text-gray-500">
      主体：{{ summary.subjectName || summary.id }}
      <span v-if="summary.subjectType"> · 类型：{{ summary.subjectType }}</span>
      <span v-if="summary.certificationStatus">
        · 认证：{{ summary.certificationStatus }}
      </span>
    </div>
  </div>
</template>
