# @levin/oak-base-admin

Levin Oak 基础后台前端业务模块，提供 `com.levin.oak.base` 的基础管理页面、API service、页面注册表、后端菜单路由映射和国际化资源。本包依赖 `@levin/admin-framework` 的基础组件和公共运行时能力。

## 安装

```bash
pnpm add @levin/admin-framework@5.6.8 @levin/oak-base-admin@5.6.8
```

## 启用

```ts
import type { AdminFrontendModule } from '@levin/admin-framework';

import { createOakBaseAdminModule } from '@levin/oak-base-admin';

export const enabledFrontendModules: AdminFrontendModule[] = [
  createOakBaseAdminModule(),
];
```

默认 API 前缀为 `/com.levin.oak.base/V1/api`，默认 CRUD 路由根路径为 `/admin-crud`。真实菜单应以后端当前用户授权菜单为准，前端根据菜单路径匹配模块注册页面。

包的正式入口指向 `dist` 构建结果；随包携带的 `src` 只用于源码查看、调试和问题定位，不应通过 `@levin/oak-base-admin/src/...` 参与第三方应用编译。

基础组件项目第三方使用手册见 `@levin/admin-framework` 包内的 `src/framework-commons/docs/第三方用户手册.md`；本模块补充手册见 `src/modules/com_levin_oak_base/docs/第三方用户手册.md`。发布包会携带 `src`，构建后的 `dist/modules/com_levin_oak_base/docs/第三方用户手册.md` 也会包含同一份手册，第三方项目可在安装后的 `node_modules/@levin/oak-base-admin` 下查看。
