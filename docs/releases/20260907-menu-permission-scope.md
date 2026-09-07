# 2026-09-07 菜单展示、权限与组织范围累计修正发布

## 发布依赖闭包

| 顺序 | 包 | 原版本 | 目标版本 | 发布原因及消费者 |
| --- | --- | --- | --- | --- |
| 1 | @levin/admin-framework | 5.6.84 | 5.6.85 | 权限表达式、组织范围、快捷填写和权限树调整；消费者 oak-base-admin、私有 bootstrap-app |
| 2 | @levin/oak-base-admin | 5.6.86 | 5.6.87 | 菜单树及页面中文配置调整；framework peer 精确更新到 5.6.85；消费者私有 bootstrap-app |

私有 bootstrap-app 保持 workspace:*，不发布；没有其他可发布包依赖这两个包，不批量修改其他包。版本由 package-versions.json 同步，发布前已确认两目标版本未占用。

## 功能

- 菜单树使用虚拟渲染并减少重复树操作；中文名称作为主标签，页面名称仅在悬停提示中显示。
- 页面静态分组明确使用中文标题，流控和访问控制页面使用简洁名称；保留已有管理员配置优先级。
- 资源权限只使用显式声明的权限表达式，不再追加 URL 或猜测权限。
- 组织 Scope 增加匹配模式，修正 null 场景的租户处理；移除重复权限提示。
- 快捷填写仅在符合资格时显示，入口归入标题行。

## 工程规则与分发边界

本次修改的《前端API开发规则.md》《前端页面开发规则.md》是工程规则，随本 Git 提交。sync-frontend-rule-docs.mjs 明确只把通用 MODULE-DEVELOPMENT-STANDARD.md 同步到两包 docs，并删除旧 frontend-rules 目录；因此不把工程专用规则强行复制给 npm 下游。两包标准规范、AGENTS.md 和 README 引用按发布门禁核验。Oak 的第三方用户手册属于包源码目录，必须在 tarball 中逐文件核验。

## 验证

- 指定范围的菜单、路由、权限表达式、组织范围、权限树、快捷填写、展示设置和菜单同步共18个测试文件171项通过。
- bootstrap-app 的 vue-tsc --noEmit --skipLibCheck 通过。
- 对本次范围文件逐个用 HEAD 原文执行相同 ESLint 规则核对基线：原 110 条、本次 101 条，未新增错误；仅修正权限树删除 title 后引入的两个 span 格式错误，随后权限树 38 项测试再次通过。其余错误为既有格式/规则问题，未扩大修复范围。
- 全源码类型检查仍有既有跨包问题；入口类型检查通过不代表全仓类型检查通过。
- 两包构建及标准发布器页面元数据、dist路由、本地/远程tarball依赖协议、模块规范和独立安装门禁全部通过。私服按framework后oak发布成功，Oak精确peer为5.6.85。

## 本批完整文件归属清单

### @levin/admin-framework

- `src/framework-commons/app/views/demos/public-components/permissions.vue`
- `src/framework-commons/page-operation-metadata.ts`
- `src/framework-commons/shared/__tests__/crud-permissions.test.ts`
- `src/framework-commons/shared/__tests__/data-permission-dialog.test.ts`
- `src/framework-commons/shared/__tests__/data-permission-transform.test.ts`
- `src/framework-commons/shared/__tests__/org-scope-editor.test.ts`
- `src/framework-commons/shared/__tests__/resource-permission-tree-editor.test.ts`
- `src/framework-commons/shared/crud-page.vue`
- `src/framework-commons/shared/crud-permissions.ts`
- `src/framework-commons/shared/data-permission-dialog.vue`
- `src/framework-commons/shared/data-permission-transform.ts`
- `src/framework-commons/shared/data-permission-types.ts`
- `src/framework-commons/shared/org-scope-editor.vue`
- `src/framework-commons/shared/resource-permission-tree-editor.vue`
- `package.json`（版本及内部依赖元数据）

### @levin/oak-base-admin

- `src/modules/com_levin_oak_base/__tests__/routes.test.ts`
- `src/modules/com_levin_oak_base/admin-crud.ts`
- `src/modules/com_levin_oak_base/docs/第三方用户手册.md`
- `src/modules/com_levin_oak_base/views/article-channel/config.ts`
- `src/modules/com_levin_oak_base/views/client-app/config.ts`
- `src/modules/com_levin_oak_base/views/data-permission-preview/index.vue`
- `src/modules/com_levin_oak_base/views/global-org-selector-setting/config.ts`
- `src/modules/com_levin_oak_base/views/legal-subject/config.ts`
- `src/modules/com_levin_oak_base/views/menu/__tests__/menu-tree-performance.test.ts`
- `src/modules/com_levin_oak_base/views/menu/index.vue`
- `src/modules/com_levin_oak_base/views/menu/menu-tree-utils.ts`
- `src/modules/com_levin_oak_base/views/partner/config.ts`
- `src/modules/com_levin_oak_base/views/setting/config.ts`
- `src/modules/com_levin_oak_base/views/tenant-site/config.ts`
- `src/modules/com_levin_oak_base/views/tenant/config.ts`
- `src/modules/com_levin_oak_base/views/traffic-control-rule/config.ts`
- `src/modules/com_levin_oak_base/views/ui-setting/config.ts`
- `src/modules/com_levin_oak_base/views/url-ex-acl/config.ts`
- `src/modules/com_levin_oak_base/views/user-setting/config.ts`
- `src/modules/com_levin_oak_base/views/user/config.ts`
- `package.json`（版本及内部依赖元数据）

工程级文件：`package-versions.json`、`前端API开发规则.md`、`前端页面开发规则.md`和本发布记录。`admin-bootstrap/`、`npm-packages/`不纳入提交。

发布命令：`NPM_REGISTRY=http://nexus.v-ma.com/repository/npm/ NPM_AUTH_FROM_MAVEN=true MAVEN_SERVER_ID=dist-repo pnpm run publish:admin-modules`。

## Lint 基线明细

| 文件 | HEAD错误 | 发布错误 |
| --- | --- | --- |
| `packages/business/admin-framework/src/framework-commons/app/views/demos/public-components/permissions.vue` | 19 | 19 |
| `packages/business/admin-framework/src/framework-commons/shared/__tests__/org-scope-editor.test.ts` | 22 | 17 |
| `packages/business/admin-framework/src/framework-commons/shared/crud-page.vue` | 59 | 59 |
| `packages/business/admin-framework/src/framework-commons/shared/resource-permission-tree-editor.vue` | 1 | 1 |
| `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/article-channel/config.ts` | 2 | 2 |
| `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/data-permission-preview/index.vue` | 2 | 2 |
| `packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/tenant-site/config.ts` | 5 | 1 |

## 私服逐文件反查结果

- admin-framework 5.6.85：pack dry-run 917个文件，18个本批/规范路径核验通过；私服14个本批源文件与工作区逐字节一致。完整性 `sha512-oJY0VYk51KZ9V282WhMnJdUm1LTQTPitX75Pu/yHcZ/uIIHAZjM0uCqILbyzdJMfJxyA9bLiOKwkf2YDz64vCQ==`。
- oak-base-admin 5.6.87：pack dry-run 1058个文件，24个本批/规范路径核验通过；私服20个本批源文件与工作区逐字节一致。完整性 `sha512-OCuHIRfzd0np6PL0J5UGK5AHptBXQjDDQ5ALe/sNqn6Z1eKXwYMBEVfISDWCfxRwUURFAqlyYsZl0oMRxDWZvQ==`。
