# 域名与验证码插件设计使用指南

本文说明基础模块中域名服务插件、验证码插件和验证码发送插件的设计、配置来源、配置处理规则和接入方式。

## 1. 适用范围

本文覆盖三类插件：

- 域名服务插件：负责域名可用性检查、申请、续期、状态同步、DNS 解析记录维护和 ACME DNS-01 验证记录写入。
- 验证码插件：负责生成和校验图片验证码、短信验证码、邮箱验证码、人机交互验证码和 MFA 验证码。
- 发送通道插件：负责真正发送短信验证码或邮箱验证码。

核心代码入口：

| 类型 | 接口 | 默认实现示例 |
| --- | --- | --- |
| 统一验证码服务 | `BizVerifyCodeService` | `BizVerifyCodeServiceImpl` |
| 文本验证码插件 | `TextVerifyCodeServicePlugin` | 短信、邮箱、图片、MFA 的上层插件 |
| 短信验证码插件 | `SmsVerifyServicePlugin` | `DefaultSmsVerifyServicePlugin` |
| 邮箱验证码插件 | `EmailVerifyServicePlugin` | `DefaultEmailVerifyServicePlugin` |
| 图片验证码插件 | `CaptchaVerifyServicePlugin` | `DefaultCaptchaVerifyServicePlugin`, `HappyCaptchaVerifyServicePlugin` |
| 人机交互验证码插件 | `HmiVerifyServicePlugin` | `DefaultHmiVerifyServicePlugin`，当前为独立插件接口 |
| MFA 验证码插件 | `MfaVerifyServicePlugin` | `GoogleMfaVerifyServicePlugin` |
| 短信发送通道 | `SmsSendServicePlugin` | `Sms4JSmsSendServicePlugin`, `WlwxSmsSendServicePlugin` |
| 邮箱发送通道 | `EmailSendServicePlugin` | `DefaultEmailSendServicePlugin` |
| 域名服务插件 | `DomainApplyServicePlugin` | `CloudflareDomainApplyServicePlugin`, `DynadotDomainApplyServicePlugin`, `SpaceshipDomainApplyServicePlugin`, `DNSHeDomainApplyServicePlugin`, `DeSecDomainApplyServicePlugin` |

## 2. 插件选择与启停

这些插件都交给 Spring Plugin 的 `PluginRegistry` 选择。选择逻辑分两层：

1. 先按插件的 `supports(...)` 判断是否支持当前请求。
2. 再按 `Ordered#getOrder()` 排序，排序靠前的插件优先。

插件排序和业务可用性来自 `ServicePlugin` 表。插件第一次被调用时，`BizServicePluginService#getPluginOrder(...)` 会自动创建一条服务插件记录，记录字段包括：

| 字段 | 用途 |
| --- | --- |
| `type` | 插件类型，一般是接口简单类名，例如 `SmsSendServicePlugin`、`DomainApplyServicePlugin`。 |
| `className` | 插件实现类完整类名。 |
| `name` | 管理端展示名称。 |
| `enable` | 是否启用。 |
| `orderCode` | 排序值。当前实现返回 `-orderCode` 作为 Spring 插件排序，`orderCode` 越大越优先。 |
| `expiredTime` | 到期后不应继续作为可用插件使用。 |

插件 Bean 还可以通过 Spring 配置启停，配置前缀为 `plugin.com.levin.oak.base.`。例如：

```yaml
plugin:
  com:
    levin:
      oak:
        base:
          DefaultSmsVerifyCodeServicePlugin: true
          SmsSendService: true
          CloudflareDomainApplyServicePlugin: true
```

多数默认插件 `matchIfMissing = true`，也就是不显式关闭时会自动注册 Bean。需要停用某个插件时，优先在“服务插件”中禁用，或通过 Spring property 关闭 Bean。

## 3. 配置来源

插件配置主要来自三处。

### 3.1 登录配置

验证码长度、有效期、是否允许模拟验证码、禁用验证码类型等来自 `LoginCfg`。默认配置会从 `OakFrameworkProperties` 拷贝，然后按租户从系统设置读取。设置 code 为：

```text
<当前用户类型> + LoginCfg
```

常用字段：

