# 公共 CRUD 导出分页与 XLSX 实现说明

## 模块落点

公共页面组件 `src/framework-commons/shared/dynamic-crud-page.vue` 的 `fetchExportRecords()` 完成导出分页。它调用当前列表的 `apiService.list`；页面设置专用列表路径时，改用 `src/framework-commons/api.ts` 的 `fetchCrudList()`，后者请求 `requireTotals` 并统一列表响应的 `items`、`totals`、`pageIndex` 和 `pageSize`。`src/framework-commons/shared/crud-file-export.ts` 在浏览器中构造真正的 OOXML ZIP 工作簿并以 `.xlsx` 下载，不调用独立的后端导出端点。

## 运行行为

单次导出冻结查询、排序与当前 `ListTable`，用 `pageIndex=1,2,…` 请求 `pageSize=2000`。每页完成字段组输出裁剪与权限快照检查；有效总数已取足或遇到空页才结束。后端实际返回较短页时仍继续，避免裁剪页大小造成首批漏页；相邻页稳定 ID 相同则抛出分页未推进错误，不下载文件。导出确认前检查总数是否超过 50,000，读取时也检查累计记录数，覆盖总数缺失或变化。

字段弹窗按当前列显示和顺序组织，允许选择、重排及标题别名；单元格优先使用列表展示值。成功下载后刷新当前列表，刷新失败只提示列表刷新问题，不否定已下载文件。导入由同一页面的 `handleImportConfirm()` 按 `batchCreate` 权限分批提交，未因本次分页修复改变。

文件构造器写入工作簿、工作表、内容类型与关系部件，并为 ZIP STORE 成员写入实际 CRC32；单元格统一使用 OOXML 内联字符串，XML 特殊字符与非法字符在写入前处理。文件名以 `.xlsx` 结束，MIME 为 Open XML 电子表格类型。公共导入器通过 ZIP 分支读取新文件；历史 XML `.xls` 通过内容签名继续解析，优先于逗号 CSV 猜测。

## 最小验证与限制

为列表适配器提供三页数据：请求 2000、服务端实际每页 100、总数 250，文件应有 250 条数据。再分别验证无有效总数读到空页、重复页报错、超过 50,000 条拒绝、分页时查询和排序不随界面草稿变化。真实页面下载 `.xlsx` 后须用 macOS Numbers 实际打开，核对表头、行数和代表性文本；ZIP/OOXML 解析和导入回读是补充证据，不能代替目标应用打开。其它子系统若使用专用导出代码，需检查它是否使用此公共入口。

面向使用者的步骤见[使用指南](公共CRUD导入导出使用指南.md)，二次开发边界见[开发指南](公共CRUD导出开发指南.md)。
