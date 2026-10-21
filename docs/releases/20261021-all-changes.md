# 2026-10-21 管理前端全部变更发布记录

## 发布范围

按用户确认发布独立前端仓库当前所有可交付变更。`pnpm run plan:packages` 从实际包文件及精确内部依赖计算七个候选；`@vben-core/foundation` 与 `@vben-core/ui` 没有本批运行时交付变化，保持原版本。

| 包 | 旧版本 | 已发布版本 |
| --- | --- | --- |
| `@vben/runtime` | 6.0.1 | 6.0.2 |
| `@vben/common-ui` | 6.0.1 | 6.0.2 |
| `@vben/layouts` | 6.0.1 | 6.0.2 |
| `@levin/admin-framework` | 6.0.9 | 6.0.10 |
| `@levin/bpm-designer` | 6.0.9 | 6.0.10 |
| `@levin/bpm-runtime-ui` | 6.0.9 | 6.0.10 |
| `@levin/oak-base-admin` | 6.0.11 | 6.0.12 |

## 验证与上传

`pnpm run check:type`、`pnpm run check:frontend-rules`、版本与内部依赖检查通过。结算页只提交 ID 的财务读取、管理页外部组织归属及权限元数据、公共 CRUD 的嵌套 JSON 草稿与页面展示设置等定向回归通过。Vitest 完整集合分两次稳定退出：除发布产物门禁外的 421 个文件 2,764 项通过、14 项按环境门禁跳过；发布产物门禁文件 18 项通过，仍真实安装 tarball 并执行独立 Vite 生产构建。此前单次全量运行的 worker RPC 超时属于同步长耗时测试阻塞，已改为异步子进程，不缩减检查。

正式命令使用 `NPM_REGISTRY=http://nexus.v-ma.com/repository/npm/ NPM_AUTH_FROM_MAVEN=true MAVEN_SERVER_ID=dist-repo pnpm run publish:packages`。发布器先准备版本和内部依赖，再按依赖顺序构建七包；逐个核对实际 tarball 的公开入口、内部版本、页面资源、README、AGENTS 和设计/实现/使用文档，接着验证工作区外消费者安装与生产构建。命令零退出，七包分别报告“发布成功”。本批成功后仅按发布器规则清理超过 24 小时的暂存文件，未删除历史 npm 制品。

本次未发布最终入口应用或执行后端数据库迁移；下游使用前须核对相应后端 `6.0.0-SNAPSHOT` 构件和目标库迁移前置条件。前端源码与包版本元数据在独立 Git 仓库提交、推送，不与后端仓库混合。
