# 全局组织与用户选择器：选中状态使用说明

框架顶部“全局组织与用户选择器”将当前选中记录保存在共享响应式状态中。页面、组件、请求模块和普通 TypeScript 代码可导入同一份状态，不需要另建 store，也不需要通过 `window` 访问。

本说明描述框架已注册的顶部全局选择器。页面内独立使用 `UserOrgSelector` 时，其 `v-model` 不会自动写入这份全局状态。

## 导入与读取

从包声明的公共子路径导入，不要使用 `src` 或 `dist` 路径：

```ts
import {
  currentGlobalUserOrgRecord,
  currentGlobalOrgId,
  currentGlobalOwnerId,
  getCurrentGlobalOrgId,
  getCurrentGlobalOwnerId,
} from '@levin/admin-framework/framework-commons/app/global-org-context-state';

// 在需要使用时读取 .value，得到此刻的选中记录。
const selected = currentGlobalUserOrgRecord.value;
if (selected) {
  const isUser = selected.kind === 'user';
  const selectedId = selected.id;
  const selectedName = selected.name;
}

const orgId = currentGlobalOrgId.value;
const ownerId = currentGlobalOwnerId.value;
// 普通 TS 函数也可以使用同步 getter，每次调用返回当前 ID。
const sameOrgId = getCurrentGlobalOrgId();
const sameOwnerId = getCurrentGlobalOwnerId();
```

三个 `currentGlobal...` 导出都是 computed ref，变量本身始终存在。`const selected = ...value` 只是读取当时的记录；切换后应重新读取，或使用下面的 computed/watch。业务代码应将记录视为只读，不直接修改 `.value` 或记录内部字段。

## 字段与空值

`currentGlobalUserOrgRecord.value` 的类型为 `UserOrgSelectorRecord | undefined`：

| 字段 | 含义 |
| --- | --- |
| `kind` | `'org'` 表示组织，`'user'` 表示用户。 |
| `id` | 所选组织或用户自身的 ID。 |
| `name` | 所选节点名称。 |
| `orgId` | 选组织时等于该组织 ID；选用户时为其所属组织 ID，可能没有值。 |
| `orgName` | 可选的组织名称。 |
| `type` | 可选的节点业务类型。 |
| `raw` | 可选的原始记录；字段由数据源决定，不保证全部存在。 |

| 状态 | 当前记录 | `currentGlobalOrgId.value` | `currentGlobalOwnerId.value` |
| --- | --- | --- | --- |
| 选择组织 A | `kind='org', id=A` | A | `undefined` |
| 选择组织 A 下的用户 U | `kind='user', id=U, orgId=A` | A | U |
| 选择没有所属组织的用户 U | `kind='user', id=U` | `undefined` | U |
| 未启用、未选中或清空选择 | `undefined` | `undefined` | `undefined` |

框架启动时无选择；加载配置前会清空旧选择，退出登录或注销全局选择器运行时也会重置。未命中配置、配置内容为空或加载失败时保持无选择。此状态不会默认回退为登录用户及其所属组织。已启用时，普通用户只有一个有效可选组织的自动选中行为会正常产生一条组织记录。

状态保存在当前应用内存中，不是跨浏览器标签页共享或持久化记录。仅凭当前记录为 `undefined` 不能区分“功能未启用”“配置加载中”与“尚未选择”。

## 超管读取所选记录的租户信息

超管跨租户选择组织或用户时，需要区分“登录账号所属租户”和“所选记录所属租户”。前者不能作为后者的默认值。

当前 `UserOrgSelectorRecord` 没有标准化的顶层 `tenantId`、`tenantName` 或完整租户对象，也没有 `currentGlobalTenantId` 导出。组件保留接口原始记录为 `raw`；只有数据源返回了租户字段，才能从该记录读取：

```ts
import { computed } from 'vue';
import {
  currentGlobalUserOrgRecord,
} from '@levin/admin-framework/framework-commons/app/global-org-context-state';

const selectedTenantId = computed<string | undefined>(() => {
  const value = currentGlobalUserOrgRecord.value?.raw?.tenantId;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
});
```

这里的 `selectedTenantId` 是业务代码按原始字段派生的值，不是框架已有的全局导出。所选用户接口未返回 `tenantId` 时，即使该用户所属组织存在租户信息，当前标准化逻辑也不会自动从父组织补齐。

未选择、数据源未返回字段或字段为空时，上述示例返回 `undefined`；不能仅凭它判断记录一定属于平台公共数据。租户名称或完整租户信息同样须以数据源实际返回内容为准，不可假定 `raw` 一定包含它们。全局选择器目前也不会自动向请求追加或覆盖 `tenantId`。

## Vue 中响应式展示与监听

```vue
<script setup lang="ts">
import { computed, watch } from 'vue';
import {
  currentGlobalUserOrgRecord,
} from '@levin/admin-framework/framework-commons/app/global-org-context-state';

const selectedName = computed(
  () => currentGlobalUserOrgRecord.value?.name ?? '未选择组织或用户',
);

watch(currentGlobalUserOrgRecord, (selected) => {
  if (!selected) {
    // 清理依赖全局选择的局部展示。
    return;
  }
  // 按 selected.kind / selected.id 更新本页面派生状态。
}, { immediate: true });
</script>

<template>
  <span>{{ selectedName }}</span>
</template>
```

在组件 setup 中同步创建的 watch 随组件卸载停止；在组件外创建的 watch 应保存返回的停止函数并在消费者销毁时调用。框架切换选择时已有标签页失效和刷新行为，监听器不要无条件再次刷新整个页面。

## 普通 TS 模块订阅与释放

