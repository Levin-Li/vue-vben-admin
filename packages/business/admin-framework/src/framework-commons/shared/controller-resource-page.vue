<script lang="ts" setup>
import { Page } from '@vben/common-ui';

const props = defineProps<{
  resource: string;
  title: string;
}>();
</script>

<template>
  <Page :title="props.title">
    <div class="rounded-2xl bg-white p-6">
      <div class="text-base font-medium">{{ props.title }}</div>
      <div class="mt-2 text-sm text-muted-foreground">
        页面资源：{{ props.resource }}。该页面将按控制器源码规则继续独立开发。
      </div>
    </div>
  </Page>
</template>
