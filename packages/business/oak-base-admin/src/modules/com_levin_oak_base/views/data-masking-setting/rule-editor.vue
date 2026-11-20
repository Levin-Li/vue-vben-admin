<script lang="ts" setup>
import type { MaskingEntityCatalogItem } from '../../api/data-masking-setting-service';
import type { MaskingFieldRule } from './rules';

import { computed, onMounted, ref, watch } from 'vue';

import { notifyApiErrorOnce } from '@levin/admin-framework/framework-commons/app/api';
import { filterCrudLocalSelectOption } from '@levin/admin-framework/framework-commons/shared/crud-local-search';
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  InputNumber,
  Select,
  Spin,
} from 'ant-design-vue';

import { dataMaskingSettingService } from '../../api/data-masking-setting-service';
import { isLegacyMaskingRule } from './rules';

const props = defineProps<{
  disabled?: boolean;
  formState: Record<string, any>;
}>();

const entityCatalog = ref<MaskingEntityCatalogItem[]>([]);
const loading = ref(false);
const entityToAdd = ref<string>();
const selectedEntities = ref<string[]>([]);

const rules = computed<MaskingFieldRule[]>(() => {
  const content = props.formState.valueContent;
  return Array.isArray(content) ? content : [];
});
const hasLegacyRules = computed(() =>
  rules.value.some((rule) => isLegacyMaskingRule(rule)),
);
function displayName(title: string | undefined, fallback: string) {
  const name = title?.trim();
  return name && name !== fallback ? `${name}（${fallback}）` : fallback;
}
function entityDisplayName(entityClass: string) {
  const name = entityClass.split('.').at(-1) || entityClass;
  const title = entityCatalog.value.find(
    (item) => item.entityClass === entityClass && item.entityTitle?.trim(),
  )?.entityTitle;
  return displayName(title, name);
}
const availableEntities = computed(() =>
  [...new Set(entityCatalog.value.map((item) => item.entityClass))]
    .filter((entityClass) => !selectedEntities.value.includes(entityClass))
    .map((entityClass) => ({
      label: entityDisplayName(entityClass),
      value: entityClass,
    })),
);

// 切换新增或编辑记录时，恢复这条记录已经选定的实体。
watch(
  () => props.formState.valueContent,
  () => {
    selectedEntities.value = [
      ...new Set(rules.value.map((rule) => rule?.entityClass).filter(Boolean)),
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
    (rule) => rule?.entityClass === entityClass && rule.fieldName === fieldName,
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
    (rule) => rule?.entityClass !== entityClass,
  );
  selectedEntities.value = selectedEntities.value.filter(
    (item) => item !== entityClass,
  );
}

function toggleField(entityClass: string, fieldName: string, checked: boolean) {
  const items = writableRules();
  const index = items.findIndex(
    (rule) => rule?.entityClass === entityClass && rule.fieldName === fieldName,
  );
  if (checked && index === -1) {
    items.push({
      entityClass,
      fieldName,
      schemaVersion: 2,
      treatment: 'HIDE',
    });
  } else if (!checked && index !== -1) {
    items.splice(index, 1);
  }
}

function setTreatment(
  rule: MaskingFieldRule,
  treatment: unknown,
  field: MaskingEntityCatalogItem,
) {
  if (
    treatment !== 'HIDE' &&
    treatment !== 'MASK' &&
    treatment !== 'REVERSIBLE_ID'
  )
    return;
  if (treatment === 'REVERSIBLE_ID' && !field.hasInputMapping) return;
  rule.treatment = treatment;
  if (treatment !== 'REVERSIBLE_ID') {
    delete rule.binding;
    delete rule.validSeconds;
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    entityCatalog.value = await dataMaskingSettingService.entityCatalog();
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
      <Alert
        v-if="hasLegacyRules"
        type="warning"
        message="检测到旧版脱敏规则，请移除旧实体后重新添加并配置字段；无法移除时请删除该设置并新建。旧规则不会自动转换。"
        show-icon
      />
      <!-- 一个配置可以包含多个实体，字段来自服务端验证过的实体目录。 -->
      <div class="entity-add-row">
        <Select
          v-model:value="entityToAdd"
          :disabled="disabled"
          :options="availableEntities"
          class="rule-full"
          :filter-option="filterCrudLocalSelectOption"
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

      <!-- 目录只包含有响应映射的实体字段。 -->
      <section
        v-for="entityClass in selectedEntities"
        :key="entityClass"
        class="entity-card"
      >
        <div class="entity-heading">
          <strong>{{ entityDisplayName(entityClass) }}</strong>
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
            :disabled="disabled"
            @change="
              toggleField(entityClass, field.fieldName, $event.target.checked)
            "
          >
            {{ displayName(field.fieldTitle, field.fieldName) }}
          </Checkbox>
          <template
            v-for="rule in rules.filter(
              (item) =>
                item?.entityClass === entityClass &&
                item.fieldName === field.fieldName,
            )"
            :key="rule.fieldName"
          >
            <Select
              :value="rule.treatment"
              :disabled="disabled"
              :options="[
                { label: '隐藏', value: 'HIDE' },
                { label: '普通遮盖', value: 'MASK' },
                {
                  label: field.hasInputMapping
                    ? '可还原 ID'
                    : '可还原 ID（缺少请求字段映射）',
                  value: 'REVERSIBLE_ID',
                  disabled: !field.hasInputMapping,
                },
              ]"
              @change="setTreatment(rule, $event, field)"
            />
            <Alert
              v-if="
                rule.treatment === 'REVERSIBLE_ID' && !field.hasInputMapping
              "
              class="rule-full"
              type="warning"
              message="当前字段缺少请求映射，请改用隐藏或普通遮盖后再保存。"
              show-icon
            />
            <!-- 可还原 ID 绑定主体和有效期，无需逐接口配置。 -->
            <div
              v-if="rule.treatment === 'REVERSIBLE_ID'"
              class="reversible-fields"
            >
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
.entity-class {
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
.reversible-fields {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}
</style>
