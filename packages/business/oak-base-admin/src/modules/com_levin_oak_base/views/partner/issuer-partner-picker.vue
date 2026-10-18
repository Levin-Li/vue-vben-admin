<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue';

import { Button, Select } from 'ant-design-vue';

import { supplierPartnerService } from '../../api/supplier-partner-service';
import {
  loadIssuerRelationPage,
  loadIssuerSubjectPage,
} from './issuer-partner-options';

type Option = { label: string; value: number | string };
type PartnerSummary = {
  displayName?: string;
  id?: number | string;
  legalSubjectId?: number | string;
  legalSubjectName?: string;
  orgId?: number | string;
  type?: string;
};

const props = defineProps<{
  disabled?: boolean;
  modelValue?: number | string;
  tenantId?: number | string;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: number | string | undefined];
}>();

const selectedSubjectId = ref<number | string>();
const subjectOptions = ref<Option[]>([]);
const relationOptions = ref<Option[]>([]);
const subjectKeyword = ref('');
const subjectPage = ref(0);
const relationPage = ref(0);
const subjectHasMore = ref(false);
const relationHasMore = ref(false);
const subjectLoading = ref(false);
const relationLoading = ref(false);
const subjectError = ref(false);
const relationError = ref(false);
let subjectRequestVersion = 0;
let relationRequestVersion = 0;

// 搜索条件变化时从第一页开始，旧请求不能覆盖新结果。
async function searchSubjects(keyword = '') {
  subjectKeyword.value = keyword;
  subjectPage.value = 0;
  await loadSubjects(1);
}

async function loadSubjects(pageIndex: number) {
  const version = ++subjectRequestVersion;
  subjectLoading.value = true;
  subjectError.value = false;
  try {
    const page = await loadIssuerSubjectPage(
      subjectKeyword.value,
      pageIndex,
      props.tenantId,
    );
    if (version !== subjectRequestVersion) return;
    if (pageIndex === 1) {
      const selected = subjectOptions.value.find(
        (option) => option.value === selectedSubjectId.value,
      );
      subjectOptions.value =
        selected &&
        !page.options.some((option) => option.value === selected.value)
          ? [selected, ...page.options]
          : page.options;
    } else {
      subjectOptions.value = [...subjectOptions.value, ...page.options];
    }
    subjectPage.value = pageIndex;
    subjectHasMore.value = page.hasMore;
  } catch {
    if (version === subjectRequestVersion) subjectError.value = true;
  } finally {
    if (version === subjectRequestVersion) subjectLoading.value = false;
  }
}

// 切换主体立即清除旧关系，且只请求该主体下的供应商关系。
function selectSubject(value?: number | string) {
  selectedSubjectId.value = value;
  relationRequestVersion++;
  relationOptions.value = [];
  relationPage.value = 0;
  relationHasMore.value = false;
  emit('update:modelValue', undefined);
  if (value !== undefined) void loadRelations(1);
}

async function loadRelations(pageIndex: number) {
  const subjectId = selectedSubjectId.value;
  if (subjectId === undefined) return;
  const version = ++relationRequestVersion;
  relationLoading.value = true;
  relationError.value = false;
  try {
    const page = await loadIssuerRelationPage(
      subjectId,
      pageIndex,
      props.tenantId,
    );
    if (version !== relationRequestVersion) return;
    if (pageIndex === 1) {
      const selected = relationOptions.value.find(
        (option) => option.value === props.modelValue,
      );
      relationOptions.value =
        selected &&
        !page.options.some((option) => option.value === selected.value)
          ? [selected, ...page.options]
          : page.options;
    } else {
      relationOptions.value = [...relationOptions.value, ...page.options];
    }
    relationPage.value = pageIndex;
    relationHasMore.value = page.hasMore;
  } catch {
    if (version === relationRequestVersion) relationError.value = true;
  } finally {
    if (version === relationRequestVersion) relationLoading.value = false;
  }
}

// 编辑或查询回显时，仅用可访问的合作关系详情定位其主体。
watch(
  () => props.modelValue,
  async (id) => {
    if (id === undefined || id === null || id === '') return;
    if (relationOptions.value.some((option) => option.value === id)) return;
    try {
      const result = (await supplierPartnerService.retrieve({ id })) as
        | PartnerSummary
        | { data: PartnerSummary };
      const partner = 'data' in result ? result.data : result;
      if (props.modelValue !== id || !partner.legalSubjectId) return;
      selectedSubjectId.value = partner.legalSubjectId;
      subjectOptions.value = [
        {
          label:
            partner.legalSubjectName || `法律主体 ${partner.legalSubjectId}`,
          value: partner.legalSubjectId,
        },
        ...subjectOptions.value,
      ];
      relationOptions.value = [
        {
          label: `${partner.displayName || `合作关系 ${id}`} · 组织 ${partner.orgId || '当前组织'} · ${partner.type || '供应伙伴'}`,
          value: id,
        },
      ];
      void loadRelations(1);
    } catch {
      relationOptions.value = [{ label: `合作关系 ${id}`, value: id }];
    }
  },
  { immediate: true },
);

watch(
  () => props.tenantId,
  (next, previous) => {
    if (next === previous) return;
    selectSubject();
    void searchSubjects(subjectKeyword.value);
  },
);

onMounted(() => {
  void searchSubjects();
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <Select
      :value="selectedSubjectId"
      :disabled="disabled"
      :filter-option="false"
      :loading="subjectLoading"
      :options="subjectOptions"
      :show-search="true"
      class="w-full"
      placeholder="先搜索法律主体名称"
      @search="searchSubjects"
      @update:value="
        (value) =>
          selectSubject(
            typeof value === 'string' || typeof value === 'number'
              ? value
              : undefined,
          )
      "
    />
    <Button
      v-if="subjectHasMore"
      :disabled="subjectLoading || disabled"
      size="small"
      type="link"
      @click="loadSubjects(subjectPage + 1)"
    >
      加载更多法律主体
    </Button>
    <Button
      v-if="subjectError"
      size="small"
      type="link"
      @click="loadSubjects(subjectPage || 1)"
    >
      法律主体加载失败，重试
    </Button>

    <Select
      :value="modelValue"
      :disabled="disabled || selectedSubjectId === undefined"
      :loading="relationLoading"
      :options="relationOptions"
      class="w-full"
      placeholder="再选择该主体的供应伙伴关系"
      @update:value="
        (value) =>
          emit(
            'update:modelValue',
            typeof value === 'string' || typeof value === 'number'
              ? value
              : undefined,
          )
      "
    />
    <Button
      v-if="relationHasMore"
      :disabled="relationLoading || disabled"
      size="small"
      type="link"
      @click="loadRelations(relationPage + 1)"
    >
      加载更多合作关系
    </Button>
    <Button
      v-if="relationError"
      size="small"
      type="link"
      @click="loadRelations(relationPage || 1)"
    >
      合作关系加载失败，重试
    </Button>
  </div>
</template>