| 字段 | 说明 |
| --- | --- |
| `verifyCodeLen` | 验证码长度，最小按 4 处理。 |
| `verifyCodeDurationOfMinutes` | 验证码有效期，最小按 3 分钟处理。 |
| `enableLoginVerifyCode` | 是否启用登录验证码。 |
| `enableApiDynamicVerifyCode` | 是否启用非登录接口动态验证码。 |
| `enableMockVerifyCode` | 是否允许模拟验证码。只有 `dev`、`test`、`local` 环境真正生效。 |
| `disableVerifyCodeTypeList` | `VerifyCodeType` 枚举多选，JSON 仍以名称保存，例如 `["Sms", "Email"]`。 |

### 3.2 系统设置

发送通道和域名供应商参数来自 `BizSettingService`。当调用方传入默认创建函数时，如果配置不存在，系统会自动创建一条可编辑的默认配置。

`BizSettingService#getValue(Type, tenantId, code, supplier)` 的规则：

- 配置不存在且传入 `supplier` 时，自动创建默认配置。
- 配置存在但 `enable = false` 时，返回 `null`。
- JSON 类型会按目标配置类反序列化。
- `updateValue(tenantId, code, valueContent)` 只更新已存在配置，不会自动创建。

注意：供应商 API 配置不要靠禁用系统设置来停用插件。部分插件会假定配置对象存在，停用供应商应使用“服务插件”禁用或 Spring property 关闭 Bean。

### 3.3 服务插件记录

插件启停、排序、到期和审计状态来自 `ServicePlugin`。域名插件的 `isAvailable()` 会先检查服务插件记录是否可用，再检查供应商密钥是否已经替换默认占位值。

## 4. 验证码插件设计

验证码统一入口为 `BizVerifyCodeService`：

```java
VerifyCode<?> genCode(VerifyCodeType type, String tenantId, String appId, String account, Map<String, ? extends Serializable> genParams);

boolean verify(VerifyCodeType type, String tenantId, String appId, String account, Object verifyData);
```

`VerifyCodeType` 当前包括：

| 类型 | 用途 |
| --- | --- |
| `Captcha` | 图片验证码。 |
| `Hmi` | 人机交互验证码，例如滑块、旋转、点选。 |
| `Bio` | 生物识别预留类型。 |
| `Sms` | 短信验证码。 |
| `Email` | 邮箱验证码。 |
| `Mfa` | 多因子验证码，默认 Google Authenticator。 |

调用流程：

1. `BizVerifyCodeServiceImpl` 根据 `VerifyCodeType` 从 `TextVerifyCodeServicePlugin` 注册表中选择插件，当前适用于 `Sms`、`Email`、`Captcha`、`Mfa` 等文本校验型插件。
2. 短信和邮箱账号如果传入的是登录名，会自动加载用户并替换为用户手机号或邮箱。
3. 插件生成验证码并按 `tenantId + appId + account + code` 写入 Redisson `RMapCache`。
4. 非模拟验证码返回前会清空明文 `code`。
5. 校验时按同样 key 删除缓存，验证码一次性使用。

## 5. 验证码发送通道

短信、邮箱验证码插件只负责生成和校验验证码，真正发送由发送通道插件完成。

### 5.1 短信发送

短信验证码由 `DefaultSmsVerifyServicePlugin` 生成，再通过 `PluginRegistry<SmsSendServicePlugin, String>` 按手机号选择发送通道。

服务插件设置中，“默认短信验证码插件”只有一个默认逻辑供应商，它负责验证码生成、缓存与核验，不是短信云厂商清单。阿里云、腾讯云等实际发送供应商应在“默认短信发送插件”（`Sms4JSmsSendServicePlugin`）中选择，其候选按当前安装的 Sms4J 供应商工厂动态列出；未来无线使用独立的 `WlwxSmsSendServicePlugin`。只更改验证码插件的默认供应商项不会切换短信发送通道。

现有短信发送插件：

| 插件 | 配置 code | 说明 |
| --- | --- | --- |
| `Sms4JSmsSendServicePlugin` | `SMS` 或 `SMS|<appId>` | 基于 sms4j，支持多个云厂商。 |
| `WlwxSmsSendServicePlugin` | `SMS` 或 `SMS|<appId>` | 未来无线短信通道。 |

短信配置查找规则：

1. 如果有 `appId`，配置 code 为 `SMS|<appId>`；否则为 `SMS`。
2. 先读取当前 `tenantId` 下的配置。
3. 租户配置不存在时读取全局配置。
4. 全局配置也不存在时自动创建全局默认配置。
5. 配置不存在、未启用、`channelType` 为空或供应商配置不完整时，发送失败并返回错误信息。

