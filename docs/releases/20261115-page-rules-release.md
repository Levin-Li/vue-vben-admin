# 2026-11-15 前端页面开发规则发布

本次交付页面五视图租户与组织字段核对规则、查询与内容型表单规则优先级及后续冲突修正。页面规则、查询规则、表单运行时规则、模块规则、三段式排序规范及相关页面规范随发布包的 `docs/project-reference/frontend/admin/` 交付，项目参考资料索引可发现。`project-reference` 为发布方参考资料，下游适用规则应结合自身项目规范。

规则文件为前端工程根目录的共享文档，通过同步脚本进入 `@levin/admin-framework` 和 `@levin/oak-base-admin`；框架精确依赖发生变化，因此 BPM 两个消费者也纳入候选。候选及实际发布版本：`@levin/admin-framework@6.0.34`、`@levin/bpm-designer@6.0.34`、`@levin/bpm-runtime-ui@6.0.34`、`@levin/oak-base-admin@6.0.43`。

标准发布器对四包构建、核对 tarball、内部精确依赖与独立消费者后，上传至 Nexus hosted npm 仓库，命令零退出并报告四包成功。上传前检查框架实际 tarball 包含页面、查询、运行时和三段式规则正文；框架与 Oak 的 1107 份项目参考文件通过逐项内容校验。同步脚本回归 13 项通过，OpenSpec 严格校验通过。日志位于 `/tmp/levin-page-rules-publish-final.log`。

首次尝试在上传前发现同步白名单遗漏“开发规则”文件，主动中止并修复；该次没有上传。此批只交付规则和发布同步修复，不包含页面运行时代码或数据库变更。
