# 默认加密 API 路径使用指南

公共请求层默认对以下 JSON API 主动启用既有 URL ACL AES-GCM 加解密协议：

- 路径含 `/rbac/` 的 JSON 接口；浏览器图片验证码 `/rbac/captcha` 除外。
- 路径含 `/enums/` 的接口。
- Oak 基础模块 `/com.levin.oak.base/V1/api/User/*` 和 `/com.levin.oak.base/V1/api/Org/*` 的 JSON 接口，包括用户重置密码、用户更新与组织更新。

其它路径若由服务端返回 URL ACL AES-GCM 协商要求，当前页面会话会记住该域名和路径并加密重试；不写入浏览器持久存储。该范围由 `src/framework-commons/app/api/url-acl-crypto.ts` 的路径判断定义，普通业务页面仍通过 API service 发请求，不另行实现加密算法。增加默认路径时须核实该路径及其子路径没有图片、文件等二进制直连接口，并补充路径判断与真实请求测试。

客户端加密保护前端发出的请求体和相应响应 `data`，服务端 URL ACL 过滤器负责解密。前端默认路径不是服务端强制加密策略；直接调用后端的其它客户端仍须使用 HTTPS、满足独立鉴权与数据范围校验。密码保存还需服务端单向编码。

最小验证：在浏览器网络面板检查目标请求有 `X-UrlAcl-Crypto-Algorithm: AES_GCM`、IV 和 Nonce，请求正文为 Base64 密文；响应带加密头且页面能正常处理业务数据。协议失败应明确拒绝，不应改用明文重发。
