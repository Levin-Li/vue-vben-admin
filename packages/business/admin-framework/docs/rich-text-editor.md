# 公共富文本编辑器使用指南

公共 CRUD 表单字段配置 `type: 'html'` 后，会直接显示富文本工具栏与编辑区。字段值仍是 HTML 字符串，按原字段名交给页面现有创建/更新接口；`type: 'code'` 与 `type: 'css'` 继续使用代码编辑弹窗。Demo 的 `htmlData` 可用于本地查看效果。

独立页面可从 `@levin/admin-framework/framework-commons/shared/rich-text-editor-field.vue` 引入 `RichTextEditorField`，通过 `modelValue` 传入 HTML 字符串，监听 `update:modelValue` 回写表单。`disabled` 禁止编辑，`placeholder` 修改空白提示。编辑器提供加粗、斜体、列表和链接；链接只接受 HTTP(S)、邮箱及站内相对地址。

组件在已有值回显、键入和粘贴时只保留安全展示标签及安全链接，移除脚本、嵌入节点、事件属性和任意样式。粘贴内容以纯文本进入画布。该过滤只限定浏览器编辑体验；业务服务仍须按自身权限、长度和展示场景处理 HTML，不能把前端过滤作为服务端信任依据。未获授权的用户即使构造请求，也不能凭前端控件取得写入权限。

最小验证：打开 Demo 的新增或编辑弹窗，找到“HTML”字段，确认可见富文本工具栏而非只读输入框；输入一段加粗文本，关闭再打开编辑弹窗核对回显。无需保存测试业务数据即可检查本地表单行为。
