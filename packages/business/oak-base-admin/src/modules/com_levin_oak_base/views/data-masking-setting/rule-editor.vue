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
    const field = entityCatalog.value.find(
      (item) =>
        item.entityClass === entityClass && item.fieldName === fieldName,
    );
    if (!field || field.configurable === false) return;
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
  if (field.configurable === false) return;
  if (treatment === 'REVERSIBLE_ID' && !field.hasInputMapping) return;
  const previous = rule.treatment;
  rule.treatment = treatment;
  if (treatment === 'REVERSIBLE_ID' && previous !== 'REVERSIBLE_ID') {
    rule.binding = 'SESSION';
    rule.validSeconds = null;
  }
  if (treatment !== 'REVERSIBLE_ID') {
    delete rule.binding;
    delete rule.validSeconds;
  }
}

function setValidSeconds(rule: MaskingFieldRule, value: number | string | null | undefined) {
  // 空值表示不过期；非法数字保留为 NaN，由保存校验拒绝而不是意外变成不过期。
  rule.validSeconds = value === null || value === undefined || value === '' ? null : Number(value);
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

        <div class="field-grid">
          <div
            v-for="field in fieldsFor(entityClass)"
            :key="field.fieldName"
            class="rule-card"
          >
            <!-- 字段和三个设置保持同一行，窄容器可横向滚动。 -->
            <div class="rule-line">
              <Checkbox
                class="rule-check"
                :checked="!!ruleFor(entityClass, field.fieldName)"
                :disabled="
                  disabled ||
                  (field.configurable === false &&
                    !ruleFor(entityClass, field.fieldName))
                "
                :title="displayName(field.fieldTitle, field.fieldName)"
                @change="
                  toggleField(
                    entityClass,
                    field.fieldName,
                    $event.target.checked,
                  )
                "
              >
                {{ displayName(field.fieldTitle, field.fieldName) }}
              </Checkbox>
              <span
                v-if="field.configurable === false"
                class="unsupported-reason"
              >
                {{ field.unsupportedReason || '暂不支持此字段' }}
              </span>
              <template
                v-for="rule in rules.filter(
                  (item) =>
                    item?.entityClass === entityClass &&
                    item.fieldName === field.fieldName,
                )"
                :key="rule.fieldName"
              >
                <Select
                  class="rule-treatment"
                  :value="rule.treatment"
                  :disabled="disabled || field.configurable === false"
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
                <template v-if="rule.treatment === 'REVERSIBLE_ID'">
                  <Select
                    v-model:value="rule.binding"
                    class="rule-binding"
                    :disabled="disabled || field.configurable === false"
                    :options="[
                      { label: '当前用户', value: 'USER' },
                      { label: '当前登录会话', value: 'SESSION' },
                    ]"
                    placeholder="绑定范围"
                  />
                  <InputNumber
                    :value="rule.validSeconds ?? undefined"
                    @update:value="setValidSeconds(rule, $event)"
                    class="rule-timeout"
                    addon-after="秒"
                    :disabled="disabled || field.configurable === false"
                    :min="1"
                    :max="86400"
                    placeholder="默认不过期"
                  />
                </template>
              </template>
            </div>
            <Alert
              v-if="
                ruleFor(entityClass, field.fieldName)?.treatment ===
                  'REVERSIBLE_ID' && !field.hasInputMapping
              "
              type="warning"
              message="当前字段缺少请求映射，请改用隐藏或普通遮盖后再保存。"
              show-icon
            />
          </div>
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
.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.rule-card {
  min-width: 0;
  padding: 8px;
  overflow-x: auto;
  border: 1px solid var(--ant-color-border, #d9d9d9);
  border-radius: 8px;
}
.rule-line {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 492px;
}
.rule-check {
  flex: 1 0 95px;
  min-width: 95px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.rule-check :deep(span:last-child) {
  overflow: hidden;
  text-overflow: ellipsis;
}
.rule-treatment {
  flex: 0 0 104px;
  width: 104px;
}
.rule-binding {
  flex: 0 0 130px;
  width: 130px;
}
.rule-timeout {
  flex: 0 0 145px;
  width: 145px;
}
.unsupported-reason {
  color: var(--ant-color-text-disabled, #999);
  font-size: 12px;
}
@media (max-width: 900px) {
  .field-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
