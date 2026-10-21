# 本地文件上传 API 使用指南

## 入口与前置条件

从 `@levin/admin-framework/framework-commons/app/api` 导入 `fileStorageService`。调用方须已登录并具有后端文件存储控制器的访问权限；临时文件上传也不能匿名调用。

```ts
const longTermUrl = await fileStorageService.uploadLocalPermanent(file);
const temporaryUrl = await fileStorageService.uploadLocalTemporary(file);
```

两个方法接收浏览器 `File` 或 `Blob`，可选第二参数为现有上传请求选项，返回服务端 URL 字符串。需要配置上传组件地址时，使用 `FILE_STORAGE_LOCAL_PERMANENT_UPLOAD_PATH` 或 `FILE_STORAGE_LOCAL_TEMPORARY_UPLOAD_PATH`；API service 负责拼接模块前缀，页面不应手写控制器完整路径。

## 行为与边界

- 长期文件由后端写入本地长期目录，不受临时清理任务影响。
- 临时文件由后端写入专用临时目录，返回 URL 可匿名读取。默认保留 30 分钟，独立任务每 5 分钟运行一次；实际保留时长由后端固定任务配置决定。
- 文件字段统一以 multipart 的 `file` 提交。服务端限制非空文件、大小不超过 10 MB，扩展名为 png、jpg、jpeg、gif、webp、txt、pdf；无 URL 的响应会作为上传失败抛出。
- 临时 URL 是公开资源，不能保存需要独立下载授权的文件。多节点部署须让各节点共享同一本地目录。
- 原有 `uploadFile`、`uploadFiles` 仍按后端存储供应商配置上传，不会自动切换为本地存储。

## 最小验证

以有权限的登录状态调用 `uploadLocalTemporary(new File([...], 'qr.png', { type: 'image/png' }))`，应得到 `/lfs/temp/` URL；在无登录态请求该 URL 应读到文件。调用 `uploadLocalPermanent` 应得到 `/lfs/local/` URL。匿名上传应被后端拒绝，且不能生成文件。
