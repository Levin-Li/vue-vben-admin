# 统一消息与邮件工单使用指南

## 1. 功能与前置条件

邮件、个人消息、公告和工单共同使用持久通知能力，但各自保留业务事实：`Inbox` 是实际收到的邮件，`Ticket` 是处理事项，`TicketMessage` 是追加式往来，`UserMessage` 是某个用户的通知及阅读状态。标记消息已读不会解决工单；SMTP 受理不会证明收件人已经阅读。

使用前需要部署包含这些模块的应用、配置正常登录与资源权限，并完成本版本需要的显式数据库迁移。存量业务库不能仅靠应用启动或普通请求补齐新模型。管理前端需要安装相应版本并配置授权菜单；当前功能已有后端和分层验证，完整运行环境 HTTP、浏览器及公网供应商链路仍须单独验收。

本文 API 前缀记为 `API`，默认是 `/com.levin.oak.base/V1/api/`，部署时还可能有宿主服务上下文路径。前端工作流页面 `/clob/V1/MyWorkflow` 是页面路由，不是后端 API 前缀。请求使用宿主正常认证和当前租户/组织选择；不得提交内部身份开关或伪造当前用户字段。

升级前端后，由平台超级管理员执行管理端“上传页面路由”，通过 `POST Menu/syncMenu` 同步最终应用全部已启用模块的页面映射、分组与操作权限。普通启动的默认菜单扫描只参考通用 CRUD 页面，不会自动补齐工单等专用控制器页面。仅注册页面组件不等于菜单已经同步；租户 `admin` 账号也不等于平台超级管理员，不能通过放宽角色或直接改数据库掩盖缺失入口。

菜单内部 `name` 使用稳定页面路径把 `/` 替换为 `_` 的标识，`label` 承担展示名称。工作流默认六节点与正常同步使用同一契约；授权修改 label、图标、排序或隐藏状态不会被启动核验覆盖。租户作用域、模块、父绑定、视图、来源绑定、权限及非公共页面边界仍须匹配。历史内部名称需要显式迁移，不能依靠重启自动重写。

邮件服务器和域名 DNS 准备见[邮件收件模块功能与使用手册](?doc=mail-receiving-admin)。架构与运行边界见[实现说明](?doc=mail-ticket-design)，通知 HTML 和办理链接见[工作流通知邮件使用指南](?doc=workflow-email-guide)。

## 2. 配置受理队列与支持邮箱

### 2.1 配置顺序

1. 开通实际接收入口：本地 SMTP 使用已开启收件、有效的 Domain；Forward Email 使用已同步、启用且地址匹配的受管路由和验签配置。
2. 在目标租户和受理组织创建工单队列，指定允许处理的用户或角色，再启用队列。处理人必须拥有实际注册的“开始处理工单”权限；只有同组织的处理权限不足以访问其他队列。
3. 创建支持邮箱规则，填写完整 `email`、`inboundChannel`、`queueId`、默认优先级及可选默认负责人。规则新建时停用，核对后显式启用。
4. 本地通道只填 `mailDomainId`；Forward Email 通道只填 `emailRelayRouteId`。规则、队列及默认负责人必须属于同一受理范围。
5. 需要工单外发时，再填 `outboundConfigRef`。它是当前租户实际 `ServicePluginSetting` 配置记录标识。邮件配置中的 `fromEmail` 负责发件身份，必须等于支持邮箱地址；`username` 负责 SMTP 认证，可使用供应商要求的 API key 用户名，不必是邮箱。仅收件无需填写外发配置。

### 2.2 受控配置 API

| 方法和路径（均在 API 下） | 主要参数 |
| --- | --- |
| `GET TicketQueueAction/list`、`retrieve` | `tenantId`、`orgId`、分页；详情增加 `id` |
| `POST TicketQueueAction/save` | `tenantId`、`orgId`、`code`、`name`、`enabled`、`handlerUserIds`、`handlerRoleCodes`；修改增加 `id`、`optimisticLock` |
| `POST TicketQueueAction/setEnabled` | `id`、范围、`optimisticLock`、`enabled` |
| `GET SupportMailboxRuleAction/list`、`retrieve` | 范围、分页或规则 `id` |
| `POST SupportMailboxRuleAction/create` | `tenantId`、`orgId`、嵌套 `config` |
| `POST SupportMailboxRuleAction/update` | `id`、范围、`optimisticLock`、完整 `config`；必须先停用 |
| `POST SupportMailboxRuleAction/enable`、`disable` | `id`、范围、当前 `optimisticLock` |

`config` 字段为 `email`、`inboundChannel`（`LocalSmtp` 或 `ForwardEmail`）、`mailDomainId` 或 `emailRelayRouteId`、`queueId`、可选 `defaultAssigneeId`、可选 `defaultOrgId`、`defaultPriority`（`Normal`、`Important`、`Urgent`）及可选 `outboundConfigRef`。`defaultOrgId` 非空时须等于规则受理组织。同地址、同通道只能有一个规则；不能靠配置顺序决定归属。

