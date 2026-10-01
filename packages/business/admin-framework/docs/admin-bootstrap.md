# 管理端公共启动入口

入口应用只负责配置已启用的业务模块、后端服务、页面覆盖和基础偏好。公共框架统一负责组件、国际化、状态、后端菜单路由、界面偏好加载和应用挂载。

## 使用方式

先用 `initPreferences` 初始化应用命名空间，再调用 `configureAdminApplication` 配置业务模块、服务和页面覆盖，最后调用公共 `bootstrap(namespace)`。

```ts
import { configureAdminApplication } from '@levin/admin-framework';
import { bootstrap } from '@levin/admin-framework/framework-commons/app/bootstrap';

configureAdminApplication({
  modules: enabledFrontendModules,
  menuSyncService,
  pageOverrides,
});

await bootstrap(namespace);
```

入口应用不得复制公共 `bootstrap`、后端菜单守卫或界面偏好加载器。业务页面和路由映射在所启用的模块中声明；确需覆盖页面时使用 `pageOverrides`。

## 边界与结果

公共入口会在挂载前最多等待三秒加载编码为“界面偏好设置”的服务端记录；超时不阻断启动，迟到结果继续应用。登录令牌变化后重新加载，旧请求不得覆盖新账号结果。读取失败时保留可用页面与现有偏好；服务端记录不能覆盖入口应用的 `app.accessMode`。后端菜单继续按当前账号授权生成，偏好加载不改变权限。

## 最小验证

启动匿名页面并登录后，检查 `UiSetting/use/resolve?code=界面偏好设置` 请求返回成功；确认主题或导航样式与服务端记录一致，同时检查后端菜单、账号切换和退出登录正常。构建产物应包含 `dist/framework-commons/app/bootstrap.mjs` 与对应类型声明。
