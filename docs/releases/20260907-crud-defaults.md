# 2026-09-07 公共 CRUD 默认展示规则发布

## 发布依赖闭包

| 顺序 | 包 | 原版本 | 目标版本 | 原因 |
| --- | --- | --- | --- | --- |
| 1 | @levin/admin-framework | 5.6.85 | 5.6.86 | 页面和设置面板共用默认配置，隔离新增 ID 录入与列表显隐 |
| 2 | @levin/oak-base-admin | 5.6.87 | 5.6.88 | framework peer 精确更新为 5.6.86 |

可发布内部消费者只有 oak-base-admin；私有 bootstrap-app 使用 workspace:*，不发布。其他内部依赖版本不变。发布前私服当前版本确认分别为 5.6.85、5.6.87。

## 变更归属

以下五个文件全部属于 @levin/admin-framework：

- `src/framework-commons/shared/crud-page-display.ts`
- `src/framework-commons/shared/crud-page.vue`
- `src/framework-commons/shared/page-display-settings-drawer.vue`
- `src/framework-commons/shared/types.ts`
- `src/framework-commons/shared/__tests__/crud-page-display.test.ts`

两包的 `package.json` 随版本及依赖元数据同步；工程级 `package-versions.json` 与本记录不属于 npm 包源码。无删除文件。不包含本地 `admin-bootstrap/`、`npm-packages/` 或构建产物提交。

## 行为

没有服务端 UI 设置时，页面运行与设置面板使用同一套公共默认配置；缺失项补齐默认值，显式隐藏和 false 保留。showIdOnCreate 仅用于新增 ID 输入，列表 ID 默认隐藏并遵循显式页面展示配置。本次不修改下游项目业务列配置，也不涉及后端授权规则或数据库迁移。

## 执行证据

- 定向 80 项测试和 bootstrap-app 类型检查通过。
- 真实页面验证：国家列表没有 ID 列，新增国家表单有国家码输入。
- 五个源文件 ESLint 错误数与 HEAD 基线一致（24 / 12 / 59 / 200 / 38）；已修本次新增格式问题，全仓既有 Lint 问题未清理，不声称全仓 Lint 通过。
- 两包构建、页面元数据、路由产物、本地及远端 tarball 依赖协议、模块规范、非 workspace 独立安装门禁通过。
- 最终隔离快照执行 npm pack --dry-run --json：framework 917 文件，9 个具体路径（含本批全部 5 个源文件）核验通过；oak 1058 文件，4 个规范及元数据路径核验通过。
- 主工作区存在其他任务组织上下文并发改动，本次以 HEAD + 本批 5 源文件及版本建立隔离快照，通过原标准发布器发布；未纳入其他任务代码。远端 5 个源文件逐字节等于隔离快照，三个组织上下文源文件逐字节等于 HEAD，新增组织上下文文档不在包内。
- 发布命令：`NPM_REGISTRY=http://nexus.v-ma.com/repository/npm/ NPM_AUTH_FROM_MAVEN=true MAVEN_SERVER_ID=dist-repo pnpm run publish:admin-modules`。
- 私服精确反查：framework 5.6.86，oak 5.6.88；oak framework peer 为 5.6.86。
- framework 完整性：`sha512-s0SY2S4BeDAboC2gyKwRTk71VAE5Wdk7wsWASzBR/qYdyUuVr5CQJ6k/Vgr+oYv/XpguMuknprOJVZukvA2QAg==`。
- oak 完整性：`sha512-y4SpcZnVhbZHYDk6jee+X3keP3vi/9uUx17QtgIB8hDc+t2jWHNmVZaowB9U3uwdcunPf0d4wcXqQ6DZbEDXpA==`。
