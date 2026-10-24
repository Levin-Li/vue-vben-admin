# 专用业务列表复用标准 CRUD 布局

`CrudLayout` 用于确实需要专用交互、无法直接使用标准 `CrudPage` 的页面。标准列表优先使用 `CrudPage`；真实游标分页也已支持，见 [游标列表接入指南](crud-cursor-pagination.md)。流程实例列表直接接入 `CrudPage`。

```vue
<script setup lang="ts">
import CrudLayout from '@levin/admin-framework/framework-commons/shared/crud-layout.vue';
import { Button, Form, Input, Table } from 'ant-design-vue';
</script>

<template>
  <CrudLayout form-id="business-query" form-name="业务查询">
    <template #query>
      <Form.Item label="名称"><Input class="w-full" /></Form.Item>
    </template>
    <template #query-actions><Button type="primary">查询</Button></template>
    <template #toolbar><Button>刷新</Button></template>
    <Table :columns="columns" :data-source="rows" />
  </CrudLayout>
</template>
```

`formId` 和 `formName` 必须稳定且在页面内唯一。字段由页面通过 `Form.Item` 显式提供。查询区使用标准 88px 横向标签、16px 间距，并按自身容器宽度使用 1 至 7 列等宽网格；查询按钮在同一网格中靠右排列。标准 CRUD 与本组件共享主题分区和表头样式。

插槽包括 `query`、`query-actions`、`notice`（查询区简短说明）、`toolbar`、默认列表内容和 `footer`（页面自己的分页）。仅使用 `query` 时不会渲染空白列表面板。组件不内置外围页面留白，不生成字段，不读取或保存页面展示设置；已由页面配置控制的布局继续由宿主负责。

组件不查询数据、不判断权限、不生成新增/删除等操作，也不改变分页方式。页面须自行完成 API 授权、手动查询、重置不请求、范围切换清理、异步响应隔离以及原有错误提示。示例仅展示结构，按钮和表格参数必须接入真实业务逻辑。

最小验证：在宽/窄容器下检查查询换行及表头间距；执行查询、重置、分页和范围切换，核对实际请求及权限；卸载页面时观察器会释放。
