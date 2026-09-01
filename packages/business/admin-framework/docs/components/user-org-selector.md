# UserOrgSelector 用户与组织选择器

`UserOrgSelector` 是 `@levin/admin-framework` 提供的树形业务选择器，用于在授权组织树中选择组织、用户或两者。它适合表单字段、查询条件、权限范围和业务范围选择。

它不是“全局当前组织”状态管理器：组件只加载和输出选择结果，不会持久化选择、广播跨页面事件、修改登录权限，或自动为其它页面请求追加 `orgId`。需要全局组织上下文时，宿主应用必须在组件外维护自己的状态和消费规则。

## 安装后的阅读路径

本文件作为发布包静态资料分发。安装后可直接查看：

```text
node_modules/@levin/admin-framework/docs/components/user-org-selector.md
```

组件运行时和类型请始终从包根入口导入，不要从 `src` 或框架内部路径导入：

```ts
import {
  UserOrgSelector,
  type UserOrgSelectorRecord,
} from '@levin/admin-framework';
```

## 默认数据与交互

组件初始化时默认请求当前登录用户有权限访问的组织树，调用 `rbacService.fetchAuthorizedOrgTree()`，接口语义为 `/rbac/authorizedOrgList`，默认携带 `assembleTree=true`。

- 默认一次性加载授权组织树（`orgLoadMode="all"`）。
- 允许选择用户时，用户不会预加载；用户展开某个组织后才加载该组织下的用户。
- 默认用户加载器调用 `/User/list`，请求包含 `orgId`、`loadOrg=true`、`enable=true`、`pageIndex=1` 和 `pageSize=500`；可通过参数替换。
- 树内的组织与用户使用不同的内部键，调用方只需使用组件输出的 ID 或记录，不应依赖内部键格式。

## 基础示例

### 只选择一个组织

```vue
<script setup lang="ts">
import { ref } from 'vue';

import {
  UserOrgSelector,
  type UserOrgSelectorRecord,
} from '@levin/admin-framework';

const currentOrganization = ref<UserOrgSelectorRecord | null>(null);
</script>

<template>
  <UserOrgSelector
    v-model="currentOrganization"
    :max-select-count="1"
    mode="org"
    placeholder="请选择组织"
    value-mode="record"
  />
</template>
```

### 选择组织或用户，并保留完整记录

```vue
<script setup lang="ts">
import { ref } from 'vue';

import {
  UserOrgSelector,
  type UserOrgSelectorRecord,
} from '@levin/admin-framework';

const selectedRecords = ref<UserOrgSelectorRecord[]>([]);
const selectedValue = ref<UserOrgSelectorRecord | null>(null);
const oakBaseApiModule = '/com.levin.oak.base/V1/api';
</script>

<template>
  <UserOrgSelector
    v-model="selectedValue"
    v-model:selected-records="selectedRecords"
    :org-types="['Department']"
    :user-types="['Internal']"
    mode="both"
    :user-api-module-base="oakBaseApiModule"
    value-mode="record"
  />
</template>
```

## 选择、模型和事件

### 选择模式

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `mode` | `'both'` | `'org'` 只允许组织，`'user'` 只允许用户，`'both'` 两者均可。 |
| `allowSelectOrg` | `true` | 是否允许选择组织；仍受 `mode`、`orgTypes` 和叶子规则限制。 |
| `allowSelectUser` | `true` | 是否允许选择用户；仍受 `mode`、`userTypes` 和组织类型限制。 |
| `multiple` | `false` | 是否多选；多选时启用树形勾选。 |
| `maxSelectCount` | `0` | 最大选择数；`0` 不限制，`1` 强制单选，其他正数超限时提示。 |
| `allowClear` | `true` | 是否允许清空。 |
| `disabled` | `false` | 是否禁用组件。 |
| `placeholder` | `请选择用户或组织` | 空值提示文案。 |
| `showSearch` | `true` | 是否支持按节点标题搜索。 |

`maxSelectCount=1` 会优先于 `multiple=true`，按单选处理。`onlyLeafNode` 与 `onlyNotLeafNode` 不能同时开启。

### v-model 和记录类型

| 参数 / 事件 | 说明 |
| --- | --- |
| `modelValue` / `v-model` | 选中值。输出形态由 `valueMode` 决定。 |
| `valueMode` | 默认 `'id'`，单选输出 `string \| undefined`，多选输出 `string[]`；设为 `'record'` 时单选输出记录或 `null`，多选输出记录数组。 |
| `selectedRecords` / `v-model:selected-records` | 始终输出完整选中记录数组，适合回显和读取名称、类型、归属组织。 |
| `resolveRecords` | 当 `v-model` 只持有尚未加载到当前树的 ID 时，异步解析对应记录，用于补全名称和回显。 |
| `change` | 选择变化时触发，参数依次为单个记录或记录数组（单选无值时为 `null`）以及本次 `v-model` 值。 |

记录类型如下：

```ts
interface UserOrgSelectorRecord {
  id: string;
  kind: 'org' | 'user';
  name: string;
  type?: string;
  raw?: Record<string, any>;
  orgId?: string; // 用户所属组织 ID
  orgName?: string; // 用户所属组织名称
}
```

