# 浏览器读写 MP4 JSON 标记

`@levin/admin-framework` 提供本地和 URL 的 MP4 JSON 读写方法，与后端 `Mp4JsonMetadataService.write(Path, JSONObject)` 使用相同的顶层 `uuid` 标记。读取只返回该标记中的 JSON 对象；没有标记时返回 `null`。损坏的 MP4 或标记会抛出异常。

```ts
import {
  readMp4JsonMetadataFromBlob,
  readMp4JsonMetadataFromUrl,
  writeMp4JsonMetadataToBlob,
  writeMp4JsonMetadataFromUrl,
} from '@levin/admin-framework';

const local = await readMp4JsonMetadataFromBlob(fileInput.files![0]);
const remote = await readMp4JsonMetadataFromUrl(urlInput.value);

const metadata = { author: '作者', createdAt: '2026-10-27T00:00:00+08:00', id: 'video-001' };
const updatedLocal = await writeMp4JsonMetadataToBlob(fileInput.files![0], metadata);
const updatedRemote = await writeMp4JsonMetadataFromUrl(urlInput.value, metadata);
const downloadUrl = URL.createObjectURL(updatedLocal);
const link = document.createElement('a');
link.href = downloadUrl;
link.download = 'video-with-metadata.mp4';
link.click();
// 下载启动后再释放对象 URL，避免过早撤销。
setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
```

`fileInput` 是 `<input type="file" accept="video/mp4">`，`urlInput` 是 `<input type="url">`。本地读取接受浏览器 `File` 或 `Blob`，只读取必要的字节片段；本地写入生成新 Blob，不修改用户选择的文件。重复写入会替换末尾的旧标记。

URL **读取**按 MP4 顶层 box 长度定位标记，使用 HTTP Range 分段请求，不解码或下载整个媒体数据。视频服务器必须允许浏览器跨域访问，Range 响应必须为 `206 Partial Content`。若浏览器可读 `Content-Range`，会验证其中的区间与总长度；否则会用 HEAD 响应的 `Content-Length` 获取总长度，并验证每段字节数。在后一种情况下，浏览器无法独立核对服务器返回的分段起点。URL **写入**必须下载完整视频，最大支持 512 MiB，返回新的 Blob 供用户下载；不会修改服务器上的原文件。它同样要求视频来源开放 CORS。有身份验证或防盗链限制的视频链接，仍需由来源网站明确允许相应访问；浏览器无法绕过 CORS。请求不发送凭据，也不跟随重定向。

标记格式为 UUID `986b97e2-4b37-4a44-9cd0-fd7ef6815db4`、ASCII 版本 `OAKMP4J1`、大端 JSON 字节长度和 UTF-8 JSON 对象。JSON 最大 64 KiB。它不是 MP4 标准版权 `cprt` 字段，也不能保证短视频平台处理后保留。

最小验证：通过文件选择控件选择 MP4，本地写入后从返回的 Blob 读回同一 JSON；将它放到支持 CORS 和 HTTP Range 的测试服务器，调用 URL 读取入口对比结果。URL 写入则检查返回的新 Blob；缺少标记时读取应返回 `null`。短视频平台重新封装后是否保留标记，需要用平台实际返回的文件验证。
