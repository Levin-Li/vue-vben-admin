<script lang="ts" setup>
import { Empty } from 'ant-design-vue';

defineOptions({ name: 'Index' });
</script>

<template>
  <div
    class="min-h-[calc(100vh-120px)] bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8"
  >
    <div class="mx-auto flex min-h-[420px] max-w-5xl flex-col">
      <header class="pb-6">
        <h1 class="text-2xl font-semibold leading-8">首页</h1>
        <p class="mt-2 text-sm text-muted-foreground">暂无首页内容</p>
      </header>

      <section
        class="flex flex-1 items-center justify-center rounded-lg border border-border bg-card px-6 py-12"
      >
        <Empty description="暂无首页内容" />
      </section>
    </div>
  </div>
</template>
