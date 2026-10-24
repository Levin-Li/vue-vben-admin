# 2026-10-24 API 静态字段分组发布记录

## 1. 状态与变化

1. 本次静态声明方案已完成实施和最终验收；后端 Maven 与四个 npm 包均正式发布成功，提交与推送结果待执行负责人补齐。旧快照方案已发布的历史记录保持原状，本批使用独立最终验证结果。
2. 模块 API 目录维护版本 1 静态字段契约，通过 `registerDataAttrStaticContract` 注册；认证从既有 `userInfo.fieldGroupGrants` 安装有效许可，公共 CRUD 本地合并。标准前端字段策略和快照端点均为零调用。
3. 无静态声明且身份就绪时默认无前端字段限制并去重控制台警告；已声明受控组无有效许可时拒绝。服务端真实字段与数据范围授权独立有效，不由 UI 声明授予业务权利。

## 2. 包范围与版本

1. 当前受影响交付为 `@levin/admin-framework` 的本地契约、认证和 CRUD、包指南，以及 `@levin/oak-base-admin` 的生成 API 契约和模块注册。BPM 等精确依赖消费者由发布器计算，不凭包名印象排除。
2. 实际发布的标准闭包为框架/BPM 设计器/BPM 运行时 `6.0.12 → 6.0.13`、Oak `6.0.14 → 6.0.15`；其它无变化包保持版本未重发。
3. 真实 tarball 检查确认框架 `package/dist/framework-commons/data-attr-policy.mjs`、`package/dist/framework-commons/app/store/auth.mjs` 及 `package/docs/api-attribute-group-permissions.md` 已入包；Oak 的 source/dist API `data-attr-contract.json` 和 dist `api/register-data-attr-contract.mjs` 已入包。BPM 两包及 Oak 的 framework peer 均为精确 `6.0.13`；过程资料、审计与日志不混入。

本批次 tarball 路径相对 `frontend/admin` 根目录，发布器上传下列同一份已校验文件：

| 包及已发布版本 | tarball 路径 |
| --- | --- |
| `@levin/admin-framework@6.0.13` | `npm-packages/.publish-tarballs/batch-1792847807541-45411/@levin__admin-framework/levin-admin-framework-6.0.13.tgz` |
| `@levin/bpm-designer@6.0.13` | `npm-packages/.publish-tarballs/batch-1792847807541-45411/@levin__bpm-designer/levin-bpm-designer-6.0.13.tgz` |
| `@levin/bpm-runtime-ui@6.0.13` | `npm-packages/.publish-tarballs/batch-1792847807541-45411/@levin__bpm-runtime-ui/levin-bpm-runtime-ui-6.0.13.tgz` |
| `@levin/oak-base-admin@6.0.15` | `npm-packages/.publish-tarballs/batch-1792847807541-45411/@levin__oak-base-admin/levin-oak-base-admin-6.0.15.tgz` |

## 3. 最终验证与正式上传

1. `pnpm exec vitest run --dom --maxWorkers=2 --testTimeout=15000` 最终 475 个测试文件通过、2 个跳过，3,136 项通过、14 项跳过；官方 `pnpm run check:type` 4/4 成功，`pnpm run build:admin-modules` 成功。后端完整 Reactor 验证 2,558 项、0 失败/错误、118 项按条件跳过，隔离 PostgreSQL 操作日志测试实际执行；详细证据见[实现记录](../../../../openspec/changes/c20261024-1923-static-api-field-groups/implementation.md)及[安全审计](../../../../openspec/changes/c20261024-1923-static-api-field-groups/security-audit.md)。
2. 静态契约两次门禁成功，构建 dist JSON 与源码一致；864 个接口、117 个受控接口。源 JSON 6,394,845 字节、gzip 级别 9 为 288,124 字节，属于构件测量，不声称为实际浏览器传输量。
3. 真实浏览器 9 个既定场景通过（首轮 6 项、修复后 3 项），90 个可见页面通过，观察窗口共 278 个 API 请求；119 路由记录差集补充 20 条检查通过（17 入口、3 匿名保护重定向），无业务叶页遗漏。页面打开不等于全部业务按钮操作；超过 5 次页面逐项解释及认证渲染/预期 404 边界见[页面请求审计](../../../../openspec/changes/c20261024-1923-static-api-field-groups/page-request-audit.md)。
4. 登录起两个字段策略端点 HTTP 调用均为零，userInfo 一次返回 39 项许可，工作流目录 1 次。两个页面角色选项各 1 次，十轮切页新增角色查询为零；个人资料 14 次、UI 设置首开 7 次/重开 2 次都有来源说明。304 仍计 HTTP 请求，不把缓存验证说成零网络。
5. 标准命令 `NPM_REGISTRY=http://nexus.v-ma.com/repository/npm/ NPM_AUTH_FROM_MAVEN=true MAVEN_SERVER_ID=dist-repo pnpm run publish:packages` 已零退出，逐包报告成功，最终“本批发布完成：4 个包”，本机日志 `/tmp/levin-static-npm-release.log`。真实 tarball 逐文件/精确内部版本检查、独立消费者安装及 Vite 构建全部通过后才上传，成功后未重复反查私服。Git 提交及推送：待补。配套后端完整 Reactor `clean deploy` 已零退出且 `BUILD SUCCESS`，2026-10-24 21:15:02（亚洲/上海）结束，公共模块 `6.0.0-SNAPSHOT` 上传成功，两个 bootstrap 跳过部署。
6. 使用[正式发布入口](../admin-modules-publish.md#按需正式版本发布流程)，上传同一份已校验 tarball；成功后不重复反查私服。本批配套后端沿用当前 `6.0.0-SNAPSHOT`，无数据库迁移、自动响应加密或生产服务重启。

## 4. 使用和资料边界

1. [API 属性组授权接入指南](../../packages/business/admin-framework/docs/api-attribute-group-permissions.md)、[运行时 CRUD 指南](../../packages/business/admin-framework/docs/runtime-crud-metadata.md)是随包接入说明。本发布执行记录仅留源仓库，浏览器证据、临时 tarball、日志与本机配置快照不进入提交或 npm 包。