队列及规则管理需要当前管理员身份、动作权限和租户/组织授权。版本过期、停用队列、范围错误、非法负责人或未开通接收入口均明确拒绝，不能通过生成的通用 CRUD 绕过这些检查。

## 3. 收件、归属与转工单

### 3.1 接收与安全证据

原始 MIME、原文 SHA-256、会话头、解析状态和附件引用随 `Inbox` 保存。默认边界是原文 10 MiB、深度 16、部件 100、附件及内嵌资源 20、单解码部件 5 MiB、全部解码内容 20 MiB。正文使用数据库文本类型；超过历史 32600 字符但仍在 MIME 限制内的合法正文不会因隐式短字段被截掉。

可信入口决定初始归属：租户 Domain 或验签通过的租户路由，只在自身租户中寻找唯一接收用户、组织或联系租户；未命中或不唯一时保留入口租户。其他租户的同邮箱记录不会改变归属或阻断合法邮件。平台共享入口仍要求唯一匹配，歧义时保留平台归属和原因。邮件头、JSON 自称的租户和外部 From 均不能指定后台身份。

同一邮件实际投递给不同收件地址分别保存。重投以稳定内容与实际收件人去重，不按主题或单独 `Message-ID` 合并。格式损坏时保留原文及失败原因；超限则拒绝整条事实。

### 3.2 自动和人工受理

1. 唯一启用规则与有效队列匹配时，收件事务创建工单及首条入站消息，并保存通知意图；业务保存失败不会先向 SMTP 确认成功。
2. 同租户但原 `Inbox.orgId` 为空时，明确规则可把工单受理到规则组织。原 Inbox、原文及附件的租户/组织/个人归属保持不变。有明确来源组织时必须匹配；不能把平台或另一租户邮件默默转入本租户。
3. 普通邮箱、停用规则、配置冲突或证据不足的邮件留在授权收件箱，查看 `processError` 后处理。恢复规则不会隐式迁移历史归属。
4. 有权处置来源 Inbox、处理工单且能访问目标组织的人员，可调用 `POST Inbox/ticket/intake`：提交 `id`（Inbox）、`supportMailboxRuleId` 及来源范围。服务先核验收件权限，再核验受理目标。重复处理返回已有工单，不追加相同消息、重开或通知。

后续邮件仅在同受理租户、组织、支持邮箱及固定参与者下核对 `In-Reply-To` / `References` 候选。已记录的入站邮件标识或关联外发意图的 `Accepted` / `Unknown` 标识可参与匹配；多工单冲突、仅主题或工单号均不足以关联。

自动追加和重开还需要可信、对齐通过的 DMARC 证据。证据取自验签供应商的结构化字段，经数据库 JSON 往返后仍核验 `status.result=pass`、`status.header.from` 与 `domain`。原始邮件中的 `Authentication-Results` 自称通过不算证据。本地 SMTP 当前不生成这类认证结果，因此其带会话头回复留待核验，不自动追加或重开。

## 4. 工单处理、消息和附件

工单状态为待受理 `New`、已分派 `Assigned`、处理中 `InProgress`、已解决 `Resolved`、已关闭 `Closed`。后台以 FSM、当前版本及队列资格判定动作，界面 `supportEventsByCurrentStatus` 只作提示。当前启用队列的允许用户或角色还必须持有当前处理权限；没有默认的租户/组织管理员跨队列豁免。失去处理资格的本人请求人或负责人仍可按原参与关系只读查看，不能操作。

| API | 请求与结果 |
| --- | --- |
| `GET TicketAction/list` | 当前范围、`status`、`queueId`、分页；只返回有权队列或本人参与工单 |
| `GET TicketAction/retrieve` | `id`（工单）及当前范围；返回版本、状态、流程日志和支持事件 |
| `POST TicketAction/assign` | `id`、`optimisticLock`、`assigneeId`、可选 `remark`；目标也须符合队列及当前权限 |
| `POST TicketAction/start`、`resolve`、`reopen`、`close` | `id`、`optimisticLock`、可选 `remark`；关闭仅从已解决状态执行 |
| `GET TicketAction/messages` | `id`（工单）、范围、`pageIndex`、`pageSize`；最多100条，按创建时间及 ID 正序 |
| `GET TicketAction/message` | `id`（工单）、`messageId`、范围；重新授权同工单全文 |
| `GET TicketAction/attachmentDownload` | `id`（工单）、`blobId`、范围；受控附件下载 |
| `GET Inbox/blob/download` | `id`（Inbox）、`blobId`、范围；按收件权限下载原文或附件 |

