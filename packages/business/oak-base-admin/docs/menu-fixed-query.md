# 菜单固定查询条件

菜单可以复制后复用同一个目标页面，各自保留固定条件、菜单选中状态和页签。固定字段在查询面板隐藏，查询、刷新、重置后的查询和导出最终覆盖同名参数；写操作不附加条件。这是前端查询行为，不是服务端授权边界。

在菜单编辑中选择目标页面，点击“配置固定查询条件”。未填写 paramsEditor 时优先使用模块注册的 queryConfigLoaders 中该页面的静态查询配置；没有查询配置时使用 JSON 编辑器。有 paramsEditor 时优先使用 class:、url: 或内联 JSON Schema，失败降级 JSON 并保留参数。固定字段须显式勾选，false 和 0 是有效值；地区选择遵守原字段层级限制。

params 的接口与存储契约为 JSON 对象，不是 JSON 字符串。清空条件提交 {}。参数值支持字符串、布尔、数字、null 和这些值的数组。无法识别的参数不会静默丢弃。paramsEditor 是独立文本字段，复制与编辑保留它。

## 升级前置条件

本版本需要同步部署支持 Menu.params: JSONObject、Menu.paramsEditor 的后端。先备份并人工执行根仓库 docs/migrations/20260907-menu-params-json.sql，再切换新后端和前端；禁止依赖启动自动改列。已有非法 JSON 或非对象值会阻断迁移，需人工核对。

后端持久化 Menu 及生成的 MenuInfo 不再实现旧 service-support MenuItem 接口（该接口 getParams 返回 String）。这是 Java 源码/二进制契约变化；下游不要将这两个类型转换为旧 MenuItem，应使用各自的菜单模型。插件注册返回的外部 MenuItem 未改变。

## 自定义模块接入

在 AdminFrontendModule.queryConfigLoaders 中以已注册 viewPath 为键，显式提供返回 CrudPageConfig 的异步加载器。复用页面自己维护的查询字段和选项，不从后端元数据动态生成页面。自定义列表页面需自行接入公共 fixedQuery 合并能力，否则只能编辑参数，不能宣称请求已应用参数。
