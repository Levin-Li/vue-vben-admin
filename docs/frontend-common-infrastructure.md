# 前端公共基础设施使用说明

本文档说明业务模块如何使用框架提供的前端公共基础设施，当前包括事件总线、顶部栏扩展区和可拖拽浮动面板。

## 公共入口

业务模块必须从 `@levin/admin-framework/framework-commons` 引入这些能力，不得直接引用框架内部实现文件。

允许：

```ts
import {
  DraggableFloatingPanelHost,
  onFrameworkEvent,
  useDraggableFloatingPanels,
  useLayoutHeaderExtensionArea,
} from '@levin/admin-framework/framework-commons';
```

不允许：

```ts
import { useLayoutHeaderExtensionArea } from '@vben/layouts';
import { useDraggableFloatingPanels } from '@levin/admin-framework/framework-commons/shared/draggable-floating-panel-service';
```

## 事件总线

事件总线是前端运行时内的公共消息基础设施。它只负责发送事件、监听事件、移除监听器、启用或禁用监听器、查看当前监听器，不限制业务事件分类，也不替代 API service、Pinia、路由、组件 props 或持久化存储。

每个事件固定有三个字段：

| 字段 | 含义 |
| --- | --- |
| `type` | 事件类型，例如 `api.request`、`tenant.site`、`layout.setting`。事件总线不内置枚举，调用方自行约定稳定字符串。 |
| `topic` | 事件主题，用于表达具体事件，也用于监听匹配。 |
| `data` | 事件数据，由发送方和监听方自行约定结构。 |

发送事件：

```ts
import { emitFrameworkEvent } from '@levin/admin-framework/framework-commons';

emitFrameworkEvent('tenant.site', 'changed', {
  tenantId: 'demo',
});
```

添加监听器：

```ts
import { onFrameworkEvent } from '@levin/admin-framework/framework-commons';

const unsubscribe = onFrameworkEvent(
  'tenant.site',
  'changed',
  (event) => {
    console.log(event.type);
    console.log(event.topic);
    console.log(event.data);
  },
  '同步租户站点变更',
);

unsubscribe();
```

监听器的 `topicPattern` 支持通配符：

| 通配符 | 含义 |
| --- | --- |
| `*` | 匹配任意长度字符，包括空字符。 |
| `?` | 匹配任意一个字符。 |

例如：

```ts
onFrameworkEvent('api.request', '*/rbac/tenantSiteInfo', (event) => {
  console.log(event.data);
});
```

查看、移除、启用和禁用监听器：

```ts
import {
  getFrameworkEventListeners,
  removeFrameworkEventListener,
  setFrameworkEventListenerEnabled,
} from '@levin/admin-framework/framework-commons';

const listeners = getFrameworkEventListeners();

setFrameworkEventListenerEnabled(listeners[0].id, false);
setFrameworkEventListenerEnabled(listeners[0].id, true);
removeFrameworkEventListener(listeners[0].id);
```

使用约束：

- 跨模块通知优先使用事件总线，不允许业务模块之间直接互相调用内部实现。
- 事件总线是内存广播，不做持久化。
- 监听器应写备注，方便在监听器管理界面识别用途。
- 组件或业务功能卸载时应清理监听器。
- 禁用监听器只是不再接收事件，不会删除监听器记录。
- 事件总线不判断业务成功或失败，业务模块应基于自身数据规则判断。

API 请求事件的详细约定见 `docs/framework-event-bus.md` 和 `前端API开发规则.md`。

## 顶部栏扩展区

顶部栏扩展区用于把业务控件固定到当前顶部栏中，例如当前商户选择器、当前项目选择器、全局筛选器等。它跟随顶部栏高度、布局、显示隐藏和响应式策略，不应使用 `position: fixed` 或浮动面板模拟。

可用区域：

| 区域 | API | 适用场景 |
| --- | --- | --- |
| 顶部中央 | `useLayoutHeaderExtensionArea('center')` | 当前页面或当前业务上下文的主筛选、范围选择。 |
| 顶部右侧 | `useLayoutHeaderExtensionArea('right')` | 靠近全局工具区的轻量业务控件。 |

固定到顶部中央：

```vue
<script setup lang="ts">
import { useLayoutHeaderExtensionArea } from '@levin/admin-framework/framework-commons';
import CurrentMerchantSelect from './current-merchant-select.vue';

const topCenter = useLayoutHeaderExtensionArea('center');

topCenter.add({
  id: 'project-publish-merchant',
  component: CurrentMerchantSelect,
  class: 'px-2',
  order: 10,
});
</script>
```

