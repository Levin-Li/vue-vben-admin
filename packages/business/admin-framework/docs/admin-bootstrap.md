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

公共入口会在挂载前最多等待三秒加载编码为“界面偏好设置”的服务端记录；超时不阻断启动，迟到结果继续应用。登录令牌签发后先读取本人状态与权限，属性组策略就绪后再加载用户偏好、全局组织配置和行政区划覆盖；仅有令牌不触发这些业务请求。退出或权限刷新暂停时立即关闭组织配置与通知轮询，旧偏好请求不得在退出后或新账号登录后回写。读取失败时保留可用页面与现有偏好；服务端记录不能覆盖入口应用的 `app.accessMode`。后端菜单继续按当前账号授权生成，偏好加载不改变权限。

## 最小验证

退出后的登录页仍需加载第三方登录目录。后端明确公开的 `GET /oauth/getSupportedPlatforms` 使用基础客户端和精确根路径读取，不依赖上一会话的业务字段策略；签名、加密协商和真实 HTTP 错误继续执行。该例外不包括 POST 同路径、后缀路径、相邻 OAuth 方法或业务接口。普通退出与旧授权世代的请求取消仍会拒绝请求，不能放行业务读写；取消不会显示为服务器故障。

启动匿名页面并登录后，检查 `UiSetting/use/resolve?code=界面偏好设置` 请求返回成功；确认主题或导航样式与服务端记录一致，同时检查后端菜单、账号切换和退出登录正常。构建产物应包含 `dist/framework-commons/app/bootstrap.mjs` 与对应类型声明。