sms4j 配置形态：

```json
{
  "channelType": "Aliyun",
  "defaultChannel": "Aliyun_default",
  "Aliyun_default": {
    "configId": "Aliyun_default",
    "accessKeyId": "...",
    "accessKeySecret": "...",
    "signature": "...",
    "templateId": "..."
  }
}
```

`channelType` 必须匹配 sms4j 的供应商名称。具体字段以自动创建的默认配置模板和 sms4j 对应供应商配置类为准。

未来无线配置形态：

```json
{
  "channelType": "Wlwx",
  "defaultChannel": "Wlwx_default",
  "Wlwx_default": {
    "apiUrl": "https://sms.wlwxpro.com/sendVariantSms",
    "code": "客户编码",
    "password": "客户密码",
    "template": "【xx科技】您的验证码{$var1}，3分钟内有效，如非本人操作，请忽略！"
  }
}
```

`template` 必须包含 `{$var1}`，插件会把验证码作为第一个变量发送。

### 5.2 邮箱发送

邮箱验证码由 `DefaultEmailVerifyServicePlugin` 生成，再通过 `PluginRegistry<EmailSendServicePlugin, String>` 按邮箱选择发送通道。

默认邮箱发送插件为 `DefaultEmailSendServicePlugin`，配置 code 为：

- `EMAIL`
- `EMAIL|<appId>`

邮箱配置读取当前 `tenantId` 下的配置；不存在时会按当前 `tenantId` 自动创建模板。常用字段来自 Spring `MailProperties`，并扩展 `sign`：

```json
{
  "sign": "系统名称",
  "host": "smtp.example.com",
  "port": 465,
  "username": "noreply@example.com",
  "password": "smtp-password",
  "protocol": "smtp",
  "defaultEncoding": "UTF-8",
  "properties": {
    "mail.smtp.auth": "true",
    "mail.smtp.ssl.enable": "true"
  }
}
```

必填项：`sign`、`host`、`username`、`password`。发送成功时插件返回原验证码；否则抛出异常或返回错误信息。

### 5.3 图片验证码

图片验证码由 `CaptchaVerifyServicePlugin` 生成。现有实现：

- `DefaultCaptchaVerifyServicePlugin`：基于 EasyCaptcha，默认在 `GifCaptcha` 和 `SpecCaptcha` 中选择。
- `HappyCaptchaVerifyServicePlugin`：基于 HappyCaptcha。

生成参数可传：

| 参数 | 说明 |
| --- | --- |
| `type` | `DefaultCaptchaVerifyServicePlugin` 可指定 `Gif`、`Spec` 等前缀。 |
| `width` 或 `w` | 图片宽度。 |
| `height` 或 `h` | 图片高度。 |

图片验证码返回 `interactionData`，通常为 Base64 图片内容，`interactionDataType` 为 `image/gif`。校验忽略大小写。

### 5.4 HMI 人机交互验证码

`DefaultHmiVerifyServicePlugin` 基于 Tianai Captcha，支持滑块、旋转、拼接、文字点选等交互类型。生成时返回第三方组件的交互数据，前端按 `interactionData` 渲染控件；校验时提交 Tianai 的 `ImageCaptchaTrack` 数据。

注意：HMI 插件当前是 `HmiVerifyServicePlugin` 独立接口，不属于 `TextVerifyCodeServicePlugin`。如果要把 HMI 暴露到 `/rbac/getVerifyCode` 这样的统一验证码入口，需要补充 HMI 的注册表选择逻辑或提供一个文本验证码适配插件。

### 5.5 MFA 验证码

`GoogleMfaVerifyServicePlugin` 基于 Google Authenticator：

- `genSecretKey()` 生成密钥。
- `genQrCode(issuer, label, secretKey)` 生成 `otpauth://` URI。
- `verify(...)` 使用用户绑定的 `mfaSecretKey` 校验 TOTP。

管理端用户相关接口会通过 `PluginRegistry<MfaVerifyServicePlugin, VerifyCodeType>` 获取 MFA 插件。

密码登录使用 MFA 时，不在账号输入阶段探测账号能力：只有账号密码已通过服务端审计后，密码登录挑战接口才会返回 `Mfa`。已绑定 MFA 的账号不能用图片验证码替代 MFA；短信和邮箱的非密码登录保持原有行为。两步挑战、上下文复核和前端接入请继续参见 `docs/15-密码登录挑战与MFA安全开发指南.md`。