固定到顶部右侧：

```vue
<script setup lang="ts">
import { useLayoutHeaderExtensionArea } from '@levin/admin-framework/framework-commons';
import CurrentProjectSelect from './current-project-select.vue';

const topRight = useLayoutHeaderExtensionArea('right');

topRight.add({
  id: 'project-publish-project',
  component: CurrentProjectSelect,
  class: 'mr-2',
  order: 20,
});
</script>
```

注册项字段：

| 字段 | 含义 |
| --- | --- |
| `id` | 稳定唯一标识。同一个区域内重复 `id` 会替换旧项。 |
| `component` | 要渲染的 Vue 组件。 |
| `render` | 直接渲染函数。`component` 和 `render` 二选一。 |
| `props` | 传给组件的属性。 |
| `class` | 外层容器类名。 |
| `order` | 排序值，越小越靠前。 |

使用约束：

- 普通页面组件不能直接改顶部栏模板时，使用 `useLayoutHeaderExtensionArea` 注册。
- 业务本身直接拥有布局模板时，可以使用 `#header-top-center` 和 `#header-top-right` 插槽。
- 注册项必须有稳定 `id`，避免重复进入页面后堆叠。
- 通过组合式函数 `add` 创建的项会在当前组件卸载时自动清理；也可以保存 `add` 返回的清理函数手动清理。
- 顶部栏控件不是浮动面板，不允许用可拖拽浮动面板或固定定位代替。

## 可拖拽浮动面板

可拖拽浮动面板用于页面内容区内的上下文切换器、筛选条、临时工具面板等。它不占用页面正常布局空间，默认相对页面内容容器定位，并支持用户拖拽。

页面承载方式：

```vue
<script setup lang="ts">
import {
  DraggableFloatingPanelHost,
  useDraggableFloatingPanels,
} from '@levin/admin-framework/framework-commons';
import CurrentMerchantSelect from './current-merchant-select.vue';

const floatingPanels = useDraggableFloatingPanels('project-publish');

floatingPanels.add({
  id: 'merchant-filter',
  component: CurrentMerchantSelect,
  order: 10,
  panelProps: {
    defaultPlacement: 'top-center',
    panelClass: 'px-5 py-3',
    persist: true,
    storageKey: 'project-system:publish:merchant-filter',
  },
});
</script>

<template>
  <DraggableFloatingPanelHost scope="project-publish">
    页面内容
  </DraggableFloatingPanelHost>
</template>
```

常用配置：

| 字段 | 含义 |
| --- | --- |
| `scope` | 面板作用域。同一页面或同一业务区域使用稳定 scope。 |
| `id` | 稳定唯一标识。同一 scope 内重复 `id` 会替换旧项。 |
| `component` | 要渲染的 Vue 组件。 |
| `render` | 直接渲染函数。`component` 和 `render` 二选一。 |
| `props` | 传给组件的属性。 |
| `order` | 排序值，越小越靠前。 |
| `panelProps.defaultPlacement` | 默认位置，支持 `top-center`、`top-left`、`top-right`。 |
| `panelProps.storageKey` | 持久化拖拽位置的存储键。 |
| `panelProps.persist` | 是否持久化拖拽位置。 |
| `panelProps.panelClass` | 面板容器类名。 |
| `panelProps.disabled` | 是否禁用拖拽。 |

使用约束：

- 同一页面存在多个浮动面板时，优先使用 `DraggableFloatingPanelHost` 承载，并通过同一个 `scope` 管理。
- 需要记住用户位置时，必须提供稳定 `storageKey`；不同页面、不同业务上下文不得共用同一个存储键。
- 承载容器应提供稳定定位上下文，确保默认位置是相对页面内容区。
- 通过 `useDraggableFloatingPanels(scope).add` 创建的项会在当前组件卸载时自动清理；也可以调用 `remove(id)` 手动移除。
- 固定在顶部栏的控件不得使用浮动面板实现，应使用顶部栏扩展区。

## 选择规则

| 需求 | 应使用 |
| --- | --- |
| 跨模块通知某件事发生 | 事件总线 |
| API 返回后通知其它框架能力 | API 请求事件 |
| 控件固定在顶部栏中央或右侧 | 顶部栏扩展区 |
| 控件悬浮在页面内容区并允许拖动 | 可拖拽浮动面板 |
| 页面内部父子组件通信 | props、emits、provide/inject |
| 持久保存业务状态 | API、Pinia 或业务存储 |
