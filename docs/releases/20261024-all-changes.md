# 2026-10-24 管理前端全部可交付变更发布记录

## 包范围

前端独立仓库的按需发布器根据实际包文件及精确内部依赖计算七个候选，并使用同一批次 tarball 发布。`@vben-core/foundation` 与 `@vben-core/ui` 未变化，不重发。

| 包 | 原版本 | 已发布版本 |
| --- | --- | --- |
| `@vben/runtime` | 6.0.2 | 6.0.3 |
| `@vben/common-ui` | 6.0.2 | 6.0.3 |
| `@vben/layouts` | 6.0.2 | 6.0.3 |
| `@levin/admin-framework` | 6.0.10 | 6.0.11 |
| `@levin/bpm-designer` | 6.0.10 | 6.0.11 |
| `@levin/bpm-runtime-ui` | 6.0.10 | 6.0.11 |
| `@levin/oak-base-admin` | 6.0.12 | 6.0.13 |

## 验证与上传

`pnpm run test:unit` 完整运行：464 个测试文件通过、2 个按环境条件跳过；3,077 项测试通过、14 项跳过。`pnpm run check:type`、页面清单、CRUD 布局、API 资源类型、版本元数据和随包文档检查通过。管理端真实浏览器已连续验证用户权限组 9 页及其它 6 组的 13 页，未再出现内部字段策略提示；发布后按同一源码重跑组织、用户、角色列表及新增表单和跨组导航，4 项 Playwright 用例通过。

正式命令使用 `NPM_REGISTRY=http://nexus.v-ma.com/repository/npm/ NPM_AUTH_FROM_MAVEN=true MAVEN_SERVER_ID=dist-repo pnpm run publish:packages`。首次在上传前发现两个页面缺失发布元数据，补齐后重试；发布器对七包逐个构建并核对真实 tarball 的页面资源、源码、设计与规范文档、精确内部版本，再完成工作区外独立消费者安装与生产构建。命令零退出，七包分别报告“发布成功”，最终报告“本批发布完成：7 个包”。成功上传后没有再次回查或重建私服制品。

本次未发布入口应用、未执行数据库迁移或生产服务重启。前端 Git 提交仅包含源码、规则、测试、文档及版本元数据，不包含 `npm-packages/.publish-tarballs/` 的临时制品。下游安装前须核对后端 `6.0.0-SNAPSHOT` 构件和目标数据库的迁移前置条件。