```ts
import {
  currentGlobalUserOrgRecord,
  onGlobalUserOrgContextChange,
} from '@levin/admin-framework/framework-commons/app/global-org-context-state';

export function observeGlobalSelection() {
  const update = () => {
    const selected = currentGlobalUserOrgRecord.value;
    // 根据 selected 更新调用方的局部状态，处理 undefined。
  };

  // 事件订阅本身不会立即回调，因此先主动读取一次。
  update();
  const dispose = onGlobalUserOrgContextChange(update);
  // 调用方在结束使用时执行返回的 dispose()。
  return dispose;
}
```

在 Vue 组件中使用此事件订阅时，应通过 `onUnmounted(dispose)` 解除订阅。选择变化按 `kind`、`id`、`orgId` 判定；重复设置相同三项不会通知订阅者，仅名称或原始记录变化也不会更新当前记录。该状态用于选择上下文，不应当作用户资料实时缓存。

## 请求参数按条件注入

业务请求拦截器逐字段处理 URL 参数 orgId、orgIdList、ownerId。规则放在请求 config 的 `__globalUserOrgContext` 中，不放在 params 或 JSON body 中。默认行为已从无条件覆盖改为保留原值。

| 规则 | 默认值 | 说明 |
| --- | --- | --- |
| isOverride | false | 是否强制覆盖原值。 |
| isRequired | 当前选择能否提供该字段 | 是否要求注入；选组织时默认不要求 ownerId。 |

两项规则支持布尔、受限 JavaScript 表达式或同步条件函数，逐字段计算。前端参照后端公共对象的注入判断，不解释 SpEL/Groovy，不复刻后端权限表达式。

### 判断顺序

| isOverride | 原值 | isRequired | 结果 |
| --- | --- | --- | --- |
| false | 非 null/undefined | 任意 | 保留原值。 |
| false | null/undefined | false | 不补值。 |
| false | null/undefined | true | 注入全局值，无法提供则报错。 |
| true | 任意 | true | 强制注入全局值，无法提供则报错。 |
| true | 任意 | false | 有全局值就覆盖，没有则保留原值。 |

空字符串和空数组属于已有值，默认保留。无全局选择时整体跳过，显式 isRequired=true 也不会要求用户先选择；它是字段注入规则，不是控件必选校验。非法条件或非布尔结果会拒绝请求。

### 请求配置示例

以下配置放在所属 API service 的请求选项中：

```ts
import { requestClient } from '@levin/admin-framework/framework-commons/app/api/request';

// 默认保留原值，补充全局选择能够提供的缺失字段。
await requestClient.get('/Demo/list', {
  params: { orgId: 'org-a', orgIdList: ['org-a'], ownerId: 'user-a' },
});

// 强制覆盖当前选择能够提供的字段。
await requestClient.get('/Demo/list', {
  params: { orgId: 'org-a', orgIdList: ['org-a'] },
  __globalUserOrgContext: { isOverride: true },
});

// 不覆盖且不必填：原参数保持不变，不补充缺失值。
await requestClient.get('/Demo/list', {
  params: { orgId: 'org-a' },
  __globalUserOrgContext: { isOverride: false, isRequired: false },
});
```

字段独立注入，不自动修正 orgId/orgIdList 组合。全局选 B、请求只传 orgId=A 时，会保留 A 并补 orgIdList=[B]。需要固定组织 A 时应同时传 orgId=A、orgIdList=[A]，或用 isRequired 条件限制其它字段注入；保留单个字段不代表整个组织筛选都不变。

### 条件函数与表达式

```ts
import type { GlobalUserOrgInjectionRules } from '@levin/admin-framework/framework-commons/app/global-org-context-state';

const rules: GlobalUserOrgInjectionRules = {
  // 示例：只在账号明确带有超管标志时覆盖拥有者。
  isOverride: ({ user, fieldName }) =>
    user.superAdmin === true && fieldName === 'ownerId',
  isRequired: ({ fieldName }) => fieldName === 'ownerId',
};

const expressionRules: GlobalUserOrgInjectionRules = {
  isOverride: "user.superAdmin === true && request.method === 'GET'",
  isRequired: "fieldName === 'ownerId'",
};
// 将 rules 或 expressionRules 作为请求 config.__globalUserOrgContext 传入。
```

| 条件上下文字段 | 含义 |
| --- | --- |
| user | 每次请求时的登录账号信息，缺失时为空对象；标志名称以实际返回为准。 |
| selected | 当前组织或用户记录。 |
| params | 原始请求参数，每个字段都基于同一原输入判断。 |
| fieldName | 当前 orgId、orgIdList 或 ownerId。 |
| originalValue | 当前字段原值。 |
| value | 当前字段的全局候选值，可能为 undefined。 |
| request | 当前 url 和大写 method。 |

函数必须同步返回 boolean，不支持 Promise。表达式支持字段访问、比较和逻辑运算，不支持函数调用、赋值或危险原型属性访问，也不使用 eval。条件应只读取上下文，不修改原参数或共享记录。所选记录无 ownerId 而规则要求注入时会失败。

列表 helper 同样支持规则透传：

```ts
import { fetchCrudList } from '@levin/admin-framework/framework-commons/api';

await fetchCrudList('/Demo/list', { orgId: 'org-a' }, undefined, {
  globalUserOrgContext: { isOverride: true },
});
```

### 完全跳过与适用范围

`__skipGlobalUserOrgContext=true` 仍表示完全跳过，优先于覆盖规则且不计算条件，供选择器候选数据等独立查询使用。它与 isOverride=false 不同；列表 helper 对应选项为 skipGlobalUserOrgContext。

以上规则不区分 HTTP 方法，不修改 JSON body，也不注入 tenantId。选择组织时不提供全局 ownerId；选没有所属组织的用户时不提供全局 orgId/orgIdList。基础请求客户端不执行此注入。读取状态本身不发送请求、改变选择或授予权限。
