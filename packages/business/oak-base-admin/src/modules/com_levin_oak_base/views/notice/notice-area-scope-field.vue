<script lang="ts" setup>
import { computed, ref } from 'vue';

import AdministrativeAreaCascader from '@levin/admin-framework/framework-commons/shared/administrative-area-cascader.vue';
import { formatAdministrativeArea } from '@levin/admin-framework/framework-commons/shared/administrative-area-data';
import { Button, Tag } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    modelValue?: string[];
  }>(),
  {
    disabled: false,
    modelValue: () => [],
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const selectedAreaCode = ref('');

// 仅保留有效且不重复的编码，确保提交值与通知 SQL JSON 匹配条件一一对应。
const selectedAreaCodes = computed(() => [
  ...new Set((props.modelValue || []).map(String).filter(Boolean)),
]);

function addAreaCode(code: string) {
  if (!code) return;

  const nextCodes = [...selectedAreaCodes.value, code];
  emit('update:modelValue', [...new Set(nextCodes)]);
  selectedAreaCode.value = '';
}

function removeAreaCode(code: string) {
  emit(
    'update:modelValue',
    selectedAreaCodes.value.filter((item) => item !== code),
  );
}

function clearAreaCodes() {
  emit('update:modelValue', []);
}
</script>

<template>
  <div class="notice-area-scope-field">
    <!-- 每次选择一个行政区划后加入范围，允许省、市、区县混合配置并避免级联多选的路径歧义。 -->
    <AdministrativeAreaCascader
      v-model="selectedAreaCode"
      :disabled="disabled"
      placeholder="选择省、市或区县后加入投放范围"
      :selectable-levels="['province', 'city', 'district']"
      @change="addAreaCode"
    />

    <div
      v-if="selectedAreaCodes.length > 0"
      class="notice-area-scope-field__tags"
    >
      <Tag
        v-for="code in selectedAreaCodes"
        :key="code"
        :closable="!disabled"
        @close="removeAreaCode(code)"
      >
        {{ formatAdministrativeArea(code) }}
      </Tag>
      <Button
        :disabled="disabled"
        size="small"
        type="link"
        @click="clearAreaCodes"
      >
        清空
      </Button>
    </div>
    <div v-else class="notice-area-scope-field__hint">
      未选择时不限制用户区域；选择省或市会覆盖其下属区域。
    </div>
  </div>
</template>

<style scoped>
.notice-area-scope-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.notice-area-scope-field__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.notice-area-scope-field__hint {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.5;
}
</style>
