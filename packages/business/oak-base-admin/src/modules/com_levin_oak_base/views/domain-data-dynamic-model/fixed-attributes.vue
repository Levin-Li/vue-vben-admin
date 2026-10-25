<script setup lang="ts">
import type {
  DataModelDefinition,
  DataModelScopeKind,
} from '../../api/data-model-service';

import { computed } from 'vue';

import { Descriptions } from 'ant-design-vue';

import { scopeKindOf, scopeOptions } from './model-form';

const props = defineProps<{
  model?: DataModelDefinition;
  scopeKind?: DataModelScopeKind;
}>();
const scope = computed(
  () => props.scopeKind || (props.model ? scopeKindOf(props.model) : 'PRIVATE'),
);
function title(name: string, fallback: string) {
  return (
    props.model?.systemFields?.find(
      (field) => field.source === 'MODEL_ATTRIBUTE' && field.name === name,
    )?.title || fallback
  );
}
function fixedValue(value?: boolean | number | string) {
  if (value === null || value === undefined) return '由服务端确定';
  if (typeof value === 'boolean') return value ? '是' : '否';
  return value;
}
</script>

<template>
  <Descriptions
    title="系统固定属性（只读、不可删除）"
    bordered
    :column="2"
    size="small"
  >
    <Descriptions.Item :label="title('key', '模型 ID（稳定标识）')">
      {{ model?.key || '保存后固定' }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('domainId', '平台领域')">
      {{ fixedValue(model?.domainId) }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('tenantId', '归属租户 ID')">
      {{ model ? model.tenantId || '空（平台公开）' : '保存后由服务端确定' }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('orgId', '归属组织 ID')">
      {{ model ? model.orgId || '空（无组织归属）' : '保存后由服务端确定' }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('ownerId', '所有者 ID')">
      {{ model ? model.ownerId || '空（非私人）' : '保存后由服务端确定' }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('tenantShared', '跨租户共享定义')">
      {{ fixedValue(model?.tenantShared) }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('orgShared', '跨组织共享定义')">
      {{ fixedValue(model?.orgShared) }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('platformPublic', '平台公开（派生）')">
      {{ scope === 'PLATFORM' ? '是' : '否' }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('tenantPublic', '租户公开（派生）')">
      {{ scope === 'TENANT' ? '是' : '否' }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('orgPublic', '组织内可见（派生）')">
      {{ scope === 'ORG' ? '是' : '否' }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('scopeKind', '归属层级')">
      {{ scopeOptions.find((item) => item.value === scope)?.label || scope }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('createdAt', '创建时间')">
      {{ fixedValue(model?.createdAt) }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('creator', '创建人')">
      {{ fixedValue(model?.creator) }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('updatedAt', '更新时间')">
      {{ fixedValue(model?.updatedAt) }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('enabled', '启用状态')">
      {{ fixedValue(model?.enabled) }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('editable', '可编辑')">
      {{ fixedValue(model?.editable) }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('orderCode', '排序')">
      {{ fixedValue(model?.orderCode) }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('remark', '备注')">
      {{ fixedValue(model?.remark) }}
    </Descriptions.Item>
    <Descriptions.Item :label="title('version', '乐观锁版本')">
      {{ fixedValue(model?.version) }}
    </Descriptions.Item>
  </Descriptions>
</template>
