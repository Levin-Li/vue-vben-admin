# 2026-11-13 我的设置列表恢复发布

## 候选与版本

相对 2026-11-12 已发布的七包基线，唯一新增交付内容属于 `@levin/oak-base-admin`：设置列表对可识别的暂时性读取失败只重试一次，最终失败显示安全的公开错误提示；包内指南同步说明该行为。其余六个已发布包及两个未变化的基础包保持原版本，不重复发布。标准发布器的计划为 Oak `6.0.36 → 6.0.37`。

首次标准发布已把 `6.0.37` 上传至 `http://nexus.v-ma.com/repository/npm/`。发布后本地核对发现构建脚本覆盖了 Oak 包 `AGENTS.md` 中的用户个性化设置指南链接。已修正生成源并将最终版本升至 `6.0.38`；`6.0.37` 不覆盖、不作为最终推荐版本。

## 验证与制品

- 设置列表定向 Vitest 10 项通过；`vue-tsc`、改动文件定向 ESLint、包版本、API 资源类型、页面清单及 CRUD 布局检查通过。
- 标准发布器对 `6.0.38` 完成静态字段契约 13 项、包构建、真实 tarball 的路由资源、内部精确版本、`dist` 入口、包内文档和独立消费者门禁。上传同一份已校验 tarball，命令零退出并报告 `@levin/oak-base-admin@6.0.38 发布成功`。
- 目标包精确清单包含 `AGENTS.md`、`README.md`、`docs/MODULE-DEVELOPMENT-STANDARD.md`、`docs/用户个性化设置使用指南.md`、`src/modules/com_levin_oak_base/views/setting-for-tenant/index.vue`、`src/modules/com_levin_oak_base/views/setting-for-tenant/load-setting-list.ts`、`dist/modules/com_levin_oak_base/views/setting-for-tenant/index.vue` 和 `dist/modules/com_levin_oak_base/views/setting-for-tenant/load-setting-list.mjs`。最终上传 tarball 内的 `AGENTS.md` 明确链接该指南，指南文件在同一 tarball 中。Oak 的内部 peer 版本保持 admin-framework `6.0.29`、common-ui/runtime `6.0.8`，其它包没有升版。

## 未覆盖范围

当前没有运行中的本项目后端和管理后台服务，本次未做真实浏览器页面恢复或线上故障重放；截图当时的失败响应也未保存。发布包上传不等于应用部署。此批不执行数据库迁移，也不触碰根仓库中未完成的访问日志验收任务和本机未跟踪的 tarball、代理配置文件。
