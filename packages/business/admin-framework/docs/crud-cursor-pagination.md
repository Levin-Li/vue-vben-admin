# 标准 CRUD 游标列表接入指南

专用列表可直接使用公开 `CrudPage`，复用查询、列设置、刷新、全屏、主题及页面展示设置。只在服务端提供真实游标分页时显式配置 `paginationMode: 'cursor'`。未配置时保持原 `pageIndex/pageSize/totals` 总数分页。

```ts
const config: CrudPageConfig = {
  title: '业务实例',
  apiBase: '/BusinessInstance',
  paginationMode: 'cursor',
  defaultQuery: { pageSize: 20 },
  initialQuery: { status: 'Running' },
  allowCreate: false,
  allowEdit: false,
  allowDelete: false,
  allowRetrieve: false,
  allowExport: false,
  dataAttrTargets: {
    list: { method: 'GET', path: '/actual/instance/query' },
  },
  apiService: {
    // 适配器必须只投影真实接口支持的字段，并沿用实际接口的权限声明。
    list: ({ size, cursor, status }) => instanceApi.list({ size, cursor, status }),
  },
  fields: [{ key: 'status', label: '执行状态', search: true, table: true }],
};
```

上述路径、方法及字段仅是示例，应依据实际控制器填写。组件通过 `@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue` 引入，配置类型通过同目录公开 `types` 入口引入。实际列表须返回 `{ items, hasMore, nextCursor }`；`nextCursor` 为服务端签发的不透明字符串。请求在属性策略校验前转换成 `size` 与可选 `cursor`，不发送 `pageIndex/pageSize`。每次查询的 `size` 固定取 `defaultQuery.pageSize`（缺省 10）；不展示每页大小切换或任意页跳转，不伪造总数。

`initialQuery` 只初始化可清空的查询模型，重置时恢复它，然后应用页面展示设置的默认值。它不参与隐藏固定条件合并。`defaultQuery` 仍用于始终生效的默认参数，不应放入需要让用户清空的初始筛选值。游标模式或显式 `initialQuery` 模式下，重置只恢复条件，不发送请求；点击查询后从首页重新读取。

分页显示“上一页 / 第 N 页 · 本页 X 条 / 下一页”。只有 `hasMore === true` 且服务端给出有效的新游标时才能前进；上一页复用已经取得的游标。筛选、范围或排序条件变化自动回首游标，多列表标签分别保存状态。宿主如更换范围但模型未改变，应重新查询或重建组件；不要把权限上下文隐藏在适配器闭包中而复用旧游标。

`ref.reload()` 刷新当前游标，可用于专用业务动作成功后刷新。`#emptyText` 可提供实际业务空态；接口错误会清除旧列表，并由标准错误提示展示真实原因。较早请求和卸载后的响应不会覆盖新列表。授权、属性策略和后端数据范围仍照常执行；`dataAttrTargets.list` 必须写真实方法与路径，不能以适配器别名推断。

游标模式自动隐藏全量导出工具，推荐同时显式 `allowExport: false` 说明该接口不提供可验证的完整导出；刷新、列设置及全屏等工具继续可用。普通分页也可用 `allowExport: false` 关闭导出。专用详情通过行操作与单元格插槽接入，不需要另写查询表格。

最小验证：检查首个请求只有真实的分页参数；前进、后退、改变筛选及切换列表，确认游标无串用；缺失下一游标、接口异常、快速连续查询和卸载都不能恢复旧数据；普通分页仍显示真实总数。服务端必须独立校验身份、授权范围和游标。
