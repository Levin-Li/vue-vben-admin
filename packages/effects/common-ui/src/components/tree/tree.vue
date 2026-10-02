<script setup lang="ts">
/* eslint-disable vue/require-default-prop -- 属性默认值由 treePropsDefaults() 统一提供。 */
import type { TreeProps as PublicTreeProps } from '@vben-core/ui/shadcn';

import { Inbox } from '@vben/runtime/icons';
import { $t } from '@vben/runtime/locales';

import { treePropsDefaults, VbenTree } from '@vben-core/ui/shadcn';

// 发布后的 Vue SFC 编译需要在本文件内解析完整属性结构。
interface TreeProps {
  allowClear?: boolean;
  autoCheckParent?: boolean;
  bordered?: boolean;
  checkStrictly?: boolean;
  childrenField?: string;
  defaultExpandedKeys?: Array<number | string>;
  defaultExpandedLevel?: number;
  defaultValue?: Array<number | string> | number | string;
  disabled?: boolean;
  disabledField?: string;
  getNodeClass?: (
    item: Parameters<NonNullable<PublicTreeProps['getNodeClass']>>[0],
  ) => string;
  iconField?: string;
  labelField?: string;
  multiple?: boolean;
  showIcon?: boolean;
  transition?: boolean;
  treeData: Record<string, any>[];
  valueField?: string;
}

const props = withDefaults(defineProps<TreeProps>(), treePropsDefaults());

// 两个方向均检查，防止包装组件与公开 TreeProps 的字段类型漂移。
type TreePropsCompatibility = TreeProps extends PublicTreeProps
  ? PublicTreeProps extends TreeProps
    ? true
    : never
  : never;
const treePropsCompatible: TreePropsCompatibility = true;
void treePropsCompatible;
</script>

<template>
  <VbenTree v-if="props.treeData?.length > 0" v-bind="props">
    <template v-for="(_, key) in $slots" :key="key" #[key]="slotProps">
      <slot :name="key" v-bind="slotProps"> </slot>
    </template>
  </VbenTree>
  <div
    v-else
    class="flex-col-center text-muted-foreground cursor-pointer rounded-lg border p-10 text-sm font-medium"
  >
    <Inbox class="size-10" />
    <div class="mt-1">{{ $t('common.noData') }}</div>
  </div>
</template>
