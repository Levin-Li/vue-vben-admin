<script lang="ts" setup>
import { ref, watch } from 'vue';

import { Button, Modal } from 'ant-design-vue';

import OpenAreaCodeTreeSelector from './open-area-code-tree-selector.vue';

const props = withDefaults(
  defineProps<{
    areaCodeList?: string[];
    open?: boolean;
    saving?: boolean;
  }>(),
  {
    areaCodeList: () => [],
    open: false,
    saving: false,
  },
);

const emit = defineEmits<{
  save: [areaCodeList: string[]];
  'update:open': [open: boolean];
}>();

const draftAreaCodeList = ref<string[]>([]);
const originalAreaCodeList = ref<string[]>([]);

watch(
  () => [props.open, props.areaCodeList] as const,
  ([open, areaCodeList]) => {
    if (open) {
      draftAreaCodeList.value = Array.isArray(areaCodeList)
        ? [...areaCodeList]
        : [];
      originalAreaCodeList.value = [...draftAreaCodeList.value];
    }
  },
  { immediate: true },
);
</script>

<template>
  <Modal
    :confirm-loading="saving"
    :open="open"
    title="开通区域"
    width="min(80vw, 960px)"
    @cancel="emit('update:open', false)"
    @ok="emit('save', draftAreaCodeList)"
  >
    <OpenAreaCodeTreeSelector
      v-model="draftAreaCodeList"
      :original-value="originalAreaCodeList"
    />
    <template #footer>
      <Button @click="emit('update:open', false)">取消</Button>
      <Button
        :loading="saving"
        type="primary"
        @click="emit('save', draftAreaCodeList)"
      >
        保存
      </Button>
    </template>
  </Modal>
</template>
