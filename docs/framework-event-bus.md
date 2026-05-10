# 前端框架事件总线使用说明

## 目标

框架事件总线是前端公共基础设施，只负责在同一前端运行时内发送事件、添加监听器、移除监听器和查看当前监听器。它不限制业务事件分类，也不替代 API service、Pinia、路由、组件 props 或持久化存储。

公共入口统一从 `@levin/admin-framework/framework-commons` 引入。运行时只使用全局单例 `frameworkEventBus`。

## 事件结构

每个事件固定由三个字段组成：

- `type`：事件类型，例如 `api.request`、`tenant`、`layout`。事件总线不内置枚举限制，调用方自行约定稳定字符串。
- `topic`：事件标题/主题，用于表达具体事件，也用于监听匹配。API 请求事件的 topic 使用请求地址。
- `data`：事件数据，结构由发送方和监听方自行约定。

发送事件的方法也固定使用这三个参数：

```ts
emitFrameworkEvent(type, topic, data);
```

## Topic 匹配规则

监听器的 `topicPattern` 支持通配符：

- `*` 匹配任意长度字符，包括空字符。
- `?` 匹配任意一个字符。
- 除 `*` 和 `?` 外，其它字符按字面值匹配。

示例：

```ts
*
/rbac/*
*/tenantSiteInfo
tenant-site-ui-setting.?pdated
```

## 基础调用

```ts
import {
  addFrameworkEventListener,
  emitFrameworkEvent,
  getFrameworkEventListeners,
  removeFrameworkEventListener,
  setFrameworkEventListenerEnabled,
} from '@levin/admin-framework/framework-commons';

const listenerId = addFrameworkEventListener(
  'tenant',
  'site.changed',
  (type, topic, data) => {
    console.log(type); // tenant
    console.log(topic); // site.changed
    console.log(data);
  },
  '同步租户站点变更',
);

emitFrameworkEvent('tenant', 'site.changed', {
  tenantId: 'demo',
});

console.log(getFrameworkEventListeners());
setFrameworkEventListenerEnabled(listenerId, false);
setFrameworkEventListenerEnabled(listenerId, true);
removeFrameworkEventListener(listenerId);
```

如果当前代码更适合组件卸载时清理，也可以使用 `onFrameworkEvent`。它返回清理函数，并把事件对象传给监听器：

```ts
import { onFrameworkEvent } from '@levin/admin-framework/framework-commons';

const unsubscribe = onFrameworkEvent('ui', 'setting.changed', (event) => {
  console.log(event.type);
  console.log(event.topic);
  console.log(event.data);
});

unsubscribe();
```

## 只监听一次

```ts
import { onceFrameworkEvent } from '@levin/admin-framework/framework-commons';

onceFrameworkEvent('auth', 'login.success', (event) => {
  console.log(event.data);
});
```

## 监听器管理

监听器注册时应填写 `remark`，用于说明监听器的用途。框架会保留当前运行时内的监听器信息，供开发者查看、禁用、启用或移除。

监听器信息包含：

| 字段 | 含义 |
| --- | --- |
| `id` | 监听器唯一标识。 |
| `type` | 监听的事件类型。 |
| `topicPattern` | 监听的主题匹配表达式。 |
| `remark` | 调用方填写的监听器用途说明。 |
| `enabled` | 是否启用。禁用后监听器不会再接收事件，但记录仍保留。 |

代码管理方式：

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

界面管理方式：

- 超级管理员可从用户菜单进入“监听器管理”。
- 列表展示监听器描述、事件类型、主题匹配、状态和操作。
- 禁用监听器后，该监听器不再接收事件。
- 移除监听器后，该监听器从当前运行时删除。

## API 请求事件

API 请求事件只是事件总线的一种使用约定：

- `type` 固定为 `api.request`。
- `topic` 固定为本次请求地址。
- 事件在 API 调用拿到返回结果之后发送；请求异常时也会发送事件，并在 `data.error` 中携带错误对象。
- 事件总线和 API 事件层都不判断业务成功或失败，不提供 `state: 'success' | 'failure'`。监听方应按自身业务规则判断 `data`、`rawData`、`response` 或 `error`。

事件数据是完整请求结果包：

```ts
interface ApiRequestEventPayload<Data = any> {
  /**
   * 请求库的请求配置，通常包含 url、method、params、data、headers
   * 以及当前项目追加的自定义配置。
   */
  config?: Record<string, any>;
  /**
   * API 层最终返回给调用方的值。
   * 普通 ServiceResp 会被解包为业务 data；raw 返回模式下通常是完整 response。
   */
  data?: Data;
  /**
   * 请求或业务解包过程中抛出的错误对象。没有该字段不等于业务成功，
   * 只表示请求链没有在这一层抛错。
   */
  error?: any;
  /**
   * 后端 HTTP 响应体原文，未经过业务解包。
   */
  rawData?: any;
  /**
   * 请求库完整响应对象，通常包含 status、headers、config、data 等底层信息。
   */
  response?: any;
}
```

示例：

```ts
import { onApiRequestTopic } from '@levin/admin-framework/framework-commons/app/api';

const unsubscribe = onApiRequestTopic(
  '*/rbac/tenantSiteInfo',
  (event) => {
    const payload = event.data;
    if (payload.error) {
      return;
    }

    console.log(payload.data);
  },
  '监听租户站点信息接口',
);
```

## 使用约束

- 事件总线只做前端内存广播，不做持久化。
- 监听器按注册顺序执行。
- 单个监听器异常只会记录错误，不会阻断其它监听器。
- 业务模块发布事件时，应使用稳定的 `type` 和 `topic`，不要把临时页面文案作为 topic。
- 业务模块监听事件时，应填写 `remark`，并在组件卸载或模块卸载时清理监听器。
- 临时停用监听器时使用禁用，不要为了临时排查直接删除业务注册逻辑。
- 不允许业务模块直接引用 `framework-commons` 内部实现文件；公共入口以 `@levin/admin-framework/framework-commons` 为准。

更多公共基础设施使用方式见 `docs/frontend-common-infrastructure.md`。
