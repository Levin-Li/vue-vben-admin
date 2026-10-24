# JSON Schema 编辑器属性引用使用指南

## 入口与前置条件

实体文本字段或 JSON 字段标注 `@JsonSchemaEditor(jsonSchema = ":xxx")`。文本字段使用 `@JdbcTypeCode(SqlTypes.LONGVARCHAR)`，JSON 字段使用 `@JdbcTypeCode(SqlTypes.JSON)`。开发公共 CRUD 页面时，开发者查看后端注解，将 `jsonSchemaEditor: true` 与 `jsonSchema: ':xxx'` 写入静态字段配置。页面运行时不扫描 Java 注解，只根据字段配置解析当前记录的 Schema 来源。

## 取值顺序

1. 读取当前记录中与目标字段同层的自有 `xxx` 属性。值可以是 `class:` Java 类型、`url:` 地址或内联 JSON Schema。
2. 同层值缺失、为空或无效时，读取目标字段 JSON 对象内容中的自有 `xxx` 属性。目标字段为 JSON 文本时，先将文本解析为 JSON 对象。
3. 两处均无有效来源时显示普通 JSON 编辑器。显式 `:xxx` 引用优先于字段内容中的通用 `@JsonSchema` / `JsonSchema` 元数据。

`xxx` 只能是安全的单层属性名；不支持 `:a.b`、方法调用或表达式。Schema 加载失败时，结构化编辑器不得提交未通过校验的数据。

## 示例

```java
@JdbcTypeCode(SqlTypes.JSON)
@JsonSchemaEditor(jsonSchema = ":configEditor")
JSONObject configData;
```

```ts
{
  key: 'configData',
  type: 'json',
  jsonSchemaEditor: true,
  jsonSchema: ':configEditor',
}
```

记录的 `configEditor` 可直接提供 Schema 来源；若不存在，则 `configData.configEditor` 可提供来源。字段和记录的可编辑性、更新接口权限仍由页面与服务端原有规则决定。

## 最小验证

分别用同层 `configEditor`、仅 `configData.configEditor` 和两处均缺失的记录打开编辑操作，确认前两者渲染对应结构化表单，最后一者显示普通 JSON 编辑器；保存后核对目标字段的 JSON 结构和原有权限约束。
