<script lang="ts" setup>
import { useRoute } from 'vue-router';

import { Fallback } from '@vben/common-ui';

defineOptions({ name: 'Fallback404Demo' });

const fixedQueryError = String(useRoute().meta.fixedQueryError || '');
</script>

<template>
  <Fallback
    status="404"
    :title="fixedQueryError ? '菜单固定查询条件配置错误' : ''"
    :description="fixedQueryError"
  />
</template>
