# CRUD 新增时提交页面生成的隐藏字段

`CrudPageConfig` 的 `createSubmitKeys` 用于新增请求需要某个由页面生成、但不提供人工输入控件的字段。通用 CRUD 默认会在最终提交时删除所有不参与表单的字段；只有这里列出的字段可以在**新增**时由 `transformSubmit` 补入。编辑请求仍按原字段白名单处理。

多个专用新增入口共用一个列表时，可在对应 `CrudPageConfig` 中设置 `createFormTitle` 覆盖本次新增弹窗标题；列表标题仍由 `title` 决定，未设置时沿用“新增 + 业务标题”。该文案只改变展示，不替代创建方法、操作权限或提交目标的校验。

例如，一条服务插件设置对应一家供应商，创建请求必须包含初始 `value[供应商编码]`，但不需要在新增表单中显示 JSON 编辑器：

```ts
const config: CrudPageConfig = {
  apiBase: '/ServicePluginSetting',
  createSubmitKeys: ['value'],
  defaultFormValues: { enable: false, value: {} },
  fields: [
    { key: 'servicePluginProviderCode', label: '供应商', form: true },
    { key: 'value', label: '供应商配置', form: false },
  ],
  title: '服务插件设置',
  transformSubmit(values, editingRecord) {
    if (editingRecord) return values;
    const code = String(values.servicePluginProviderCode || '').trim();
    if (!code) throw new Error('请选择供应商');
    return { ...values, value: { [code]: {} } };
  },
};
```

`createSubmitKeys` 必须只列出固定、必需且可由当前页面安全生成的键。它不会授予后端写入权限，也不替代后端对供应商归属、租户范围、JSON 结构和单选互斥的校验。不要用它保留客户端任意附加字段或敏感明文。

## 随表单值显示的字段

互斥字段使用 `CrudFieldConfig.formVisibleWhen(formState)`。条件为假时，公共 CRUD 同时取消该字段的展示、必填校验和提交；条件为真时仍须通过当前操作的字段权限。条件字段不需要页面另写弹窗或用 CSS 隐藏。

```ts
{
  key: 'maxRegistrations',
  label: '人数上限',
  type: 'number',
  required: true,
  formVisibleWhen: (formState) => formState.usageMode === 'Limited',
}
```

若服务端还要求与该分支无关的固定隐藏字段，由页面用 `transformSubmit` 生成，并只将明确的键列入 `createSubmitKeys`；仍需经过服务端属性权限与业务校验。

最小验证：选择供应商创建一条默认停用的设置，确认请求体包含且只包含所选供应商的初始 `value` 键；再尝试补入未列入 `createSubmitKeys` 的隐藏字段，确认最终请求不会携带它。编辑旧记录时确认不可变供应商编码不进入更新请求。
