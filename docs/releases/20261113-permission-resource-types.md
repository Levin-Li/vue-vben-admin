# 2026-11-13 前端权限资源类型发布记录

## 候选与版本

本批修改属于 `@levin/admin-framework` 和 `@levin/oak-base-admin`；标准发布器按精确内部依赖把 `@levin/bpm-designer`、`@levin/bpm-runtime-ui` 纳入消费者闭包。上传版本依次为 `admin-framework 6.0.30`、`bpm-designer 6.0.30`、`bpm-runtime-ui 6.0.30`、`oak-base-admin 6.0.39`，其余包版本不变。目标仓库为 `http://nexus.v-ma.com/repository/npm/`。

## 制品与验证

四包均通过标准发布器的构建、真实 tarball 文件清单、内部精确 peer 版本、包内 `AGENTS.md`、README 和二次开发规范检查，以及独立消费者门禁；同批 tarball 上传成功。抽查实际 tarball：`admin-framework` 包含三个修正后的公共 API 服务，`oak-base-admin` 包含六个修正后的业务 API 服务；四包均包含包内规则入口和规范，工作流包的 peer 版本与本批上游一致。

发布前权限资源类型检查核对 89 个具有本仓库可解析类级权限的服务；另 5 个无可解析类级权限或本地控制器、10 个未使用 `@Service` 元数据的文件没有被误判为实体资源。定向 Vitest 57 项、前端类型检查、包版本、页面清单和 CRUD 布局检查通过；发布器额外通过 894 个接口的静态字段契约核对和 13 项契约测试。改动文件的 ESLint 错误数与改动前相同，均为 30，新检查脚本单独通过 ESLint。

## 未覆盖范围

当前没有运行中的本项目管理后台或后端服务，未做真实账号的页面和按钮权限验收。本批只发布 npm 包，不部署应用，也不更改数据库权限数据。
