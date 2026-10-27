# 2026-10-27 管理前端全部交付变更发布记录

## 候选与验证

本批候选为 `@levin/admin-framework`、`@levin/oak-base-admin`，以及其精确内部依赖消费者 `@levin/bpm-designer`、`@levin/bpm-runtime-ui`。发布器预览版本依次为 `6.0.19`、`6.0.21`、`6.0.19`、`6.0.19`；最终以上传命令的实际结果为准。

全量 Vitest 为 3208 通过、14 跳过、0 失败；工作区类型检查、管理页面清单、CRUD 布局、API 资源类型、路由过渡、聚合包导入、规则文档同步和静态字段契约检查通过。浏览器对真实 MP4 的本地选择与远程 URL 均完成读写验收；[MP4 JSON 元数据使用指南](../../packages/business/admin-framework/docs/mp4-json-metadata.md)包含调用示例、CORS、Range 和返回新 Blob 的边界。

## 上传结果

标准 `publish:packages` 在上传前已经生成并校验四份真实 tarball。`@levin/admin-framework@6.0.19` 包含 MP4 工具的 `dist`、类型声明、源码、使用指南、AGENTS、README 和模块开发规范；`@levin/oak-base-admin@6.0.21` 的源码与 `dist` 都包含静态字段契约，源码 JSON 与 tarball 中的 6,342,531 字节完全一致。BPM 两包及 Oak 对 framework 的 peer 均为精确 `6.0.19`；四包未混入发布过程、迁移或安全审计资料。

独立消费者安装与构建通过后，标准发布器按依赖顺序上传四份已验证 tarball，命令零退出码；`@levin/admin-framework@6.0.19`、`@levin/bpm-designer@6.0.19`、`@levin/bpm-runtime-ui@6.0.19`、`@levin/oak-base-admin@6.0.21` 均报告“发布成功”，最终报告“本批发布完成：4 个包”。成功后未重复查询或下载私服制品。

本批不重启或部署应用，也不执行后端数据库迁移。构建/测试缓存与临时 tarball 不纳入源码提交。全仓 `lint` 仍有旧样式错误，本次新增工具与修复文件已做定向检查。

## 2026-10-27 后续增量发布

本轮将邀请链接的到期字段改为可清空日期，供应及渠道伙伴类型以中文显示并保留原枚举值，五种邀请动作显示具体标题；同时交付当前工作树的公共 CRUD、数据权限、动态模型和客服邮箱设置页面改动。工作区 `pnpm run check:type` 通过；邀请页面 8/8 项定向 Vitest 和相关配置测试的 ESLint 通过。

发布器首次预检发现静态字段契约与后端新增接口不一致，上传前中止；正式重新导出后契约包含 862 个接口，一致性检查及浏览器侧测试通过。随后四份 tarball 的资源、文档、精确内部依赖及独立消费者安装构建均通过。标准 `publish:packages` 命令零退出码并报告“本批发布完成：4 个包”：`@levin/admin-framework@6.0.20`、`@levin/bpm-designer@6.0.20`、`@levin/bpm-runtime-ui@6.0.20`、`@levin/oak-base-admin@6.0.22`。未重复反查 npm 私服；临时 tarball 不纳入源码提交。
