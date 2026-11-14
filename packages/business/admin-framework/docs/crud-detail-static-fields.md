# 标准 CRUD 详情字段使用指南

## 适用范围与入口

适用于使用公共 `DynamicCrudPage` 的标准 `retrieve` 详情。页面在本地 `config.ts` 声明字段；后端详情接口的响应类型、序列化字段和 `@Schema.title` 是开发期核对依据。打开列表的“详情”按钮即可查看结果；调用者仍须具备对应接口及字段权限。

## 配置方法

逐项检查 `retrieve` 响应模型：需要显示的字段在 `fields` 中写中文 `label`，不应显示的字段写 `detail: false`。只属于详情响应的字段使用 `detailExtraFields`，不会加入新增、编辑、查询或列表；同名项仅覆盖详情属性，原字段的类型、选项和布局仍保留。`detailFields` 仍用于完整替换详情字段契约，`detailExtraFields` 可在其上补充或覆盖。

字段业务顺序在页面开发期确定：组间需要独立于字段数组顺序时，在同组字段上写一致的 `layoutGroupOrder`；组内写 `layoutOrder`，未分组字段也可写显式 `layoutOrder`。标准详情按静态声明排序而不依赖接口 JSON 属性顺序；用户已保存的详情顺序仍优先。查询默认顺序独立使用 `searchOrder`，不套用表单分组顺序。

```ts
const config: CrudPageConfig = {
  apiBase: '/Example',
  fields: [{ key: 'name', label: '名称' }],
  detailExtraFields: [
    { key: 'creator', label: '创建者' },
    { key: 'internalHash', label: '内部校验值', detail: false },
  ],
};
```

在仓库前端根目录运行 `pnpm run check:crud-detail-field-contract`。检查器用页面静态配置与后端控制器的 `retrieve` 响应模型对照；漏配、英文键标题和不能可靠核对的新增页面会使门禁失败。确实由运行时数据模型构造的页面必须在检查器中保留可审查的边界说明；不能将普通静态页面静默跳过。

## 结果与边界

内置详情只展示静态声明且通过当前权限、用户展示设置和空值规则的字段。接口额外返回未声明属性时，详情不显示原始英文键；开发环境只对页面和字段名输出一次警告，不记录字段值。自定义操作的通用结果展示仍遵循原有结果契约。页面配置与后端响应不一致时应在开发期修正，不在运行时请求 OpenAPI 或从英文键推测中文含义。

最小验证：为测试响应增加一个未配置字段，检查门禁报告路径和字段；打开标准详情确认该字段不出现、其它中文标题和保存的展示设置正常。补充中文 `label` 后再次检查并打开详情确认显示；将字段设为 `detail: false` 后确认始终隐藏。
