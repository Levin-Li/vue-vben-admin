# 2026-11-25 已完成能力发布

本批已发布公共框架、工单工作台及伙伴归属相关已完成前端变更：@vben/runtime、@vben/common-ui、@vben/layouts 6.0.9；@levin/admin-framework、@levin/bpm-designer、@levin/bpm-runtime-ui 6.0.38；@levin/oak-base-admin 6.0.49。

报表中心仍未完成安全及生产验收，相关 HTTP 入口默认关闭，不能视为生产可用。本批不执行目标环境部署或数据库迁移。

发布前验证：独立快照 pnpm check 通过，类型检查使用缓存；文档同步测试 20 项通过。7 个包的打包、消费者门禁及上传均成功。本批表单调整未进行真实浏览器视觉验收。
