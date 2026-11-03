# 2026-11-03 公共导出 XLSX 格式修复发布记录

## 发布范围

此前公共 CRUD 下载的 `.xls` 实际是 SpreadsheetML XML，用户在 macOS Numbers 无法打开。`@levin/admin-framework` 改为无新依赖的真实 OOXML `.xlsx`；历史 XML `.xls` 导入仍可用，含逗号的 XML 单元格不再误判为 CSV。后端 API 与数据库没有变化，本次不发布 Maven 构件。需求与边界见[OpenSpec](../../../../openspec/changes/c20261103-1523-crud-export-xlsx-format/proposal.md)。

| npm 包 | 旧版本 | 本次版本 | 原因 |
| --- | --- | --- | --- |
| `@levin/admin-framework` | `6.0.22` | `6.0.23` | 公共 XLSX 导出与旧 XML 导入兼容修复 |
| `@levin/bpm-designer` | `6.0.22` | `6.0.23` | 精确依赖公共框架版本更新 |
| `@levin/bpm-runtime-ui` | `6.0.22` | `6.0.23` | 精确依赖公共框架和设计器版本更新 |
| `@levin/oak-base-admin` | `6.0.26` | `6.0.27` | 精确依赖公共框架版本更新 |

## 验证与上传

导出、导入与公共页面定向测试合计 74 项通过；`@levin/admin-framework` 构建、前端文档同步与 OpenSpec 校验通过。真实浏览器下载样本为标准 XLSX MIME、ZIP 文件头与五个必要 OOXML 部件，ZIP CRC 和 XML 解析通过；工作表为表头加三行，编号前导零、中文、特殊字符和公式样式文本均原样保留。在 macOS Numbers **实际打开成功**，表格可见且没有格式警告。具体证据见[实施记录](../../../../openspec/changes/c20261103-1523-crud-export-xlsx-format/implementation.md)。

从独立前端仓库根目录执行标准 `publish:packages`，四包的同批 tarball 均通过精确版本、导出目标、文档文件与独立消费者安装／构建门禁，四次 `npm publish` 均成功。成功后没有重复下载或查询私服构件。

## 升级边界

使用公共导出的其它子系统需将 `@levin/admin-framework` 升级到 `6.0.23`，并同步其精确依赖要求；在原页面再打开新导出的 `.xlsx` 核对。原问题子系统不在本工作区，本次未直接复测。浏览器端使用 ZIP STORE 不压缩，超大导出文件可能较大；仍受既有 50,000 条限制。本机没有 Microsoft Excel，验收针对用户指出的 macOS Numbers、标准 ZIP/XML 与现有导入器回读。