## 6. 验证码使用方式

### 6.1 获取验证码

未登录和已登录场景都可以调用 RBAC 控制器：

```http
GET /rbac/getVerifyCode?account=13800000000&verifyCodeType=Sms
GET /rbac/getVerifyCode?account=user@example.com&verifyCodeType=Email
GET /rbac/getVerifyCode?account=admin&verifyCodeType=Captcha
```

图片验证码也可以直接请求图片链接：

```http
GET /rbac/captcha?account=admin
```

请求对象为 `VerifyCodeReq`，核心字段：

| 字段 | 说明 |
| --- | --- |
| `account` | 登录名、手机号或邮箱。已登录用户在部分场景可不传。 |
| `verifyCodeType` | 统一入口当前主要使用 `Sms`、`Email`、`Captcha`、`Mfa`。`Hmi` 需要单独接入或适配。 |
| `tenantId` | 租户 ID。登录页会优先使用当前域名绑定的租户。 |
| `appId` | 应用 ID，用于选择 `SMS|appId`、`EMAIL|appId` 等应用级配置。 |

如果未指定 `verifyCodeType`，系统会按账号格式猜测：邮箱走 `Email`，手机号走 `Sms`，其他默认走 `Captcha`。

### 6.2 登录和注册校验

登录、注册、找回密码等业务请求会带上验证码类型和验证码值。服务端按 `tenantId + appId + account + code` 查缓存并删除；验证码成功校验后不能重复使用。

### 6.3 API 动态验证码

API 动态访问控制由 `UrlAclInterceptor` 触发，用于对已经登录且有权限的高风险接口增加短信、邮箱、MFA 或图片验证码验证。

完整设计、前后端协议、`ChallengeId` 绑定规则、实现类和使用方式见 `docs/13-API动态验证码设计使用指南.md`。

## 7. 域名服务插件设计

域名服务统一接口为 `DomainApplyServicePlugin`。它既支持传统免费子域名，也支持注册商和 DNS 供应商。

核心能力通过 `Capability` 声明：

| 能力 | 说明 |
| --- | --- |
| `FreeSubdomain` | 免费子域名申请。 |
| `DomainApply` | 旧式域名申请接口。 |
| `DomainCheck` | 域名实时可注册性和价格查询。 |
| `DomainRegister` | 标准域名注册。 |
| `DomainRenew` | 域名续期。 |
| `DomainTransfer` | 域名转入。 |
| `DomainPrivacy` | 隐私保护。 |
| `DomainAutoRenew` | 自动续费。 |
| `DnsRecordCrud` | DNS 解析记录增删改查。 |
| `DnsZoneManagement` | DNS Zone 管理。 |
| `Dns01Challenge` | ACME DNS-01 证书验证记录写入。 |
| `DnsSec` | DNSSEC。 |

业务侧不要按具体供应商写逻辑，应先读取 `getProviderProfile()` 或 `supportsCapability(...)` 判断能力。

## 8. 域名供应商配置

域名供应商配置均为全局系统设置，不按租户拆分。插件启动时会自动创建默认配置模板。

| 插件 | 配置 code | 必填/关键字段 | 说明 |
| --- | --- | --- | --- |
| `CloudflareDomainApplyServicePlugin` | `CloudflareApiSetting` | `accountId`, `apiToken`, `managedZones`, `zoneIdByName` | 支持注册商和 DNS。真实注册需设置 `registrationEnabled = true`。 |
| `DynadotDomainApplyServicePlugin` | `DynadotApiSetting` | `apiKey`, `apiSecret` | 支持注册、续期、转入、DNS。真实注册需设置 `registrationEnabled = true`。 |
| `SpaceshipDomainApplyServicePlugin` | `SpaceshipApiSetting` | `apiKey`, `apiSecret`, `defaultContactId` | 支持注册、续期、转入、DNS。真实注册需设置 `registrationEnabled = true`。 |
| `DNSHeDomainApplyServicePlugin` | `DNSHeApiSetting` | `apiKey`, `apiSecret`, `supportedDomainSuffixes` | 免费子域名和 DNS API。 |
| `DeSecDomainApplyServicePlugin` | `DeSecApiSetting` | `token`, `supportedDomainSuffixes` | deSEC 免费子域名和 DNS API。 |

配置示例：