消息列表只返回标识、方向、作者、合法业务联系人邮箱、纯文本正文、附件及来源标识、时间。数据库先投影有界正文前缀；响应最多64 KiB UTF-8 字节且不拆 Unicode 码点，`bodyTruncated=true` 时通过同工单全文入口查看。完整持久正文不变。

工单附件必须来自不可变 `TicketMessage.sourceInboxId` 关联的原收件，并同时符合原 Inbox 归属、附件成员关系及摘要；不能从任意文件 ID、另一工单或原始 MIME 取用。下载强制附件、`application/octet-stream`、`no-store`、`nosniff`。原始 MIME 仍通过独立 Inbox 授权，不因工单可见而成为公共文件。

状态、增量流程日志和通知事件在同一事务保存；版本冲突或事件保存失败会回滚，不留下部分解决或日志。阅读消息与点击邮件链接不会触发这些动作。

## 5. 固定联系人与工单邮件回复

### 5.1 核验联系人

`requesterEmail` 是固定业务联系人，不等于后台登录身份。对齐 DMARC 通过的受管入站可初始化 `confirmedContactEmail`、`confirmedContactTime`、`confirmedContactBy`；无认证的本地 SMTP 收件不会自动确认外发目标。

人工核验使用 `POST TicketAction/confirmContact`，只提交 `id`、`optimisticLock`、当前范围和 `evidenceReason`。引用为1～128字符的 `[A-Za-z0-9._:-]+`，例如 `CRM:verification-1`；不能保存正文、URL、邮箱或凭据。动作需当前队列处理及“核验工单联系人”权限，只确认现有请求人邮箱，不能指定另一地址；同时记录操作者、时间和日志。

### 5.2 提交与读取结果

1. 配置当前租户授权的外发设置并绑定规则，明确填写 `fromEmail` 并使固定 From 等于支持邮箱；SMTP `username` / 密码负责认证，与发件地址分开。本地 James 入站端口不能用作外发中继。
2. 调用 `POST TicketAction/reply`，字段为 `id`、范围、当前 `optimisticLock`、`replyKey`、`body` 和可选 `attachmentIds`。正文为最多100000字符的纯文本，附件最多20个本工单关联的合法私有附件。
3. `replyKey` 是本次明确回复的稳定非机密标识，1～128字符、同样采用上述 ASCII 引用字符集。技术重试必须保留相同键及相同内容；同键不同正文或附件被拒绝。
4. 服务端固定 From、To、配置及会话头；请求不能提交 SMTP 主机、凭据、From、To、抄送或任意会话头。调用成功表示意图和消息已保存，随后才由受控调度发送。
5. 用 `GET TicketAction/outbound?id=<工单>&intentId=<意图>` 查看安全结果。返回 `id`、`ticketId`、`status`、`messageId`、`attemptCount`、`optimisticLock`、发生及受理时间、受控失败摘要，不返回正文、地址或凭据。

| 外发状态 | 操作含义 |
| --- | --- |
| `Pending` | 意图已保存，等待领取 |
| `Sending` | 正在提交，不能同时重试；租约过期按未知结果处理 |
| `Accepted` | 受控 SMTP 明确受理，未证明最终邮箱送达或阅读 |
| `Failed` | 当前记录为确定未受理失败；可操作重试仍受核验事实、权限和次数限制 |
| `Unknown` | 可能已被受理，禁止自动重发或直接重试 |

`POST TicketAction/retryOutbound` 使用 `id`、`intentId`、当前 `intentVersion` 与范围，仅处理允许的确定未受理失败（含发送前失败或结构化SMTP明确拒绝），保留消息、稳定 Message-ID 和历史尝试，总领取最多5次。实际注册的重试权限名称仍为“重试工单发送前失败”。

`Unknown` 必须先由当前有权队列处理人、且持有独立“核验工单邮件未受理”权限的人员核对受控 SMTP/供应商回执，再调用 `POST TicketAction/resolveOutboundUnsent`。字段是工单 `id`、`intentId`、当前意图 `intentVersion`、当前范围、`verifiedUnsent=true`、固定 `reason=VerifiedUnsent` 及 `evidenceRef`。证据引用只接受1～128字符的 `[A-Za-z0-9._:-]+`，不上传原始回执、URL、邮箱或凭据。该操作只记录核验并把 Unknown 转为可审计的 Failed，不发送、不清零次数；需要发送时重新读取意图版本并独立申请 `retryOutbound`。没有未受理证据不能改称失败。该入口已有单元和隔离 PostgreSQL 验证，目标环境完整 HTTP/浏览器及真实回执链仍须验收。

## 6. 个人消息、公告与工作流通知

