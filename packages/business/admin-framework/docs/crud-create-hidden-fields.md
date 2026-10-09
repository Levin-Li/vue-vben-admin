# CRUD 新增时提交页面生成的隐藏字段

`CrudPageConfig` 的 `createSubmitKeys` 用于新增请求需要某个由页面生成、但不提供人工输入控件的字段。通用 CRUD 默认会在最终提交时删除所有不参与表单的字段；只有这里列出的字段可以在**新增**时由 `transformSubmit` 补入。编辑请求仍按原字段白名单处理。

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

最小验证：选择供应商创建一条默认停用的设置，确认请求体包含且只包含所选供应商的初始 `value` 键；再尝试补入未列入 `createSubmitKeys` 的隐藏字段，确认最终请求不会携带它。编辑旧记录时确认不可变供应商编码不进入更新请求。
