# @levin/bpm-designer

独立流程设计器包。它提供流程定义编辑组件和受控的定义契约；BPMN 转换、模拟和发布始终由后端工作流 API 执行。

项目按原技术选型引入了 [lowflow-design 固定版本源码](third-party/lowflow-design/ORIGIN.md)及其 [MIT 许可证](third-party/lowflow-design/LICENSE)。该目录保留上游参考基线，演示接口、Element Plus 外壳和外部转换地址均未接入生产；适配工作及设计/运行共用画布以 OpenSpec 任务 4.1、4.2、4.5 的实际完成证据为准，不能因源码已引入就视为完成。

`WorkflowDesigner` 提供业务对象选择、字段映射、类型化条件树、业务用途依赖、可视化节点与连线、多人审批、节点表单和结果操作。它通过 `options.users`、`options.groups` 与 `options.businessTypes` 接收已授权候选和业务能力目录，不要求业务对象有固定状态字段。`WorkflowDefinitionWorkbench` 提供保存草稿、自动模拟和发布入口，服务端执行最终权限、配置、覆盖率和生命周期校验。

v3 图形结构编辑仅允许选择现有连线后原子插入审批、网关或双结果终局，普通单入单出审批任务可原子删除；不能安全表示的自由连线、游离结束与网关删除会明确拒绝，不写入第二份平面图。

```vue
<WorkflowDefinitionWorkbench
  v-model:definition="definition"
  :options="{ users, groups, businessTypes }"
  :version="version"
  :permissions="{ save: canSave, simulate: canSimulate, publish: canPublish }"
  @refreshed="reloadVersion"
/>
```

已发布或已下线版本必须传入只读版本数据。宿主不得在浏览器端跳过模拟结果或直接生成 BPMN XML。

模拟报告仅说明服务端已实现边界内的配置和覆盖结果，不能替代真实业务写入、外部发送、并发与权限隔离验收。当前批次的模拟隔离扩展仍在集成，不能依据组件构建成功宣称完整平台已交付。

使用 `createTreeDefinition(processKey, name)` 创建 schemaVersion 3 的新草稿。设计器唯一可编辑图形事实是 `flowTree`；旧 `createDefinition` 仅用于显式 v2 迁移/转换测试，不得传入工作台。已有版本直接读取 `version.lowflowDefinition`；旧 v2 响应失败关闭，不在页面自动转换。保存与 `refreshed` 响应须保留最新 `optimisticLock`。修改 Testing 版本会使原模拟结果失效。

组件入口、受支持节点、权限边界与最小验证见[工作流设计器使用指南](docs/工作流设计器使用指南.md)；组件职责及状态处理见[设计与实现说明](docs/流程设计器设计与实现.md)；使用、权限和升级边界见 [模块开发规范](docs/MODULE-DEVELOPMENT-STANDARD.md)。

## 模块开发与设计资料

使用本模块的子项目必须遵循 [模块开发规范](docs/MODULE-DEVELOPMENT-STANDARD.md)。[项目设计和开发参考资料](docs/project-reference/INDEX.md) 提供发布方的设计、需求及规则背景，不构成下游强制约束。