```json
{
  "apiEndpoint": "https://api.cloudflare.com/client/v4",
  "accountId": "your_cloudflare_account_id",
  "apiToken": "your_cloudflare_api_token",
  "registrationEnabled": false,
  "managedZones": ["example.com"],
  "zoneIdByName": {
    "example.com": "cloudflare-zone-id"
  },
  "supportedDomainSuffixes": [".com", ".net", ".org"],
  "domainRenewBeforeDays": 30
}
```

配置处理规则：

- API 密钥必须替换默认占位值，例如 `your_cloudflare_api_token`。占位值存在时插件不可用。
- `registrationEnabled` 默认关闭，避免误触发真实扣费。
- `supportedDomainSuffixes` 会被规范成小写、以 `.` 开头、不带结尾 `.` 的形式。
- 部分插件会尝试从供应商 API 获取支持后缀；获取成功后写回系统设置，失败则使用配置中的后缀列表。
- 支持后缀有 12 小时本地 LRU 缓存，修改后缀配置后如需立刻生效，可重启服务或清理相关缓存。
- DNS-01 证书申请需要供应商同时支持 `DnsRecordCrud` 和 `Dns01Challenge`。

## 9. 域名插件使用方式

### 9.1 查询可用供应商和后缀

业务服务入口：

```java
List<DomainVendor> vendors = bizDomainService.getAvailableDomainSuffixes();
DomainVendor vendor = bizDomainService.canApply(req);
```

租户站点管理端接口：

```http
GET /api/TenantSite/availableSuffixes
```

返回的 `DomainVendor` 会包含供应商名称、API 地址、支持后缀和能力信息。申请域名时前端应把选中的 `apiUrl` 带回，业务层用它辅助匹配供应商。

“申请域名”的供应商下拉框从后端当前插件注册表动态读取，只列具备免费子域名申请、域名申请或域名注册能力的插件；当前可看到 Cloudflare、DNSHe、deSEC、Dynadot、Spaceship。GoDaddy、Gname、Namecheap 当前仅实现域名查询或 DNS 操作，不提供注册能力，因此不出现在申请下拉框。选择供应商后，后缀下拉框只展示该供应商声明的后缀；例如选择 DNSHe 时，不会显示其它供应商的后缀。候选目录保留尚待配置的供应商及其接入指引，实际提交仍要求该插件已启用、配置可用并支持选中的后缀。

### 9.2 申请或登记域名

业务入口：

```java
DomainInfo domain = bizDomainService.applyDomain(req);
TenantSiteInfo site = bizTenantSiteService.applyDomain(req);
```

租户站点管理端接口：

```http
POST /api/TenantSite/applyDomain
POST /api/TenantSite/applyExistingDomain
```

插件匹配规则：

1. 根据域名后缀调用 `supports(domain)`。
2. 如果请求指定 `domainApplyApi`，优先匹配 `getApiUrl()` 相同的插件。
3. 再判断插件能力是否包含 `FreeSubdomain`、`DomainApply` 或 `DomainRegister`。
4. 插件返回结果后，业务层把供应商状态映射回 `Domain` 或 `TenantSite`。

若插件配置不可用、供应商明确拒绝或未返回结果，管理端会显示不包含原始供应商响应的业务提示。供应商注册调用发生异常时，外部操作结果可能未知；应先在供应商后台核对该域名的实际状态，再决定是否重试，系统不会自动重新发起注册。

### 9.3 DNS 解析记录

业务入口：

```java
bizDomainService.queryDnsRecord(req);
bizDomainService.addDnsRecord(req);
bizDomainService.updateDnsRecord(req);
bizDomainService.delDnsRecord(req);
```

租户站点管理端接口：

```http
POST /api/TenantSite/dnsRecords/list
POST /api/TenantSite/dnsRecords/create
POST /api/TenantSite/dnsRecords/update
POST /api/TenantSite/dnsRecords/delete
```

DNS 记录保存时，如果请求没有 `recordId`，会走新增；有 `recordId` 会走更新。TXT 记录值由插件按供应商格式处理，业务侧传原始值即可。

### 9.4 SSL 证书 DNS-01

SSL 证书申请服务在 DNS-01 模式下，会根据域名寻找支持 `DnsRecordCrud` 和 `Dns01Challenge` 的域名插件，并写入 `_acme-challenge` TXT 记录。供应商配置必须能解析目标域名所属 zone，否则证书申请会失败。

### 9.5 远端状态同步

