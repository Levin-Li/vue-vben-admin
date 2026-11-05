<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue';

import { Button, Select, Spin } from 'ant-design-vue';

import { legalSubjectService } from '../../api/legal-subject-service';
import { moduleFetchCrudList } from '../api-module';
import { loadReferenceCandidates } from '../reference-candidate-options';

type SubjectSummary = {
  certificationStatus?: string;
  id?: number | string;
  subjectName?: string;
  subjectType?: string;
  tenantId?: string;
};

const props = defineProps<{
  disabled?: boolean;
  modelValue?: number | string;
  requireTenant?: boolean;
  tenantId?: string;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: number | string | undefined];
}>();

const options = ref<{ label: string; value: number | string }[]>([]);
const summary = ref<null | SubjectSummary>(null);
const loading = ref(false);
const optionsError = ref(false);
const optionsLoading = ref(false);
const keyword = ref('');
const pageIndex = ref(0);
const hasMore = ref(false);
let requestVersion = 0;
let optionsRequestVersion = 0;

// 选择列表逐页读取当前操作者可访问的主体；摘要另由主体详情权限校验。
async function loadPage(nextPage: number) {
  const version = ++optionsRequestVersion;
  optionsError.value = false;
  if (props.requireTenant && !props.tenantId) {
    options.value = [];
    hasMore.value = false;
    optionsLoading.value = false;
    return;
  }
  optionsLoading.value = true;
  try {
    const page =
      props.requireTenant && props.tenantId
        ? await loadReferenceCandidates(
            'legalSubjects',
            props.tenantId,
            keyword.value,
            nextPage,
          )
        : await moduleFetchCrudList<SubjectSummary>('/LegalSubject/list', {
            pageIndex: nextPage,
            pageSize: 50,
            containsSubjectName: keyword.value.trim() || undefined,
            ...(props.tenantId ? { tenantId: props.tenantId } : {}),
          });
    if (version !== optionsRequestVersion) return;
    const subjects = page.items || [];
    const nextOptions = subjects.flatMap((item) => {
      const subject = item as SubjectSummary & { name?: string };
      if (
        props.tenantId &&
        subject.tenantId &&
        subject.tenantId !== props.tenantId
      )
        return [];
      if (typeof subject.id !== 'string' && typeof subject.id !== 'number')
        return [];
      return [
        {
          label: String(subject.subjectName || subject.name || subject.id),
          value: subject.id,
        },
      ];
    });
    // 合并分页与已选摘要，避免搜索和加载更多时丢失回显。
    const existing = nextPage === 1 ? [] : options.value;
    const combined = [...existing];
    for (const option of nextOptions) {
      if (!combined.some((item) => String(item.value) === String(option.value)))
        combined.push(option);
    }
    if (
      props.modelValue !== undefined &&
      summary.value?.subjectName &&
      !combined.some((item) => String(item.value) === String(props.modelValue))
    ) {
      combined.unshift({
        label: summary.value.subjectName,
        value: props.modelValue,
      });
    }
    options.value = combined;
    pageIndex.value = nextPage;
    hasMore.value =
      typeof page.totals === 'number' && page.totals >= 0
        ? nextPage * 50 < page.totals
        : subjects.length === 50;
  } catch {
    if (version === optionsRequestVersion) optionsError.value = true;
  } finally {
    if (version === optionsRequestVersion) optionsLoading.value = false;
  }
}

function searchSubjects(value = '') {
  keyword.value = value;
  pageIndex.value = 0;
  hasMore.value = false;
  void loadPage(1);
}

// 租户变更使旧候选和异步详情失效，避免沿用跨租户主体。
watch(
  () => props.tenantId,
  (_next, previous) => {
    optionsRequestVersion++;
    requestVersion++;
    options.value = [];
    summary.value = null;
    keyword.value = '';
    pageIndex.value = 0;
    hasMore.value = false;
    if (previous && !props.disabled) emit('update:modelValue', undefined);
    void searchSubjects();
  },
);

watch(
  () => [props.modelValue, props.tenantId] as const,
  async ([id]) => {
    const version = ++requestVersion;
    summary.value = null;
    if (
      id === undefined ||
      id === null ||
      id === '' ||
      (props.requireTenant && !props.tenantId)
    ) {
      loading.value = false;
      return;
    }
    loading.value = true;
    try {
      if (props.requireTenant && props.tenantId) {
        const page = await loadReferenceCandidates(
          'legalSubjects',
          props.tenantId,
          '',
          1,
          String(id),
        );
        if (version !== requestVersion) return;
        const candidate = page.items.find(
          (item) => String(item.id) === String(id),
        );
        if (candidate) {
          summary.value = { id: candidate.id, subjectName: candidate.name };
          if (
            !options.value.some((option) => String(option.value) === String(id))
          )
            options.value = [
              { label: candidate.name, value: candidate.id },
              ...options.value,
            ];
        }
        return;
      }
      const result = (await legalSubjectService.retrieve({
        id,
        ...(props.tenantId ? { tenantId: props.tenantId } : {}),
      })) as SubjectSummary | { data: SubjectSummary };
      if (version === requestVersion) {
        const subject = 'data' in result ? result.data : result;
        if (
          props.tenantId &&
          subject.tenantId &&
          subject.tenantId !== props.tenantId
        )
          return;
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
      :disabled="disabled || (requireTenant && !tenantId)"
      :allow-clear="true"
      :options="options"
      :loading="optionsLoading"
      :filter-option="false"
      :show-search="true"
      class="w-full"
      placeholder="可留空，或搜索并选择已有法律主体"
      @search="searchSubjects"
      @update:value="
        (value) =>
          !disabled &&
          !(requireTenant && !tenantId) &&
          emit(
            'update:modelValue',
            typeof value === 'string' || typeof value === 'number'
              ? value
              : undefined,
          )
      "
    />
    <Button
      v-if="hasMore"
      :disabled="disabled || optionsLoading"
      size="small"
      type="link"
      @click="loadPage(pageIndex + 1)"
    >
      加载更多法律主体
    </Button>
    <Spin v-if="loading" size="small" />
    <div v-if="optionsError" class="mt-2 text-sm text-red-500">
      法律主体选项加载失败。
      <Button size="small" type="link" @click="loadPage(pageIndex || 1)">
        重试
      </Button>
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
