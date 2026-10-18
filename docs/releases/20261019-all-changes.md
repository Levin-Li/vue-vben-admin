# 2026-10-19 全部变更发布记录

## 范围与候选

本次收拢两个独立仓库的全部待提交变更；本文件记录前端发布，后端及数据库升级前置条件见[后端与整体发布记录](../../../../docs/release/20261019-all-changes.md)。发布不等同于生产部署或执行数据库迁移。

|包|原版本|本批版本|依据|
|---|---|---|---|
|@levin/admin-framework|6.0.8|6.0.9|网页 Agent、邀请/第三方登录、CRUD/金额/配置等框架功能及手册|
|@levin/bpm-designer|6.0.8|6.0.9|工作流设计器源码及框架精确依赖变化|
|@levin/bpm-runtime-ui|6.0.8|6.0.9|工作流运行、表单和任务界面及上游精确依赖变化|
|@levin/oak-base-admin|6.0.9|6.0.10|AI 业务技能、伙伴/客户、结算、通知/机器人、工作流、权限及配置页面|

`@vben-core/foundation`、`@vben-core/ui`、`@vben/runtime`、`@vben/common-ui`、`@vben/layouts` 保持 6.0.1：包自身源码、公开契约和开发规范没有本批交付变更；全项目非规范性 `project-reference` 背景副本不是独立升版依据。归属清单逐个覆盖 dirty/untracked 文件，应用环境、工作区规则和脚本一并提交，构建输出和凭据排除。

## 上传前构件门禁

标准 `pack:packages -- --only=...` 已构建四个候选。实际 tarball 均通过路由资源、dist 导出、包版本、内部精确依赖和 816 份设计/规范文件校验；另外逐一核对 204 个变更交付文件及删除状态，缺失为零。framework 的五个基础 peer 为 6.0.1，BPM designer 依赖 framework 6.0.9，BPM runtime 依赖 framework/designer 6.0.9，Oak 依赖 framework 6.0.9。上传使用标准发布器重新生成并校验的同批 tarball。

## 验证结果与既存限制

完整 Vitest 使用两 worker、20 秒超时：416 个文件中 405 通过、2 跳过、9 失败；2693 用例中 2671 通过、14 跳过、8 失败。以下九个文件在隔离 HEAD 源码、相同依赖与运行器条件下得到相同九文件失败及八用例失败，不能声称全仓零失败：

- `scripts/generate-help-center.test.mjs`：Node 原生测试被 Vitest 收集，未发现 Vitest suite。
- `packages/@core/preferences/__tests__/background-color.test.ts`：旧目录缺少对应源码。
- `packages/@core/preferences/__tests__/config.test.ts`：旧目录缺少对应源码。
- `packages/@core/preferences/__tests__/preferences.test.ts`：旧目录缺少对应源码。
- `packages/@core/ui-kit/form-ui/__tests__/form-api.test.ts`：旧目录缺少对应源码。
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/crud-form-layout.test.ts`：一个既存源码字符串断言不符。
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/crud-list-height-settings.test.ts`：五个既存旧按钮/关闭状态断言失败。
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/crud-sort-field-mapping.test.ts`：一个既存源码字符串断言不符。
- `packages/business/admin-framework/src/framework-commons/shared/__tests__/json-schema-editor-field.test.ts`：一个既存嵌套 JSON 草稿状态断言不符。

本批伙伴、结算布局、作用域参数、OAuth/profile mock 修复后的回归均通过；类型守卫和路由测试元数据修复后，菜单路由/详情面板 60 用例通过；CRUD 列设置、OAuth 登录和个人绑定追加回归三文件 56 用例通过。BPM designer、BPM runtime、Oak 的包级 vue-tsc 均零诊断。Framework HEAD 在生成其自身 dist 后有 296 条类型诊断，当前 241 条；按规范化路径、诊断码和消息比较，无新增诊断。dirty 文件 ESLint HEAD 基线 855 错误，当前 394 错误，无新增错误；未扩展修复历史债务。

验证输出保留于执行机 `/tmp/frontend-release-resume-*`，不进入发布包。先前真实浏览器 AI/业务/超管诊断验收事实见对应功能实现说明；本次发布未声称重新逐项执行所有业务操作。

## 发布结果

标准发布命令以退出码 0 完成，四包均得到明确 `npm publish` 成功：`@levin/admin-framework@6.0.9`、`@levin/bpm-designer@6.0.9`、`@levin/bpm-runtime-ui@6.0.9`、`@levin/oak-base-admin@6.0.10`。上传前四包独立安装及五个公开入口 Vite 生产构建门禁全部通过；发布器清理了 38 个超过 24 小时的历史暂存文件，保留当前批次。目标 Nexus hosted npm 仓库为 `http://nexus.v-ma.com/repository/npm/`，认证复用本地 Maven `dist-repo`，不记录凭据。成功以 npm publish 退出码为准，不进行成功后的私服反查。

## 本批已校验 tarball

|文件|SHA-256|
|---|---|
|levin-admin-framework-6.0.9.tgz|`3778eab27cb989c69861100be6f7498467fb8d5e984bb1c2bbb6c0242b3d3795`|
|levin-bpm-designer-6.0.9.tgz|`10a2692b483a3fc72047d54a1ce5bfdbe29ddf76c76af8af7c76a0a955ff8b97`|
|levin-bpm-runtime-ui-6.0.9.tgz|`846486b734fdb80cb2a70f4321981dc7ae889c327aa2b99df99b67b73e37a089`|
|levin-oak-base-admin-6.0.10.tgz|`79adfd8cbeb98e20e7dc4706cfe4e455d754d827a1ad3eccf06fe8d7facdfbca`|