如果已有 ID 但节点尚未加载到当前树中，可通过 `selectedRecords` 预置记录；也可提供 `resolveRecords(ids)` 异步解析记录，组件会将解析结果放到“当前选择”分组中回显。

## 组织范围、类型和层级

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `orgTypes` | `[]` | 可选择组织、以及可加载用户的组织类型白名单；空数组不限制。 |
| `userTypes` | `[]` | 用户类型白名单；默认用户请求会传为 `inType`，组件还会二次过滤。 |
| `rootOrgIdList` | `[]` | 限定授权组织树根节点；空数组使用默认授权根。 |
| `orgRootIds` | `[]` | `rootOrgIdList` 的兼容旧参数；只有前者为空时才使用它。 |
| `onlyLeafNode` | `false` | 仅叶子组织可选，树形路径仍可展示。 |
| `onlyNotLeafNode` | `false` | 仅非叶子组织可选，树形路径仍可展示。 |
| `onlyShowTypeMatchNode` | `false` | 是否隐藏类型不匹配的组织并压缩可见层级。 |
| `maxLoadDeep` | `0` | 最大组织加载深度；`0` 不限制，根组织按第 1 层计算。 |

### `orgTypes` 与 `onlyShowTypeMatchNode` 的区别

只配置 `orgTypes` 时，类型不匹配的组织仍会作为树形路径显示，但不可选择、也不会作为用户加载入口。这适合需要理解真实组织归属关系的页面。

配置 `onlyShowTypeMatchNode=true` 后，类型不匹配的节点会从可见树中移除；若该节点已有匹配的子节点，子节点会被提升到上一层。因此它既是过滤，也是层级压缩，适合快速选择可操作组织的筛选场景。

例如，只允许选择门店时：

```text
集团（不匹配）
└─ 华东大区（不匹配）
   └─ 上海门店（匹配）
```

开启 `onlyShowTypeMatchNode` 后可见树为：

```text
上海门店
```

注意：该上提逻辑依赖已加载到当前树的数据。不要将 `onlyShowTypeMatchNode=true` 与 `orgLoadMode="lazy"` 直接组合用于“匹配节点可能位于不匹配祖先下”的树：祖先被隐藏后无法展开，潜在的匹配后代也就无法触发加载。此类场景应保留路径（关闭该参数），或使用全量组织树加载。

## 组织和用户加载

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `orgLoadMode` | `'all'` | `'all'` 一次性加载树，`'lazy'` 在展开节点时加载子组织。 |
| `orgLoadApi` | — | 自定义组织树加载器，优先于兼容参数 `loadOrgTree`。 |
| `loadOrgTree` | — | `orgLoadApi` 的兼容旧名称。 |
| `userLoadApi` | — | 自定义用户加载器，优先于兼容参数 `loadUsers`。 |
| `loadUsers` | — | `userLoadApi` 的兼容旧名称。 |
| `userApiModuleBase` | `''` | 默认 `/User/list` 请求的模块 API 前缀。 |
| `userListPath` | `'/User/list'` | 默认用户列表路径。 |
| `userPageSize` | `500` | 默认加载某组织下用户的数量。 |

自定义组织加载器会接收当前选择规则；懒加载时额外获得父组织上下文：

```ts
const orgLoadApi = async ({
  allowSelectOrg,
  allowSelectUser,
  depth,
  maxLoadDeep,
  mode,
  onlyLeafNode,
  onlyNotLeafNode,
  onlyShowTypeMatchNode,
  orgLoadMode,
  orgTypes,
  parentOrg,
  parentOrgId,
  rootOrgIdList,
}) => {
  // 返回组织记录数组或树形组织记录数组
};
```

自定义用户加载器接收当前展开组织和用户类型：

```ts
const userLoadApi = async ({ org, orgId, userTypes }) => {
  const result = await userService.list({
    enable: true,
    inType: userTypes.length > 0 ? userTypes : undefined,
    loadOrg: true,
    orgId,
    pageIndex: 1,
    pageSize: 500,
  });

  return result.items || [];
};
```

懒加载不要求后端提供子节点数量。未加载过的组织会保留展开入口；尝试加载完成后，组件根据实际返回的组织子节点和用户节点判断是否仍是叶子节点。

## 顶部“当前组织”接入提示

可以将组件作为顶部栏固定控件注册，但 `UserOrgSelector` 仍只承担选择职责。若选择结果要作为全局当前组织，入口应用需要自行：

1. 将输出记录保存到自己的 Pinia/store；
2. 仅向明确支持组织范围的页面传递或广播该状态；
3. 由页面自身决定是否、以及如何向 API 传递 `orgId`；
4. 在登录态或授权组织变化后重新校验已保存的组织是否仍有权限。

不要通过全局请求拦截器无差别注入 `orgId`，否则可能影响系统配置、跨组织管理或没有组织归属的接口。

顶部栏注册方式和生命周期管理请参阅包内公共基础设施说明；顶部固定控件通过 `useLayoutHeaderExtensionArea('center')` 或 `addLayoutHeaderExtensionAreaItem('center', ...)` 注册，不使用页面浮动定位模拟。

## 维护说明

本文件是组件发布文档的唯一详细入口。修改组件公开参数、默认值、事件、记录结构或加载/过滤语义时，必须同步更新本文件、相关测试以及综合使用手册中的入口说明，并在发布前确认本文件进入 npm tarball。
