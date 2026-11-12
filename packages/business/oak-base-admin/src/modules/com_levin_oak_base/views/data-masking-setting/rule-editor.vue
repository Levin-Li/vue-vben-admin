<script lang="ts" setup>
import type {
  MaskingEntityCatalogItem,
  MaskingOperationCatalogItem,
} from '../../api/data-masking-setting-service';
import type { MaskingFieldRule } from './rules';

import { computed, onMounted, ref, watch } from 'vue';

import { notifyApiErrorOnce } from '@levin/admin-framework/framework-commons/app/api';
import {
  Button,
  Checkbox,
  Empty,
  InputNumber,
  Select,
  Spin,
} from 'ant-design-vue';

import { dataMaskingSettingService } from '../../api/data-masking-setting-service';

const props = defineProps<{
  disabled?: boolean;
  formState: Record<string, any>;
}>();

const catalog = ref<MaskingOperationCatalogItem[]>([]);
const entityCatalog = ref<MaskingEntityCatalogItem[]>([]);
const loading = ref(false);
const entityToAdd = ref<string>();
const selectedEntities = ref<string[]>([]);

const rules = computed<MaskingFieldRule[]>(() => {
  const content = props.formState.valueContent;
  return Array.isArray(content) ? content : [];
});
const availableEntities = computed(() =>
  [...new Set(entityCatalog.value.map((item) => item.entityClass))]
    .filter((entityClass) => !selectedEntities.value.includes(entityClass))
    .map((entityClass) => ({
      label: entityClass.split('.').at(-1) || entityClass,
      value: entityClass,
    })),
);
const operationOptions = computed(() =>
  catalog.value.map((item) => ({
    label: `${item.methods.join(',') || 'ANY'} ${item.paths[0] || item.operation}`,
    value: item.operation,
  })),
);

// 切换新增或编辑记录时，恢复这条记录已经选定的实体。
watch(
  () => props.formState.valueContent,
  () => {
    selectedEntities.value = [
      ...new Set(rules.value.map((rule) => rule.entityClass).filter(Boolean)),
    ];
    entityToAdd.value = undefined;
  },
  { immediate: true },
);

function writableRules(): MaskingFieldRule[] {
  // CrudPage 将可编辑表单状态传入插槽；在本地引用中更新该状态。
  const formState = props.formState;
  if (!Array.isArray(formState.valueContent)) {
    formState.valueContent = [];
  }
  return formState.valueContent;
}

function ruleFor(
  entityClass: string,
  fieldName: string,
): MaskingFieldRule | undefined {
  return rules.value.find(
    (rule) => rule.entityClass === entityClass && rule.fieldName === fieldName,
  );
}

function fieldsFor(entityClass: string) {
  return entityCatalog.value.filter((item) => item.entityClass === entityClass);
}

function addEntity() {
  if (!entityToAdd.value || selectedEntities.value.includes(entityToAdd.value))
    return;
  selectedEntities.value.push(entityToAdd.value);
  entityToAdd.value = undefined;
}

function removeEntity(entityClass: string) {
  const formState = props.formState;
  formState.valueContent = writableRules().filter(
    (rule) => rule.entityClass !== entityClass,
  );
  selectedEntities.value = selectedEntities.value.filter(
    (item) => item !== entityClass,
  );
}

function toggleField(entityClass: string, fieldName: string, checked: boolean) {
  const items = writableRules();
  const index = items.findIndex(
    (rule) => rule.entityClass === entityClass && rule.fieldName === fieldName,
  );
  if (checked && index === -1) {
    items.push({
      entityClass,
      fieldName,
      treatment: 'HIDE',
    });
  } else if (!checked && index !== -1) {
    items.splice(index, 1);
  }
}

function inputFieldOptions(rule: MaskingFieldRule) {
  return (
    catalog.value.find((item) => item.operation === rule.inputOperation)
      ?.requestFields || []
  ).map((path) => ({ label: path, value: path }));
}

function setInputOperation(rule: MaskingFieldRule, operation: string) {
  rule.inputOperation = operation;
  rule.inputFieldPath = undefined;
}

