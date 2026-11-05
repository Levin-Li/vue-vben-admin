<script setup lang="ts">
import type { UserOrgSelectorModelValue } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import type { SupportScope } from '../api/support-workbench-types';

import { UserOrgSelector } from '@levin/admin-framework';

import { userService } from '../api/user-service';
import { buildSupportUserQuery } from './support-options';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    modelValue?: UserOrgSelectorModelValue;
    multiple?: boolean;
    scope?: SupportScope;
  }>(),
  { modelValue: undefined, scope: undefined, multiple: false, disabled: false },
);
const emit = defineEmits<{
  'update:modelValue': [value: UserOrgSelectorModelValue];
}>();

// 固定使用当前业务组织作为唯一根，用户候选仍由同组织、同租户接口查询。
const loadOrganizations = async () =>
  props.scope
    ? [
        {
          id: props.scope.orgId,
          name: '当前受理组织',
          tenantId: props.scope.tenantId,
        },
      ]
    : [];
let cachedScope = '';
let cachedUsers: Record<string, any>[] | undefined;
async function loadUsers() {
  const scope = props.scope;
  if (!scope) return [];
  const scopeKey = JSON.stringify(scope);
  if (scopeKey === cachedScope && cachedUsers) return cachedUsers;
  const items: Record<string, any>[] = [];
  const ids = new Set<string>();
  for (let pageIndex = 1; ; pageIndex++) {
    const page = (await userService.list(
      {
        ...buildSupportUserQuery(scope),
        requireTotals: true,
        pageIndex,
      },
      {
        __globalUserOrgContext: {
          tenantId: scope.tenantId,
          orgIds: [scope.orgId],
        },
      },
    )) as {
      items: Record<string, any>[];
      totals: number;
    };
    if (scopeKey !== JSON.stringify(props.scope))
      throw new Error('受理组织已变化');
    const pageItems = page.items || [];
    const total = Number(page.totals);
    if (!Number.isFinite(total) || total < 0)
      throw new Error('用户列表缺少有效总数');
    for (const item of pageItems) {
      const id = String(item.id || '');
      if (!id || ids.has(id)) throw new Error('用户列表分页数据不完整');
      ids.add(id);
      items.push({ ...item, name: item.realName || item.name || item.id });
    }
    if (items.length >= total) break;
    if (pageItems.length === 0) throw new Error('用户列表未完整加载');
  }
  cachedScope = scopeKey;
  cachedUsers = items;
  return items;
}
async function resolveRecords(ids: string[]) {
  const allowedIds = new Set(ids);
  const users = await loadUsers();
  return users
    .filter((item) => allowedIds.has(String(item.id)))
    .map((item) => ({
      id: String(item.id),
      kind: 'user' as const,
      name: String(item.realName || item.name || item.id),
      raw: item,
    }));
}
</script>

<template>
  <UserOrgSelector
    :model-value="modelValue"
    :disabled="disabled || !scope"
    :multiple="multiple"
    :max-select-count="multiple ? 0 : 1"
    :selectable-types="['user']"
    :org-load-api="loadOrganizations"
    :user-load-api="loadUsers"
    :resolve-records="resolveRecords"
    load-on-initial-value
    value-mode="id"
    placeholder="请选择用户"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
