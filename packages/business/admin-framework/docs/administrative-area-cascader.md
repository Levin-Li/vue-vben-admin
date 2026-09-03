# 区域选择器组件使用说明

`AdministrativeAreaCascader` 用于选择中国省、市、区县行政区划编码。它提供两种使用方式：独立 Vue 组件，以及 CRUD 页面配置中的 `area-cascader` 字段。

组件从 `@levin/admin-framework` 根入口导入；业务页面不直接依赖组件内部文件。

```ts
import { AdministrativeAreaCascader } from '@levin/admin-framework';
```

## 选择层级

页面开发时，先查看实体、请求对象或嵌套 VO 上的 `@Schema.title` 和 `@Schema.description`，再在页面源码中静态配置 `selectableLevels`。组件不会在运行时读取后端注解或根据字段名推断层级。

| 字段语义 | 静态配置 |
| --- | --- |
| 省编码、省级行政编码 | `['province']` |
| 城市编码、市级行政编码 | `['city']` |
| 区县编码、区县行政编码 | `['district']` |
| 同时提交省、市、区县的完整地址 | `['district']` |

直辖市在行政区划树中没有单独的市级节点。城市编码字段配置为 `['city']` 时，组件会把对应的直辖市节点作为可选城市。

## 未指定层级时的默认规则

未传入 `selectableLevels` 时，组件按已有编码判断当前层级；空值默认只能选择区县。

| 编码 | 识别层级 |
| --- | --- |
| `33` | 省 |
| `3301` | 市 |
| `330000` | 省 |
| `330100` | 市 |
| `330106` | 区县 |

六码编码的尾码优先级为：后缀 `0000` 是省，后缀 `00` 是市，其余六码才是区县。补齐格式不会改变该层级判断。

## 六码补全

`normalizeToSixDigits` 默认是 `true`：保存或提交时会把 2 位省编码、4 位市编码补齐为 6 位。补全不参与层级判断、可选节点过滤或回显路径解析。

| 输入 | 默认提交值 | 层级 |
| --- | --- | --- |
| `33` | `330000` | 省 |
| `3301` | `330100` | 市 |
| `330106` | `330106` | 区县 |

确实需要保留短码时，页面显式设置 `normalizeToSixDigits: false`。这只影响保存格式，不影响层级。

## 独立组件

### 单个城市编码

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { AdministrativeAreaCascader } from '@levin/admin-framework';

const cityCode = ref('');
</script>

<template>
  <AdministrativeAreaCascader
    v-model="cityCode"
    :selectable-levels="['city']"
    placeholder="请选择城市"
  />
</template>
```

### 可选的开通区域过滤

传入任意 `domain`、`bizCategory` 或 `bizType` 后，组件会在展开时调用当前开通区域接口，只显示允许的区域；未传这些上下文时只使用本地行政区划数据。

```vue
<AdministrativeAreaCascader
  v-model="districtCode"
  biz-category="订单"
  biz-type="发货"
  domain="portal.example.com"
  :selectable-levels="['district']"
/>
```

## CRUD 页面配置

### 单字段编码

`valueKey` 必须是后端实际接收的字段名。

```ts
{
  key: 'cityCode',
  label: '城市编码',
  type: 'area-cascader',
  areaCascader: {
    selectableLevels: ['city'],
    valueKey: 'cityCode',
  },
}
```

### 完整地址

一个选择器回填省、市、区县时，限制最终选择到区县，避免只提交省或市造成地址不完整。

```ts
{
  key: 'provinceCode',
  label: '省市区行政编码',
  type: 'area-cascader',
  required: true,
  areaCascader: {
    provinceCodeKey: 'provinceCode',
    cityCodeKey: 'cityCode',
    districtCodeKey: 'districtCode',
    selectableLevels: ['district'],
  },
}
```

### 保留短码的例外

```ts
{
  key: 'legacyProvinceCode',
  label: '历史省编码',
  type: 'area-cascader',
  areaCascader: {
    normalizeToSixDigits: false,
    selectableLevels: ['province'],
    valueKey: 'legacyProvinceCode',
  },
}
```

## 参数速查

| 参数 | 使用位置 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `selectableLevels` | 独立组件、`areaCascader` | 未指定时按已有编码；空值为区县 | 允许最终选择的 `province`、`city`、`district` 层级。 |
| `normalizeToSixDigits` | 独立组件、`areaCascader` | `true` | 保存/提交时是否将 2 位、4 位编码补齐为六码。 |
| `valueKey` | `areaCascader` | 空 | 单字段编码的实际提交字段名。 |
| `provinceCodeKey` / `cityCodeKey` / `districtCodeKey` | `areaCascader` | 对应标准字段名 | 完整地址模式的回填字段名。 |
| `openAreaContext` | `areaCascader` | 无 | CRUD 中的开通区域过滤上下文，可填写 `domain`、`bizCategory`、`bizType` 或根据表单状态动态返回。 |
| `domain` / `bizCategory` / `bizType` | 独立组件 | 无 | 独立组件的开通区域过滤上下文。 |

## 注意事项

- 明确的字段语义必须在页面配置中写死，不能交给公共运行时猜测。
- 只有缺少省、市、区县语义时，才使用“已有编码判定、空值默认区县”的兜底规则。
- 层级判定先于保存格式：省、市短码补为六码后仍是省、市，不能因为长度变为六码就认定为区县。
- 历史数据可能含无法在本地行政区划树中识别的编码；组件会保留该值供回显，页面应按业务决定是否另行治理历史数据。