`BizDomainService.syncDomainStatus(DomainIdReq)` 先按当前请求范围验证域名，再要求匹配插件明确声明 `DomainStatus`；无能力的供应商不能调用状态同步。deSEC 仅将目标域名的 `200` 且响应名称匹配视为已拥有、`404` 视为不存在；其它 HTTP 错误或异常响应直接报错，不会把认证失败、限流或临时故障写成域名失效。DNSHe 仅接受 `active`、`suspended`、`expired` 三种已知状态；接口失败、未知状态或列表当前页未命中目标时也报错，不把可能存在于后续分页的域名判为不存在。参考供应商[deSEC 域名接口](https://desec.readthedocs.io/en/latest/dns/domains.html)与[DNSHe 子域名接口](https://my.dnshe.com/knowledgebase/13/DNSHE-Free-Domain-API-User-Guide-V2.0.html?language=english)。

## 10. 接入新插件的约定

新增验证码或发送通道插件：

1. 实现对应接口，例如 `SmsSendServicePlugin`、`EmailSendServicePlugin`、`TextVerifyCodeServicePlugin`。
2. 使用 `@Service(PLUGIN_PREFIX + "...")` 注册 Bean。
3. 使用 `@ConditionalOnProperty(prefix = PLUGIN_PREFIX, name = "...", havingValue = "true", matchIfMissing = true)` 控制启停。
4. 如需排序，调用 `BizServicePluginService#getPluginOrder(...)` 自动创建服务插件记录。
5. 配置参数放入 `Setting`，提供默认 JSON 模板，不把密钥写入代码。
6. 发送成功必须返回原验证码；失败返回清晰错误信息或抛出异常。

新增域名供应商插件：

1. 优先继承 `AbstractDomainApplyServicePlugin`。
2. 声明准确的 `Capability`，不要让业务层猜供应商能力。
3. 提供 `getProviderProfile()`、`getSupportedDomainSuffixes()` 和供应商备注。
4. 使用独立的全局配置 code，例如 `<Vendor>ApiSetting`。
5. 对真实扣费动作增加显式开关，默认关闭。
6. 第三方响应要转换成 `DomainCheckResult`、`DomainRegistrationResult`、`DomainDnsRecordResult` 等标准结果。
7. 不要把第三方原始错误直接透传给前端，应保留关键原因并给出可读错误信息。

## 11. 常见排查

| 现象 | 优先检查 |
| --- | --- |
| 获取短信验证码失败 | `LoginCfg.disableVerifyCodeTypeList` 是否禁用 `Sms`；`SMS` 或 `SMS|appId` 是否存在且启用；`channelType` 是否正确；发送插件是否启用。 |
| 获取邮箱验证码失败 | `LoginCfg` 是否禁用 `Email`；`EMAIL` 或 `EMAIL|appId` 是否配置 `sign`、`host`、`username`、`password`；邮箱发送插件是否启用。 |
| 图片验证码不显示 | 图片验证码插件依赖是否存在；`Captcha` 是否被禁用；前端是否使用 `interactionData` 或 `/rbac/captcha`。 |
| 模拟验证码不返回明文 | 只有 `dev`、`test`、`local` 环境且 `enableMockVerifyCode = true` 才会返回明文。 |
| 域名供应商不可用 | 服务插件是否启用；API 密钥是否仍是占位值；配置是否被禁用；支持后缀是否包含目标域名。 |
| 域名真实注册失败 | 是否显式开启 `registrationEnabled`；联系人信息、余额、注册商接口权限是否完整。 |
| DNS-01 证书申请失败 | 域名所属 zone 是否能被供应商配置解析；插件是否支持 `DnsRecordCrud` 和 `Dns01Challenge`；TXT TTL 是否符合供应商限制。 |

## 12. 配置处理建议

- 密钥、Token、SMTP 密码只写入系统设置或环境专用配置，不写入源码、文档示例真实值或提交记录。
- 平台共用短信配置放全局 `SMS`，租户差异化配置放租户系统设置；应用差异化配置使用 `SMS|appId`。
- 邮箱配置按当前租户和 `EMAIL` / `EMAIL|appId` 管理；多租户共用邮箱时应明确由哪个租户或平台配置承载。
- 域名供应商配置是平台级能力，建议由平台管理员维护，不开放给普通租户直接编辑。
- 需要停用某个供应商或发送通道时，优先禁用服务插件记录，而不是删除配置。
- 修改配置后先调用“获取验证码”“查询可用后缀”“查询 DNS 记录”等读接口验证，再执行真实发送、注册、续期等有外部副作用的动作。
