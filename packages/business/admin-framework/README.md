# @levin/admin-framework

Levin 后台基础组件和公共运行时框架包，面向第三方后台系统提供应用启动、布局、路由、权限、菜单同步、通用 CRUD、页面注册、页面覆盖、事件总线、顶部栏扩展区和窗口级可拖拽悬浮面板等基础能力。

## 安装

```bash
pnpm add @levin/admin-framework@5.6.8
```

通常还会按业务需要安装基础模块：

```bash
pnpm add @levin/oak-base-admin@5.6.8
```

## 使用方式

第三方最终应用应保持薄宿主结构，只负责启动、配置后端地址、启用模块、主题偏好和页面覆盖。公共框架和业务模块通过 npm 私服包安装，不建议复制源码长期集成。包的正式入口指向 `dist` 构建结果；随包携带的 `src` 只用于源码查看、调试和问题定位，不应通过 `@levin/admin-framework/src/...` 参与第三方应用编译。

```ts
import {
  configureAdminApplication,
  normalizeAdminGlobPageMap,
  type AdminPageMap,
} from '@levin/admin-framework';

const pageOverrides = normalizeAdminGlobPageMap(
  import.meta.glob('./pages/**/*.vue') as AdminPageMap,
  './pages',
);

configureAdminApplication({
  modules: enabledFrontendModules,
  pageOverrides,
});
```

完整第三方使用手册见 `src/framework-commons/docs/第三方用户手册.md`。
