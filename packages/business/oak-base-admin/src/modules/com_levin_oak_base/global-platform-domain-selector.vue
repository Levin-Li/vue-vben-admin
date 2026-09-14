<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import {
  currentGlobalDomainIds,
  setCurrentGlobalDomainIds,
} from '@levin/admin-framework/framework-commons/app/global-domain-context-state';
import { Select } from 'ant-design-vue';

import { oakBaseGet } from './api/_module';
import { loadDomainScopeOptions } from './domain-scope-options';

const SETTING_CODE = '全局平台领域选择器';
const loading = ref(false);
const options = ref<Array<{ label: string; value: string }>>([]);
const visible = ref(false);

/** 全局平台领域临时固定为单选，清空时保持空上下文。 */
const selectedDomainId = computed({
  get: () => currentGlobalDomainIds.value[0],
  set: (value) => setCurrentGlobalDomainIds(value),
});

async function loadSelector() {
  loading.value = true;
  visible.value = false;
  options.value = [];

  try {
    const setting: any = await oakBaseGet('/UiSetting/use/resolve', {
      params: { code: SETTING_CODE },
    });
    const typePrefix = String(setting?.valueContent?.type || '').trim();
    if (!typePrefix) return;

    // 选择器只消费字符串 ID，避免公共候选类型的其它值类型进入领域请求头。
    options.value = (await loadDomainScopeOptions()).map((option) => ({
      label: String(option.label),
      value: String(option.value),
    }));
    const available = new Set(
      options.value.map((option) => String(option.value)),
    );
    const currentDomainId = currentGlobalDomainIds.value[0];
    if (!currentDomainId || !available.has(currentDomainId)) {
      setCurrentGlobalDomainIds([]);
    } else {
      // 历史多选上下文进入当前页面后仅保留首个有效领域。
      setCurrentGlobalDomainIds(currentDomainId);
    }
    visible.value = options.value.length > 1;
  } finally {
    loading.value = false;
  }
}

onMounted(() => void loadSelector());
</script>

<template>
  <Select
    v-if="visible"
    v-model:value="selectedDomainId"
    allow-clear
    class="min-w-[220px]"
    :loading="loading"
    :options="options"
    placeholder="请选择平台领域"
  />
</template>
