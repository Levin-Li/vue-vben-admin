# 2026-09-07 菜单固定查询与设置历史页面发布

## 发布依赖闭包

| 顺序 | 包 | 原版本 | 目标版本 | 依赖/消费者 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 1 | @levin/admin-framework | 5.6.82 | 5.6.83 | 消费者 oak-base-admin、私有 bootstrap-app | 私服发布并下载核验通过 |
| 2 | @levin/oak-base-admin | 5.6.84 | 5.6.85 | peer admin-framework 精确 5.6.83；消费者私有 bootstrap-app | 私服发布并下载核验通过 |

bootstrap-app 保留 workspace:* 作为本地装配入口，不发布；其余可发布包没有本次变更，不重复发布。统一版本源 package-versions.json 同步成功。本批不改后端 revision，也不执行后端 Maven deploy。

## 功能

- 菜单复制、选择既有页面、从原查询字段配置固定条件，副本保持独立入口与页签。
- 固定条件对应查询字段隐藏；查询、重置后查询、刷新、分页与导出最终覆盖同名值。JSON对象保留false/0/数组。
- paramsEditor非空优先Schema，失败回退JSON；未配置时查询表单优先，无查询表单则JSON。保留已有参数。
- 设置历史数据独立页面仅查询、详情、删除，保留原恢复入口，无新增编辑。

## 验证

- 前端11个定向测试文件95项通过；bootstrap-app类型检查、路由过渡检查通过。
- 两包构建、页面元数据、dist路由文件、公开导出、内部依赖、模块开发规范、独立安装及本地/远程tarball发布门禁通过。
- npm pack --dry-run --json逐文件核验本次归属两包的源文件、测试和文档，无遗漏。完整归属见下方清单。
- 后端JDK25完成实体clean compile后gen-code，全reactor定向测试32项通过（菜单同步8、AMIS3、历史2、RBAC19）。
- 真实in-app browser使用隔离新建数据库：创建false条件菜单保存为JSONB，复制再清空副本为{}；原菜单仍false。全量副本6条记录、固定停用菜单0条，展开查询字段隐藏固定项；重置/刷新及导出pageSize=2000请求日志仍含enable=false。Schema失败降级保留原值；历史独立页查询和只读详情成功，无新增编辑入口。
- 原crud-page.vue全文件lint仍有59条既有问题（基线78，无本次新增）；development全源码检查有既有跨包类型问题。本次新增/独立改动文件lint通过，不将上述检查描述为全仓通过。

## 后端与数据升级前置条件

本前端需要配套本次后端代码：Menu.params为JSONObject、paramsEditor新增text字段。业务数据库必须先备份并显式执行根仓库 docs/migrations/20260907-menu-params-json.sql；该脚本本次仅在新建测试库验证7组转换、幂等和回滚用例，未执行到现有业务库。

Menu/MenuInfo不再实现旧service-support MenuItem接口（getParams为String）。下游Java消费者需移除对旧接口的赋值/强制转换；外部插件菜单契约不变。旧字符串参数请求不再兼容，必须提交JSON对象。

发布命令：NPM_REGISTRY=http://nexus.v-ma.com/repository/npm/ NPM_AUTH_FROM_MAVEN=true MAVEN_SERVER_ID=dist-repo pnpm run publish:admin-modules。

## 本次改动归属与归档文件核验

### @levin/admin-framework

本地pack文件数 914；以下本次变更文件均在tarball中：

- `packages/business/admin-framework/docs/menu-fixed-query.md`
- `packages/business/admin-framework/package.json`
- `packages/business/admin-framework/src/framework-commons/__tests__/menu-fixed-query.test.ts`
- `packages/business/admin-framework/src/framework-commons/app/api/core/__tests__/menu-route.test.ts`
- `packages/business/admin-framework/src/framework-commons/app/api/core/menu-route.ts`
- `packages/business/admin-framework/src/framework-commons/app/utils/sync-menu-routes.ts`
- `packages/business/admin-framework/src/framework-commons/app/views/_core/fallback/not-found.vue`
- `packages/business/admin-framework/src/framework-commons/index.ts`
- `packages/business/admin-framework/src/framework-commons/menu-fixed-query.ts`
- `packages/business/admin-framework/src/framework-commons/module-contract.ts`
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/crud-fixed-query.test.ts`
- `packages/business/admin-framework/src/framework-commons/shared/crud-fixed-query.ts`
- `packages/business/admin-framework/src/framework-commons/shared/crud-page.vue`
- `packages/business/admin-framework/src/framework-commons/shared/crud-query-items.ts`
- `packages/business/admin-framework/src/index.ts`

### @levin/oak-base-admin

本地pack文件数 1055；以下本次变更文件均在tarball中：

- `packages/business/oak-base-admin/docs/menu-fixed-query.md`
- `packages/business/oak-base-admin/package.json`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/__tests__/routes.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/admin-crud.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/api/index.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/api/setting-history-data-service.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/module.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/query-config-loaders.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/menu/__tests__/fixed-query-editor.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/menu/__tests__/fixed-query-values.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/menu/config.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/menu/fixed-query-editor.vue`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/menu/fixed-query-values.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/menu/index.vue`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/menu/menu-form-drawer.vue`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/menu/menu-tree-utils.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/menu/types.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/role/config.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/setting-history-data/__tests__/config.test.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/setting-history-data/config.ts`
- `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/setting-history-data/index.vue`
