# 2026-11-03 管理前端增量发布记录

## 候选与版本

标准按需发布器识别四个候选，并同步精确内部 peer 版本：

| 包 | 旧版本 | 本次版本 | 原因 |
| --- | --- | --- | --- |
| `@levin/admin-framework` | `6.0.21` | `6.0.22` | 公共 CRUD 导出分页修复 |
| `@levin/bpm-designer` | `6.0.21` | `6.0.22` | 精确依赖公共框架版本更新 |
| `@levin/bpm-runtime-ui` | `6.0.21` | `6.0.22` | 精确依赖公共框架及设计器版本更新 |
| `@levin/oak-base-admin` | `6.0.25` | `6.0.26` | 客户与伙伴快捷添加、静态字段契约及公共框架 peer 更新 |

## 验证与上传

1. 公共导出先用裁剪页大小、未知总数、重复首页三个回归证实旧实现漏页或误导，修复后定向测试文件 57 项通过。隔离本地页面中，组织机构 11 条和数据字典 42 条分别导出 11／42 条数据；地址页单行虚构 CSV 导入成功，列表从 0 刷新为 1，PostgreSQL 按 ID 查到三个映射字段。详见[OpenSpec 需求与任务](../../../../openspec/changes/c20261103-1447-crud-export-all-pages/proposal.md)。
2. Oak 快捷添加在隔离本地前后端完成个体户客户、复用主体的供应伙伴、法人事业单位渠道伙伴三条成功路径及重复／类型不一致两条拒绝路径；页面、接口与数据库逐步核验见[后端实施记录](../../../../openspec/changes/c20261103-1306-quick-partner-onboarding/implementation.md)。
3. 发布前四包各自产生一次真实 tarball，并逐文件核对版本、内部依赖、`dist` 导出、源码、包内 Agent/README、四类功能文档及 `MODULE-DEVELOPMENT-STANDARD.md`。全部通过独立消费者 tarball 安装与公开入口构建门禁。
4. 从 `frontend/admin` 根目录执行 `NPM_REGISTRY=http://nexus.v-ma.com/repository/npm/ NPM_AUTH_FROM_MAVEN=true MAVEN_SERVER_ID=dist-repo pnpm run publish:packages`。四包 `npm publish` 均成功；未在成功后重复私服反查或重传。

## 边界

本次修复的是共享 CRUD 导出。用户反馈出现在其它子系统，尚未取得该子系统页面或后端分页契约，需由其升级到 `@levin/admin-framework@6.0.22` 后在原场景复测；本地 Org/Dict 未复现漏页，但裁剪响应回归测试已覆盖关键条件。隔离测试库的工商查询供应商未配置真实凭据，Oak 快捷添加走人工补录。`npm-packages/.publish-tarballs/`、截图和临时导入 CSV 不纳入代码提交或发布包。
