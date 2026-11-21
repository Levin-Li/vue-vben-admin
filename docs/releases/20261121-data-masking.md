# 2026-11-21 数据脱敏配置发布

本批仅发布 `@levin/oak-base-admin@6.0.47`；数据脱敏字段按两列显示，单个字段配置保持一行，可还原 ID 默认绑定当前登录会话且不设置独立到期时间，已登记图片及复杂对象在目录中不可选。其他工作区改动不在本批范围内。

候选包由隔离快照和标准发布器确定；实际上传 tarball 的版本、内部依赖及随包文档校验通过。上传前逐项确认包含 `docs/data-masking-setting.md`、`src/modules/com_levin_oak_base/api/data-masking-setting-service.ts`、`src/modules/com_levin_oak_base/views/data-masking-setting/rule-editor.vue`、`rules.ts` 及 `__tests__/rule-editor.test.ts`、`__tests__/rules.test.ts`。独立消费者门禁通过，同一 tarball 上传到 Nexus hosted npm，发布器零退出并报告成功；SHA-1 为 `76ac16b5d1604d3369dcbb4984905a8bcd1873b8`。发布日志 `/tmp/masking-20261121-npm-publish.log`。

前端 20 项测试通过，页面布局、页面清单和 API 资源类型检查通过；约 1100px 容器的隔离浏览器组件验收通过，使用模拟目录，未覆盖此次改动的完整业务页面端到端验收。目标环境部署及历史规则重配置未执行。
