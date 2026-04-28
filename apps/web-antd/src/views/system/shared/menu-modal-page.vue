<script lang="ts" setup>
import { ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Button, Modal } from 'ant-design-vue';

const route = useRoute();
const open = ref(true);
</script>

<template>
  <Page
    description="该菜单配置为 ModalWindow，页面内容将在弹窗中展示。"
    :title="String(route.meta.title || '弹窗页面')"
  >
    <Button type="primary" @click="open = true">打开弹窗</Button>

    <Modal
      v-model:open="open"
      :footer="null"
      :title="String(route.meta.title || '弹窗页面')"
      width="960px"
    >
      <iframe
        :src="String(route.meta.backendIframeSrc || route.path)"
        class="h-[70vh] w-full border-0"
      ></iframe>
    </Modal>
  </Page>
</template>