业务事件保存接收人及渠道快照，投递分别记录。Station 成功后形成本人 `UserMessage`；Email、飞书、企微、钉钉各有自己的意图、领取和尝试。机器人是共享配置目标，不会按每个用户重复群发；路由只引用受控配置，不在消息中保存 URL 或密钥。配置引用采用服务端登记的租户或平台作用域，不能使用他租户引用。

工作流精确用户是站内/邮箱受众，路由中的任意邮箱、组织或角色不能扩大集合。工作流交付 `Applied` 表示持久事件及渠道意图已入队；之后某个渠道失败不回滚审批业务。邮件基础 HTML、纯文本替代正文及安全办理链接见[工作流通知邮件使用指南](?doc=workflow-email-guide)。

本人消息 API：

| API | 参数与语义 |
| --- | --- |
| `GET UserMessage/use/list` | `pageIndex`、`pageSize`（最多100）、`unreadOnly`；稳定本人作用域分页 |
| `GET UserMessage/use/retrieve` | `id`；只返回本人摘要及受控来源引用 |
| `GET UserMessage/use/unreadCount` | 与本人列表相同范围的准确未读数 |
| `POST UserMessage/use/markRead` | `ids` 数组，1～100条；整批存在且属于本人方可保存首次已读时间 |

读取列表或来源详情不会自动标记已读。打开通知来源仍重新检查业务权限；旧消息不授予已撤销的队列、任务或公告资格。

公告发布捕获固定接收人及各自作用域，最多100000名候选，按每批100名追加站内意图。租户公告只投本租户；平台公共公告可按明确条件选择跨租户受众，但接收时仍核验用户当时及当前作用域。后来加入组织或角色的人不会自动补进旧快照。下架、过期、来源改变或受众失效会阻止继续投放。`GET Notice/myDetail?noticeId=...` 只读取当前有权且属于发布快照的公告，不标记消息已读。

## 7. 通知投递审计与重试

通知状态与工单外发状态是两套独立结果。通知 `Delivered` 表示站内保存成功或渠道确认提交，Email 不代表最终送达。发送前确定异常可以进入明确失败；已开始外部调用的超时或断连保守进入 `Unknown`，不自动再次调用。

管理员通过 `NotificationAudit/list`、`retrieve` 查看当前授权范围的安全状态、时间、次数、日志和尝试结果。响应不包含事件正文、目标邮箱、目标指纹、配置引用、凭据或供应商原始响应。

人工操作需当前动作权限及版本：

1. `POST NotificationAudit/resolveUnsent`：`id`、范围、`optimisticLock`、`reason=VerifiedUnsent`、`verifiedUnsent=true`、`verificationRef`；仅在明确核验未受理后记录事实，不直接发送。
2. `POST NotificationAudit/retry`：`id`、范围、`optimisticLock` 和允许原因 `ConfigurationFixed`、`ServiceRestored` 或 `VerifiedUnsent`；只接受明确失败，历史与次数不清零，最多5次领取。
3. 核验引用同样只接受无机密的 ASCII 记录标识，不传 URL、邮箱、原始回执或秘密。未核验的 Unknown、已成功、领取中、待投递或跳过状态不能直接重试。

## 8. 最小业务验收与当前边界

1. 配置专用测试域名/路由、队列与规则，发送带附件的小邮件，核对 Inbox、私有原文、原归属、工单和首条消息各自保留。
2. 重投同一消息，再投不同收件人，核对每位收件人的独立事实且消息、工单、事件不重复。
3. 用另一租户同邮箱记录及同组织非队列成员尝试读取、操作和附件下载，确认不会错误归属或放行。
4. 解决工单后发送可信、对齐 DMARC 的同会话回复，核对重开和日志；无可信认证的本地回复应保留待核验。
5. 明确核验固定联系人后提交一次受控外发，检查提交事实与会话头；模拟结果未知，确认不会自动重复邮件。
6. 确认个人已读不改变工单，公告后来新增受众不获得旧内容；工作流邮件链接经正常登录与当前权限定位。

已经取得本机真实 James SMTP 和隔离 PostgreSQL 17 的协议、保存、归属、并发及事务证据，也有渲染、权限和组件测试。完整生产 HTTP 过滤器、浏览器登录回跳、公网 DNS/Nginx/TCP25、真实 Forward Email 回调和外部邮箱最终送达仍未作为整套能力验收完成。部署后的实际外部投递与访问验证不可省略。

## API组织范围传参

普通租户主体调用通用Query/Id GET接口时，不直接传受保护的tenantId，由服务端绑定当前租户；具备平台权限的主体可按接口合同显式筛选租户。通用组织查询使用已声明的orgIdList范围；单个组织可同时传orgId与只含同一ID的orgIdList，保持业务服务标量范围和组织/公共数据并集。当前工作台API封装会完成这些参数整理，界面仍选择实际授权组织。独立通知审计及Create/Save/POST动作使用各自参数合同，不能统一删除其必需租户字段。
