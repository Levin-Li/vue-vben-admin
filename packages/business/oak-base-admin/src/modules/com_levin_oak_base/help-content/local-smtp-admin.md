# 本地 SMTP 入站收件使用指南

## 1. 用途与边界

本功能使用 Apache James SMTP/Inbox Mailet 让应用进程作为仅入站的 SMTP 接收器，把投递到已开通域名的邮件保存为 `Inbox`。它不提供外发 SMTP、SMTP AUTH、IMAP、POP3、邮件客户端登录或任意收件人转发。主动发信由 Simple Java Mail 统一处理，不与入站收件器混用。

## 2. 部署前置条件

- 服务器具备稳定公网 IPv4，且外部可访问 TCP 25。
- 生产部署可由 Nginx `stream` 将 TCP 25 转发到应用监听端口，例如 2525。
- 应用配置 `oak.base.local-smtp.enabled=true`；监听端口由系统设置 `LocalSmtpConfig.listenPort` 管理，模板与 James 接收器读取同一设置。
- 域名绑定的 DNS 插件具有 `DnsRecordCrud` 能力。

```nginx
stream {
    include /etc/nginx/stream-conf.d/*.conf;
}

```

本地 SMTP 服务自身会生成并维护 `../nginx/oak-local-smtp.conf`。该文件不能放进 HTTP `conf.d`；Nginx 主配置必须由 `stream` 上下文直接 include 该文件。

生成后的 SMTP 片段为：

```nginx
server {
    listen 25;
    proxy_connect_timeout 5s;
    proxy_timeout 10m;
    proxy_pass 127.0.0.1:2525;
}
```

HTTP 前端代理仍独立配置：

```nginx
http {
    # 原有 HTTP server 配置
    server {
        listen 80;
    }
}
```

## 3. 域名开通

在 Domain 页面执行“开启邮件接收”。系统读取当前服务器公网 IPv4，并核对以下基线：

```dns
example.com  A   <当前服务器公网IPv4>
example.com  MX  10 example.com
```

缺失 A 或 MX 时系统自动新增。已有记录与预期不一致时，系统只报告冲突，绝不覆盖或删除，且不会启用邮件接收。开通成功后，`emailReceivingEnabled` 为 true。

“检查邮件接收”只读核对 DNS 与 SMTP 前置条件；“同步修复邮件接收”只补回已开启域名缺失的预期 A/MX，不覆盖冲突记录。

## 4. SMTP 接收与归属

SMTP 在 `RCPT TO` 阶段提取收件域名，仅允许缓存中存在、可用且已开启邮件接收的 Domain。未知域名返回 550；依赖暂时故障返回 451；邮件大小超过限制返回 552。

Domain 开通操作完成后会立即失效对应缓存；普通 Domain CRUD 变更由默认 60 秒的缓存刷新任务生效，可通过 `oak.base.local-smtp.domain-cache-refresh-ms` 调整。

邮件保存前按优先级归属：

1. User：邮箱、合规手机号、登录名、用户 ID 或完整收件邮箱等价用户 ID 的单个 OR 查询。
2. Org：联系邮箱或合规手机号。
3. Tenant：联系邮箱或合规手机号。
4. 平台：全部零结果，或任一优先级出现多个结果。

每个优先级最多查询 2 条记录。多结果时 `Inbox.remark` 写入 `出现多个匹配[用户/组织/租户]，无法精确归属`。

## 5. 安全与运维

- SMTP 接收器没有外发和认证能力，不能被用作开放中继。
- 仅在 Inbox 持久化成功后返回 SMTP 250；重复投递按收件域、消息标识幂等。
- 证书、TLS 和公网端口由部署环境负责；不要将私钥写入 Domain 或普通业务配置。
- DNS 冲突必须由管理员人工处理，自动修复不会覆盖现有网站或第三方邮件解析。
