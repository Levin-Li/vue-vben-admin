<script lang="ts" setup>
import type { Component } from 'vue';

import type { WorkflowBusinessDetail } from './types';

import { computed } from 'vue';

// 详情作为可独立使用的公开组件，必须自行提供展示组件依赖。
import {
  Alert as AAlert,
  Descriptions as ADescriptions,
  DescriptionsItem as ADescriptionsItem,
} from 'ant-design-vue';

// 宿主显式注册本地组件；服务端只能返回键，不能下发组件源码或任意地址。
const props = defineProps<{
  components?: Record<string, Component>;
  detail: WorkflowBusinessDetail;
}>();
const detailComponent = computed(
  () =>
    props.detail.detailComponentKey &&
    props.components?.[props.detail.detailComponentKey],
);

// 只展示服务端授权返回的摘要，保持 false 与零可见，不解释 HTML。
function displayValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
</script>

<template>
  <section class="levin-workflow-business-detail">
    <!-- 默认提供具体业务引用和授权摘要，宿主详情用于呈现业务专用布局。 -->
    <ADescriptions :column="1" size="small" bordered>
      <ADescriptionsItem label="业务标题">
        {{ detail.businessTitle || '—' }}
      </ADescriptionsItem>
      <ADescriptionsItem label="业务类型">
        {{ detail.businessType }}
      </ADescriptionsItem>
      <ADescriptionsItem label="业务编号">
        {{ detail.businessId }}
      </ADescriptionsItem>
      <ADescriptionsItem
        v-for="field in detail.businessFields || []"
        :key="field.key"
        :label="field.label"
      >
        {{ displayValue(field.value) }}
      </ADescriptionsItem>
    </ADescriptions>
    <component
      :is="detailComponent"
      v-if="detailComponent"
      class="mt-3"
      :business-reference="{
        businessType: detail.businessType,
        businessId: detail.businessId,
        tenantId: detail.tenantId,
        orgId: detail.orgId,
      }"
      :readonly="true"
    />
    <AAlert
      v-else-if="detail.detailComponentKey"
      class="mt-3"
      type="info"
      message="当前宿主未注册该业务的详情组件，仅展示已授权的业务摘要。"
    />
  </section>
</template>
