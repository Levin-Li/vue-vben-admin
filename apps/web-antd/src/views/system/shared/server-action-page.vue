<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Button, message, Spin } from 'ant-design-vue';

import { requestClient } from '#/api/request';

const route = useRoute();
const loading = ref(false);
const resultText = ref('');
const errorMessage = ref('');

async function runAction() {
  loading.value = true;
  errorMessage.value = '';
  resultText.value = '';

  try {
    const result = await requestClient.post(route.path, {});
    resultText.value =
      typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    message.success('服务端动作执行成功');
  } catch (error: any) {
    errorMessage.value = error?.message || '服务端动作执行失败';
  } finally {
    loading.value = false;
  }
}

onMounted(runAction);
</script>

<template>
  <Page
    description="该菜单配置为 ServerSideAction，会直接调用对应后端动作。"
    :title="String(route.meta.title || '服务端动作')"
  >
    <Spin :spinning="loading">
      <Alert
        v-if="errorMessage"
        :message="errorMessage"
        class="mb-4"
        show-icon
        type="error"
      />
      <Button type="primary" @click="runAction">重新执行</Button>
      <pre class="mt-4 rounded-2xl bg-white p-4 text-sm">{{ resultText }}</pre>
    </Spin>
  </Page>
</template>
