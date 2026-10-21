# @levin/oak-base-admin

[机器人通知群管理页使用指南](docs/robot-notify-group.md)说明基础设置中的配置入口、权限、Webhook 安全和最小验证。

Levin Oak 基础后台前端业务模块，提供 `com.levin.oak.base` 的基础管理页面、API service、页面注册表、后端菜单路由映射和国际化资源。本包依赖 `@levin/admin-framework` 的基础组件和公共运行时能力。

## 安装

```bash
pnpm add @levin/admin-framework@5.6.45 @levin/oak-base-admin@5.6.43
```

## 启用

```ts
import type { AdminFrontendModule } from '@levin/admin-framework';

import { createOakBaseAdminModule } from '@levin/oak-base-admin';

export const enabledFrontendModules: AdminFrontendModule[] = [
  createOakBaseAdminModule(),
];
```

默认 API 前缀为 `/com.levin.oak.base/V1/api`，默认 CRUD 父级路由为 `/clob/V1/index`，子页面路由为 `/clob/V1/<Resource>`。真实菜单应以后端当前用户授权菜单为准，前端根据菜单路径匹配模块注册页面。上传页面路由时，模块 ID 必须使用后端 Java 根 POM 约定的模块包名 `com.levin.oak.base`，不能由前端自定义；前端目录名使用 `com_levin_oak_base`，短包名 `clob` 只用于后端菜单路径。用户可见展示名称如果后端 Java 根 POM 配置了中文名称，应优先使用该中文名称。

包的正式入口指向 `dist` 构建结果；随包携带的 `src` 只用于源码查看、调试和问题定位，不应通过 `@levin/oak-base-admin/src/...` 参与第三方应用编译。

标准 CRUD 切换标签时的分页与查询状态见[标签状态使用说明](docs/crud-tab-state.md)。
两方电子合同模板与签署入口见[电子合同模板使用指南](docs/electronic-contract-template.md)。
业务处理与超级管理员故障诊断见[AI 网页 Agent 使用指南](docs/ai-agent-business.md)。

基础组件项目第三方使用手册见 `@levin/admin-framework` 包内的 `src/framework-commons/docs/第三方用户手册.md`；本模块补充手册见 `src/modules/com_levin_oak_base/docs/第三方用户手册.md`。具名范围变量的非生产验收入口、页面和后端集成边界见[具名数据范围变量验收与使用说明](docs/named-scope-variable-acceptance.md)，界面设置管理、历史与租户站点覆盖见[界面设置管理](docs/ui-setting-management.md)。发布包会携带 `src`，构建后的 `dist/modules/com_levin_oak_base/docs/第三方用户手册.md` 也会包含同一份手册，第三方项目可在安装后的 `node_modules/@levin/oak-base-admin` 下查看。

## 子项目开发规范

工作流设计、个人办理与无状态字段业务样例的操作说明见[工作流页面使用指南](docs/workflow-pages.md)。

使用本包进行二次开发、配置、扩展或升级的子项目，必须遵循包内的[模块使用与二次开发规范](docs/MODULE-DEVELOPMENT-STANDARD.md)。该规范不要求子项目采用本包发布方的代码包名、源码目录或业务实现。

## 模块开发与设计资料

使用本模块的子项目必须遵循 [模块开发规范](docs/MODULE-DEVELOPMENT-STANDARD.md)。[项目设计和开发参考资料](docs/project-reference/INDEX.md) 提供发布方的设计、需求及规则背景，不构成下游强制约束。

邮件、个人消息、支持邮箱配置、工单与投递审计：[工作台使用指南](docs/communication-workbench.md)。
右上角在线文档入口、文档命名和构建登记：[文档中心使用指南](docs/文档中心使用指南.md)。
服务插件按模式选择供应商：[供应商选择模式接入指南](docs/provider-selection-modes.md)。
法律主体与合作伙伴一对多页面：[接入与使用指南](docs/partner-legal-subject-relations.md)。
独立客户管理：[客户页面使用指南](docs/customer-page.md)。
外部组织主档归属：[管理页面使用指南](docs/external-org-master-ownership.md)。

企业平台登录与组织同步配置：[插件配置指导](docs/enterprise-login-guidance.md)。

供应伙伴与渠道伙伴分开的维护入口及选择器见 [供应商与渠道伙伴页面](docs/partner-inheritance.md)。

结算单 CRUD、财务资料、分笔打款及凭证上传见 [结算单使用指南](docs/settlement-statement.md)。
## 邀请注册链接

签发权限、注册方式、组织创建与链接失效规则见 [邀请注册链接使用指南](docs/invitation-registration.md)。