onMounted(async () => {
  loading.value = true;
  try {
    [entityCatalog.value, catalog.value] = await Promise.all([
      dataMaskingSettingService.entityCatalog(),
      dataMaskingSettingService.catalog(),
    ]);
  } catch (error) {
    notifyApiErrorOnce(error);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <Spin :spinning="loading">
    <div class="rule-editor">
      <!-- 一个配置可以包含多个实体，字段来自服务端验证过的实体目录。 -->
      <div class="entity-add-row">
        <Select
          v-model:value="entityToAdd"
          :disabled="disabled"
          :options="availableEntities"
          class="rule-full"
          option-filter-prop="label"
          placeholder="选择要脱敏的实体"
          show-search
        />
        <Button :disabled="disabled || !entityToAdd" @click="addEntity">
          添加实体
        </Button>
      </div>
      <Empty
        v-if="selectedEntities.length === 0"
        description="请添加实体并选择字段"
      />

      <!-- 每个实体展示已映射的字符串字段及其实际接口覆盖。 -->
      <section
        v-for="entityClass in selectedEntities"
        :key="entityClass"
        class="entity-card"
      >
        <div class="entity-heading">
          <strong>{{ entityClass.split('.').at(-1) || entityClass }}</strong>
          <Button
            :disabled="disabled"
            danger
            type="link"
            @click="removeEntity(entityClass)"
          >
            移除实体
          </Button>
        </div>
        <div class="entity-class">{{ entityClass }}</div>
        <Empty
          v-if="fieldsFor(entityClass).length === 0"
          description="该实体没有可配置字段"
        />

        <div
          v-for="field in fieldsFor(entityClass)"
          :key="field.fieldName"
          class="rule-card"
        >
          <Checkbox
            :checked="!!ruleFor(entityClass, field.fieldName)"
            :disabled="disabled || field.coverage.length === 0"
            @change="
              toggleField(entityClass, field.fieldName, $event.target.checked)
            "
          >
            {{ field.fieldName }}
          </Checkbox>
          <span class="coverage-summary">
            {{
              field.coverage.length > 0
                ? `覆盖 ${field.coverage.length} 个接口字段`
                : '没有明确映射，暂不可配置'
            }}
            {{
              field.ambiguousOperations?.length
                ? `；另有 ${field.ambiguousOperations.length} 个接口映射有歧义`
                : ''
            }}
          </span>

          <template
            v-for="rule in rules.filter(
              (item) =>
                item.entityClass === entityClass &&
                item.fieldName === field.fieldName,
            )"
            :key="rule.fieldName"
          >
            <Select
              v-model:value="rule.treatment"
              :disabled="disabled"
              :options="[
                { label: '隐藏', value: 'HIDE' },
                { label: '普通遮盖', value: 'MASK' },
                { label: '可还原 ID', value: 'REVERSIBLE_ID' },
              ]"
            />
            <details class="coverage-details">
              <summary>查看实际覆盖接口</summary>
              <div
                v-for="item in field.coverage"
                :key="item.operation + item.outputFieldPath"
              >
                {{ item.methods.join(',') || 'ANY' }}
                {{ item.paths[0] || item.operation }} ·
                {{ item.outputFieldPath }}
              </div>
            </details>

            <!-- 可还原 ID 才显示回传用途和有效期，不扩大接口输入权限。 -->
            <div
              v-if="rule.treatment === 'REVERSIBLE_ID'"
              class="reversible-fields"
            >
              <Select
                :value="rule.inputOperation"
                :disabled="disabled"
                :options="operationOptions"
                placeholder="接收 ID 的接口"
                show-search
                option-filter-prop="label"
                @change="setInputOperation(rule, String($event))"
              />
              <Select
                v-model:value="rule.inputFieldPath"
                :disabled="disabled || !rule.inputOperation"
                :options="inputFieldOptions(rule)"
                placeholder="接收 ID 的请求字段"
                show-search
                option-filter-prop="label"
              />
              <Select
                v-model:value="rule.binding"
                :disabled="disabled"
                :options="[
                  { label: '当前用户', value: 'USER' },
                  { label: '当前登录会话', value: 'SESSION' },
                ]"
                placeholder="绑定范围"
              />
              <InputNumber
                v-model:value="rule.validSeconds"
                addon-after="秒"
                :disabled="disabled"
                :min="1"
                :max="86400"
                class="rule-full"
                placeholder="有效秒数"
              />
            </div>
          </template>
        </div>
      </section>
    </div>
  </Spin>
</template>

<style scoped>
.rule-editor {
  display: grid;
  gap: 12px;
  width: 100%;
}
.rule-full {
  width: 100%;
}
.entity-add-row,
.entity-heading {
  display: flex;
  gap: 8px;
  align-items: center;
}
.entity-heading {
  justify-content: space-between;
}
.entity-card {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--ant-color-border, #d9d9d9);
  border-radius: 8px;
}
.entity-class,
.coverage-summary {
  color: var(--ant-color-text-secondary, #666);
  font-size: 12px;
}
.rule-card {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--ant-color-border, #d9d9d9);
  border-radius: 8px;
}
.coverage-details {
  grid-column: 1 / -1;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.reversible-fields {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}
</style>
