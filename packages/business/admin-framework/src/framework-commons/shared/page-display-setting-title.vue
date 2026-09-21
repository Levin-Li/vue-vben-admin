<script setup lang="ts">
import type { UiSettingRuntimeRecord } from '../app/api/ui-setting-runtime';

defineProps<{
  title: string;
  record?: null | UiSettingRuntimeRecord;
}>();
</script>

<template>
  <!-- 标题只展示实际加载或保存记录；长值保持单行且可悬停查看。 -->
  <div class="flex min-w-0 items-center gap-4">
    <span class="shrink-0">{{ title }}</span>
    <div
      v-if="record"
      data-testid="page-display-setting-record"
      class="text-muted-foreground flex min-w-0 gap-4 text-sm font-normal"
    >
      <span class="truncate" :title="record.id"
        >设置 ID：{{ record.id || '—' }}</span
      >
      <span class="truncate" :title="record.name"
        >名称：{{ record.name || '—' }}</span
      >
      <span class="truncate" :title="record.lastUpdateTime"
        >时间：{{ record.lastUpdateTime || '—' }}</span
      >
    </div>
  </div>
</template>
