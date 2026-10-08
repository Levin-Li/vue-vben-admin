import type { Browser, BrowserContext, Page, Route } from '@playwright/test';

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { expect } from '@playwright/test';

import { resolveOAuthPlatformName } from '../../../../../packages/business/admin-framework/src/framework-commons/app/views/_core/authentication/oauth-platform-name';

export type EnterpriseProvider =
  | 'DINGTALK_V2'
  | 'FEISHU'
  | 'WECHAT_ENTERPRISE_V2';
export type SupplierMode =
  | 'deny'
  | 'error'
  | 'expired'
  | 'malformed'
  | 'success'
  | 'wrong-state';
export interface FixtureAccount {
  account: string;
  password: string;
  userId: string;
}
export interface EnterpriseFixtureConfig {
  bindingIds: Record<EnterpriseProvider, string>;
  rootId: string;
  accounts: { other: FixtureAccount; primary: FixtureAccount };
  baseUrl: string;
  providerLabels?: Partial<Record<EnterpriseProvider, string>>;
  vendorUrl: string;
}
export interface SafeSnapshot {
  db: {
    auditCount?: number;
    bindings: Array<{
      companyRootId: string;
      hasCredential: boolean;
      id: string;
      innerUserId: string;
      kind: string;
      provider: string;
      unlinked: string;
    }>;
    userCount: number;
    users: Array<{
      enabled: boolean;
      id: string;
      orgId: string;
      roles: string[];
      state: string;
    }>;
  };
  redis?: {
    sessionCount?: number;
    sessionProofs?: Array<{
      credentialFingerprint: string;
      ownerUserId: string;
      ttlMillis: number;
    }>;
    transactionIdCount?: number;
    transactionIds?: string[];
    transactionIndexes?: { idCount: number; stateCount: number };
    transactionStateCount?: number;
  };
  supplier?: {
    consumedCodeCount?: number;
    issuedCodeCount?: number;
    requests?: Array<{ path: string; status?: number }>;
  };
  transaction?: {
    hasProof?: boolean;
    hasProviderToken?: boolean;
    hasSupplierCode?: boolean;
    id?: string;
    idTtlMillis?: number;
    indexesAgree?: boolean;
    mode?: string;
    purpose?: string;
    stateTtlMillis?: number;
    status?: string;
    userId?: string;
  };
}
const USER_AGENTS: Record<EnterpriseProvider, string> = {
  DINGTALK_V2: 'Mozilla/5.0 EnterpriseIntegrationFixture DingTalk/7.0',
  FEISHU: 'Mozilla/5.0 EnterpriseIntegrationFixture Feishu/7.0',
  WECHAT_ENTERPRISE_V2:
    'Mozilla/5.0 EnterpriseIntegrationFixture MicroMessenger/8.0 wxwork/4.0',
};
const LABELS: Record<EnterpriseProvider, string> = {
  DINGTALK_V2: '钉钉',
  FEISHU: '飞书',
  WECHAT_ENTERPRISE_V2: '企业微信',
};
const SDK_URL =
  'https://g.alicdn.com/dingding/dingtalk-jsapi/3.0.3/dingtalk.open.js';

// 只连接专用回环测试环境，配置不得指向真实企业或生产站点。
export function requireFixtureOrigin(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    !url.port ||
    url.username ||
    url.password
  )
    throw new Error('企业浏览器验收只允许专用回环 HTTP 服务');
  return url.origin;
}
export async function control<T>(
  vendorUrl: string,
  path: string,
  data?: unknown,
): Promise<T> {
  const response = await fetch(`${requireFixtureOrigin(vendorUrl)}${path}`, {
    signal: AbortSignal.timeout(30_000),
    method: data === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`测试控制服务异常：${response.status}`);
  return response.json() as Promise<T>;
}
export async function loadFixtureConfig(): Promise<EnterpriseFixtureConfig> {
  const config = await control<EnterpriseFixtureConfig>(
    process.env.ENTERPRISE_VENDOR_URL || 'http://127.0.0.1:18093',
    '/control/config',
  );
  config.baseUrl = requireFixtureOrigin(config.baseUrl);
  config.vendorUrl = requireFixtureOrigin(config.vendorUrl);
  for (const account of Object.values(config.accounts))
    account.userId ||= String(
      (account as FixtureAccount & { userid?: string }).userid || '',
    );
  return config;
}
function deferred<T>() {
  let resolve: (value?: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = (value?: T) => done(value as T);
  });
  return { promise, resolve };
}
async function waitForNode<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(`等待交互节点超时：${label}；查看脱敏 JSON 网络证据`),
            ),
          20_000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
function safeRuntimeMessage(value: string): string {
  if (/^net::[A-Z_]+$/.test(value)) return value;
  if (/intlify|translate|locale messages/i.test(value)) return 'I18N_FALLBACK';
  if (/attribute d:|<path>/.test(value)) return 'INVALID_SVG_PATH';
  if (
    /failed.*fetch|Loading chunk|import.*module|module.*import|404|504/i.test(
      value,
    )
  )
    return 'MODULE_OR_RESOURCE_LOAD_FAILURE';
  if (/pinia/i.test(value)) return 'STORE_CONTEXT_FAILURE';
  if (/authorization|token|jwt|未登录|权限/i.test(value))
    return 'AUTH_OR_CREDENTIAL_FAILURE';
  return 'RUNTIME_DIAGNOSTIC_UNCLASSIFIED';
}
function unwrap(payload: any): any {
  return payload?.data && typeof payload.data === 'object'
    ? payload.data
    : payload;
}

// 自定义证据只保留路径、字段名、状态和测试事务 ID；不保存原始响应或令牌。
export class EnterpriseBrowserRun {
  callbackUrl = '';
  readonly config: EnterpriseFixtureConfig;
  readonly context: BrowserContext;
  created = deferred<{ id: string; purpose: string }>();
  readonly events: Array<Record<string, unknown>> = [];
  exchangeFinished = deferred<undefined>();
  exchangeReached = deferred<undefined>();
  readonly page: Page;
  pending = deferred<undefined>();
  readonly provider: EnterpriseProvider;
  sessionFingerprint = '';
  transactionId = '';
  userId = '';
  get label(): string {
    return (
      this.observedLabels[this.provider] ||
      this.config.providerLabels?.[this.provider] ||
      LABELS[this.provider]
    );
  }
  private evidenceWrites = Promise.resolve();
  private holdExchange = true;
  private inAppAuthorization: null | {
    body: { code: string; state: string };
    url: string;
  } = null;
  private readonly observedLabels: Partial<Record<EnterpriseProvider, string>> =
    {};
  private pendingExpiresAt = 0;
  private pendingOwner = '';
  private permitCallback = deferred<undefined>();
  private permitExchange = deferred<undefined>();
  private permitSupplier = deferred<undefined>();

  private phaseBaseline: null | SafeSnapshot = null;
  private supplierIssued = deferred<undefined>();
  private supplierMode: SupplierMode = 'success';
  private readonly traceId = Date.now().toString(36);
  private constructor(
    context: BrowserContext,
    page: Page,
    provider: EnterpriseProvider,
    config: EnterpriseFixtureConfig,
  ) {
    this.context = context;
    this.page = page;
    this.provider = provider;
    this.config = config;
  }
  static async create(
    browser: Browser,
    config: EnterpriseFixtureConfig,
    provider: EnterpriseProvider,
  ): Promise<EnterpriseBrowserRun> {
    const context = await browser.newContext({
      baseURL: config.baseUrl,
      userAgent: USER_AGENTS[provider],
      serviceWorkers: 'block',
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    const run = new EnterpriseBrowserRun(context, page, provider, config);
    await run.install();
    return run;
  }
  async approve(): Promise<void> {
    this.permitSupplier.resolve();
    const click =
      this.provider === 'FEISHU'
        ? this.page
            .getByTestId(
              this.supplierMode === 'deny' ? 'vendor-deny' : 'vendor-approve',
            )
            .click({ noWaitAfter: true })
        : Promise.resolve();
    await waitForNode(this.supplierIssued.promise, '供应商授权响应');
    await this.checkpoint('供应商授权响应后、callback 前');
    this.permitCallback.resolve();
    await click;
  }
  async assertCompletedBeforeExchange(): Promise<SafeSnapshot> {
    await waitForNode(this.exchangeReached.promise, '真实兑换请求前');
    const snapshot = await this.checkpoint('平台认证后、兑换前 COMPLETED');
    expect(snapshot.transaction?.status).toBe('COMPLETED');
    expect(snapshot.transaction?.hasProof).toBe(true);
    expect(snapshot.transaction?.hasSupplierCode).toBe(false);
    expect(snapshot.transaction?.hasProviderToken).toBe(false);
    expect(snapshot.transaction?.userId).toBe(
      this.pendingOwner || this.config.accounts.primary.userId,
    );
    this.assertLiveIndexes(snapshot);
    expect(
      Date.now() + Number(snapshot.transaction?.idTtlMillis),
    ).toBeLessThanOrEqual(this.pendingExpiresAt + 2000);
    return snapshot;
  }
  async assertDestination(marker: string, userId: string): Promise<void> {
    await this.page.waitForURL(
      (url) =>
        url.pathname === '/index' &&
        url.searchParams.get('from') === marker &&
        url.searchParams.get('tab') === 'details',
    );
    await expect
      .poll(async () => {
        await this.observeApplicationIdentity();
        return this.userId;
      })
      .toBe(userId);
    expect(
      this.events.some(
        (event) =>
          event.authorization === true &&
          String(event.path).endsWith('/rbac/userInfo'),
      ),
    ).toBe(true);
    await waitForNode(this.exchangeFinished.promise, '真实兑换响应完成');
    const consumed = await this.checkpoint('兑换后恢复业务深链');
    expect(consumed.transaction).toBeNull();
    expect(consumed.redis?.transactionIndexes).toEqual({
      idCount: 0,
      stateCount: 0,
    });
    this.assertSessionOwner(consumed, userId);
    await expect(this.page.locator('vite-error-overlay')).toHaveCount(0);
  }
  async assertPending(): Promise<SafeSnapshot> {
    const transaction = await waitForNode(
      this.created.promise,
      '真实创建事务响应',
    );
    this.transactionId = transaction.id;
    await waitForNode(this.pending.promise, '供应商授权页或 JSAPI 请求');
    const cookies = await this.context.cookies();
    expect(
      cookies.some(
        (cookie) => cookie.name === 'OAK_SOCIAL_LOGIN' && cookie.httpOnly,
      ),
    ).toBe(true);
    const snapshot = await this.checkpoint('创建后 PENDING');
    expect(snapshot.transaction?.status).toBe('PENDING');
    expect(snapshot.transaction?.mode).toBe('IN_APP');
    expect(snapshot.transaction?.hasProof).toBe(false);
    expect(snapshot.transaction?.hasSupplierCode).toBe(false);
    expect(snapshot.transaction?.hasProviderToken).toBe(false);
    this.assertLiveIndexes(snapshot);
    this.pendingExpiresAt =
      Date.now() + Number(snapshot.transaction?.idTtlMillis);
    this.pendingOwner =
      snapshot.transaction?.purpose === 'BIND'
        ? snapshot.transaction.userId || ''
        : '';
    // 创建动作只能写Redis事务，不得改动用户、绑定或签发会话。
    if (!this.phaseBaseline) throw new Error('缺少本阶段创建前事实');
    for (const key of ['users', 'bindings'] as const) {
      const order = (a: { id: string }, b: { id: string }) =>
        a.id.localeCompare(b.id);
      expect(snapshot.db[key].toSorted(order)).toEqual(
        this.phaseBaseline.db[key].toSorted(order),
      );
    }
    const sessions = (value: SafeSnapshot) =>
      value.redis?.sessionProofs
        ?.map(({ credentialFingerprint, ownerUserId }) => ({
          credentialFingerprint,
          ownerUserId,
        }))
        .toSorted((a, b) =>
          a.credentialFingerprint.localeCompare(b.credentialFingerprint),
        );
    expect(Array.isArray(sessions(this.phaseBaseline))).toBe(true);
    expect(sessions(snapshot)).toEqual(sessions(this.phaseBaseline));
    return snapshot;
  }
  assertSessionOwner(snapshot: SafeSnapshot, userId: string): void {
    // 将真实浏览器认证头的不可认证摘要与Redis索引属主关联，不以全局数量推断身份。
    expect(this.sessionFingerprint).toMatch(/^[a-f0-9]{64}$/);
    const proof = snapshot.redis?.sessionProofs?.find(
      (item) => item.credentialFingerprint === this.sessionFingerprint,
    );
    expect(proof?.ownerUserId).toBe(userId);
    expect(Number(proof?.ttlMillis)).toBeGreaterThan(0);
  }
  async checkpoint(name: string): Promise<SafeSnapshot> {
    const snapshot = await this.snapshot();
    if (
      !Number.isInteger(snapshot.supplier?.issuedCodeCount) ||
      !Number.isInteger(snapshot.supplier?.consumedCodeCount)
    )
      throw new Error('供应商测试快照缺少真实整数计数');
    this.events.push({
      checkpoint: name,
      transactionId: this.transactionId,
      location: {
        pathname: new URL(this.page.url()).pathname,
        queryKeys: [...new URL(this.page.url()).searchParams.keys()],
        hasTemporaryAuthorization: [
          'oauthInAppCode',
          'oauthInAppState',
          'oauthBindCallback',
        ].some((key) => new URL(this.page.url()).searchParams.has(key)),
      },
      transaction: {
        id: snapshot.transaction?.id,
        status: snapshot.transaction?.status,
        mode: snapshot.transaction?.mode,
        purpose: snapshot.transaction?.purpose,
        hasProof: snapshot.transaction?.hasProof,
        hasSupplierCode: snapshot.transaction?.hasSupplierCode,
        hasProviderToken: snapshot.transaction?.hasProviderToken,
        indexesAgree: snapshot.transaction?.indexesAgree,
        idTtlMillis: snapshot.transaction?.idTtlMillis,
        stateTtlMillis: snapshot.transaction?.stateTtlMillis,
      },
      db: {
        userCount: snapshot.db.userCount,
        bindingOwners: snapshot.db.bindings.map(
          ({ innerUserId, provider }) => ({
            isPrimary: innerUserId === this.config.accounts.primary.userId,
            isOther: innerUserId === this.config.accounts.other.userId,
            provider,
          }),
        ),
        auditCount: snapshot.db.auditCount,
        bindingFacts: snapshot.db.bindings,
        userFacts: snapshot.db.users,
      },
      redis: {
        sessionCount: snapshot.redis?.sessionCount,
        transactionIdCount: snapshot.redis?.transactionIdCount,
        transactionStateCount: snapshot.redis?.transactionStateCount,
        transactionIndexes: snapshot.redis?.transactionIndexes,
        sessionProofs: snapshot.redis?.sessionProofs,
      },
      supplier: {
        consumedCodeCount: snapshot.supplier?.consumedCodeCount,
        issuedCodeCount: snapshot.supplier?.issuedCodeCount,
        paths: snapshot.supplier?.requests?.map((request) => request.path),
      },
    });
    this.queueEvidence();
    return snapshot;
  }
  async close(): Promise<void> {
    this.permitSupplier.resolve();
    this.permitCallback.resolve();
    this.releaseExchange();
    await this.context.close();
  }
  async groupLink(marker: string): Promise<void> {
    await this.page.goto(
      `/index?from=${encodeURIComponent(marker)}&tab=details`,
      { waitUntil: 'domcontentloaded' },
    );
  }
  newPhase(): void {
    this.created = deferred<{ id: string; purpose: string }>();
    this.pending = deferred<undefined>();
    this.exchangeReached = deferred<undefined>();
    this.exchangeFinished = deferred<undefined>();
    this.permitSupplier = deferred<undefined>();
    this.permitExchange = deferred<undefined>();
    this.supplierIssued = deferred<undefined>();
    this.permitCallback = deferred<undefined>();
    this.holdExchange = true;
    this.transactionId = '';
    this.callbackUrl = '';
    this.inAppAuthorization = null;
    this.pendingExpiresAt = 0;
    this.pendingOwner = '';
  }
  async observeApplicationIdentity(): Promise<void> {
    // 整页回跳先等待真实已登录布局挂载，不能在Pinia初始化前读取测试观察点。
    await expect(this.page.locator('.header-user-dropdown')).toBeVisible();
    // 只读取应用实际正常请求、验签解密后存入的公开 User store；不写入状态或注入凭据。
    const publicStores = fileURLToPath(
      new URL('../../../../../packages/runtime/src/stores.ts', import.meta.url),
    );
    const entry = `${this.config.baseUrl}/@fs${publicStores}`;
    const identity = await this.page.evaluate(async (moduleUrl) => {
      const stores = await import(moduleUrl);
      const user = stores.useUserStore().userInfo;
      return {
        id: String(user?.id || user?.userId || ''),
        username: String(user?.username || ''),
        realName: String(user?.realName || ''),
      };
    }, entry);
    this.userId = identity.id;
    if (identity.id) {
      const label = identity.realName || identity.username;
      await expect(
        this.page.getByText(label, { exact: true }).first(),
      ).toBeVisible();
      this.events.push({
        applicationIdentity: {
          isPrimary: identity.id === this.config.accounts.primary.userId,
          isOther: identity.id === this.config.accounts.other.userId,
          visibleUserLabel: true,
        },
      });
      this.queueEvidence();
    }
  }
  releaseExchange(): void {
    this.holdExchange = false;
    this.permitExchange.resolve();
  }
  async replayCodeAuthorization(): Promise<void> {
    if (!this.inAppAuthorization) throw new Error('没有捕获实际钉钉授权请求');
    // 仅重放本次真实一次性 code 的请求，不注入本地 token，不修改业务 API 响应。
    await this.page.evaluate(async ({ url, body }) => {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
    }, this.inAppAuthorization);
  }
  async saveEvidence(name: string): Promise<void> {
    const directory =
      process.env.ENTERPRISE_EVIDENCE_DIR || '/tmp/enterprise-inapp-browser';
    await mkdir(directory, { recursive: true });
    const safeName = name.replaceAll(/[^\w\u4E00-\u9FA5-]/g, '-');
    await writeFile(
      join(directory, `${safeName}.json`),
      JSON.stringify(this.events, null, 2),
    );
    try {
      await this.page.screenshot({
        path: join(directory, `${safeName}.png`),
        fullPage: false,
        timeout: 5000,
      });
    } catch {
      // 失败场景仍保留Node网络和数据库证据，不以截图异常覆盖原断言。
      this.events.push({ screenshotUnavailable: true });
    }
  }
  async scenario(
    mode: SupplierMode,
    externalUser: 'bound' | 'unbound' = 'bound',
  ): Promise<void> {
    await control(this.config.vendorUrl, '/control/reset', {});
    await control(this.config.vendorUrl, '/control/scenario', {
      provider: this.provider,
      mode,
      externalUser,
    });
    this.supplierMode = mode;
    this.phaseBaseline = await this.snapshot();
  }
  async snapshot(): Promise<SafeSnapshot> {
    return control(
      this.config.vendorUrl,
      `/control/snapshot${this.transactionId ? `?transactionId=${encodeURIComponent(this.transactionId)}` : ''}`,
    );
  }
  async waitForProviderLabel(): Promise<string> {
    await expect
      .poll(() => Boolean(this.observedLabels[this.provider]))
      .toBe(true);
    return this.observedLabels[this.provider] || this.provider;
  }
  private assertLiveIndexes(snapshot: SafeSnapshot): void {
    // 每个节点必须有完整且一致的两个索引，缺少字段不能静默通过。
    expect(snapshot.transaction?.indexesAgree).toBe(true);
    expect(snapshot.redis?.transactionIndexes).toEqual({
      idCount: 1,
      stateCount: 1,
    });
    for (const ttl of [
      snapshot.transaction?.idTtlMillis,
      snapshot.transaction?.stateTtlMillis,
    ]) {
      expect(Number.isInteger(ttl)).toBe(true);
      expect(Number(ttl)).toBeGreaterThan(0);
      expect(Number(ttl)).toBeLessThanOrEqual(300_000);
    }
  }

  private async install(): Promise<void> {
    this.page.on('pageerror', (error) => {
      this.events.push({
        pageErrorType: error.name,
        safeMessage: safeRuntimeMessage(error.message),
      });
      this.queueEvidence();
    });
    this.page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) {
        this.events.push({
          consoleType: message.type(),
          safeMessage: safeRuntimeMessage(message.text()),
        });
        this.queueEvidence();
      }
    });
    this.context.on('requestfailed', (request) => {
      this.events.push({
        resourceFailure: {
          path: new URL(request.url()).pathname,
          resourceType: request.resourceType(),
          failure: safeRuntimeMessage(request.failure()?.errorText || ''),
        },
      });
      this.queueEvidence();
    });
    this.context.on('request', (request) => {
      const url = new URL(request.url());
      if (
        url.origin !== this.config.baseUrl ||
        !url.pathname.includes('/oauth/')
      )
        return;
      if (/\/inApp\/callback\//.test(url.pathname))
        this.callbackUrl = request.url();
      if (
        /\/inApp\/transactions\/[^/]+\/authorize$/.test(url.pathname) &&
        request.method() === 'POST'
      ) {
        const body = request.postDataJSON();
        this.inAppAuthorization = {
          url: request.url(),
          body: { code: body.code, state: body.state },
        };
      }
    });
    this.context.on('response', async (response) => {
      const url = new URL(response.url());
      if (
        url.origin !== this.config.baseUrl ||
        !/oauth|rbac\/userInfo|tenantSiteInfo|loginVerifyChallenge|getLoginOptions/.test(
          url.pathname,
        )
      )
        return;
      const request = response.request();
      // 创建响应在真实透传 route 中观察，避免整页跳转使 Chromium 丢失 body。
      if (
        /\/oauth\/inApp\/transactions$/.test(url.pathname) &&
        request.method() === 'POST'
      )
        return;
      let data: any;
      let rawEnvelope: any;
      try {
        rawEnvelope = await response.json();
        data = unwrap(rawEnvelope);
      } catch {
        /* 重定向响应不读取原始正文。 */
      }
      let authorization = false;
      try {
        const headers = await request.allHeaders();
        authorization = Boolean(headers.authorization);
        if (url.pathname.endsWith('/rbac/userInfo') && headers.authorization) {
          const token = headers.authorization.replace(/^Bearer\s+/i, '');
          this.sessionFingerprint = createHash('sha256')
            .update(`enterprise-interaction-test-session\0${token}`)
            .digest('hex');
        }
      } catch {
        /* 测试上下文结束时不记录原始网络异常。 */
      }
      const location = response.headers().location;
      if (location && response.status() >= 300 && response.status() < 400) {
        const redirect = new URL(location, response.url());
        const requestHeaders = await request.allHeaders();
        this.events.push({
          redirect: {
            requestPath: url.pathname,
            requestMethod: request.method(),
            status: response.status(),
            browserCookiePresent: Boolean(
              requestHeaders.cookie?.includes('OAK_SOCIAL_LOGIN='),
            ),
            targetOrigin: redirect.origin,
            targetPath: redirect.pathname,
            queryKeys: [...redirect.searchParams.keys()],
          },
        });
      }
      this.events.push({
        path: url.pathname,
        method: request.method(),
        status: response.status(),
        keys: data && typeof data === 'object' ? Object.keys(data) : [],
        authorization,
      });
      if (/\/oauth\/transactions\/[^/]+\/exchange$/.test(url.pathname))
        this.exchangeFinished.resolve();
      if (url.pathname.endsWith('/rbac/userInfo')) {
        const envelope =
          data && typeof data === 'object' && 'data' in data
            ? data
            : rawEnvelope;
        const code = envelope?.code;
        this.events.push({
          protectedUserInfo: {
            successful:
              typeof envelope?.successful === 'boolean'
                ? envelope.successful
                : undefined,
            code:
              typeof code === 'number' ||
              (typeof code === 'string' && /^[\w-]{1,50}$/.test(code))
                ? code
                : undefined,
            dataType: typeof envelope?.data,
            transportEncrypted: Boolean(
              response.headers()['x-urlacl-crypto-algorithm'],
            ),
          },
        });
      }
      if (url.pathname.includes('getLoginOptions'))
        this.events.push({
          loginOptions: {
            enableThirdLogin: data?.enableThirdLogin,
            enableUserRegister: data?.enableUserRegister,
            enableThirdRegister: data?.enableThirdRegister,
          },
        });
      if (url.pathname.includes('getSupportedPlatforms')) {
        const platforms = Array.isArray(data)
          ? data
          : data?.items || data?.records || [];
        for (const platform of platforms) {
          const code = String(
            platform.code ||
              platform.platform ||
              platform.id ||
              platform.name ||
              '',
          )
            .trim()
            .toUpperCase() as EnterpriseProvider;
          if (code === this.provider)
            this.observedLabels[code] = resolveOAuthPlatformName(platform);
        }
        this.events.push({
          platforms: platforms.map((platform: any) => ({
            code: platform.code || platform.platform,
            oauth: platform.capabilities?.oauth,
            inAppLogin: platform.capabilities?.inAppLogin,
          })),
        });
      }
      this.queueEvidence();
    });

    // 真实服务器创建事务后，在原响应交给浏览器前读取事实；不修改 body/headers/Set-Cookie。
    await this.context.route(
      (url) =>
        url.origin === this.config.baseUrl &&
        /\/oauth\/inApp\/transactions$/.test(url.pathname),
      async (route) => {
        if (route.request().method() !== 'POST') {
          await route.continue();
          return;
        }
        const actual = await route.fetch({ maxRedirects: 0 });
        const data = unwrap(await actual.json());
        const headers = await route.request().allHeaders();
        const id = String(data?.transactionId || data?.id || '');
        this.events.push({
          path: new URL(route.request().url()).pathname,
          method: 'POST',
          status: actual.status(),
          keys: data && typeof data === 'object' ? Object.keys(data) : [],
          authorization: Boolean(headers.authorization),
          transactionId: id,
        });
        if (id) {
          this.transactionId = id;
          this.created.resolve({ id, purpose: String(data.purpose || '') });
        }
        this.queueEvidence();
        await route.fulfill({ response: actual });
      },
    );

    // 生产授权 URL 仍来自真实后端，仅把严格匹配的供应商请求交给模拟服务器。
    await this.context.route(
      (url) =>
        (url.hostname === 'accounts.feishu.cn' &&
          ['/approve', '/open-apis/authen/v1/authorize'].includes(
            url.pathname,
          )) ||
        (url.hostname === 'open.weixin.qq.com' &&
          url.pathname === '/connect/oauth2/authorize'),
      async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/authorize')) this.pending.resolve();
        await this.permitSupplier.promise;
        const upstream = await route.fetch({
          url: `${this.config.vendorUrl}${url.pathname}${url.search}`,
          maxRedirects: 0,
        });
        if (
          url.pathname === '/approve' ||
          (url.hostname === 'open.weixin.qq.com' &&
            url.pathname.endsWith('/authorize'))
        ) {
          // 企微基础授权是静默GET直接302，飞书通过授权页表单；两者都先检查真实节点再放行回调。
          const location = upstream.headers().location;
          const redirect = location
            ? new URL(location, this.config.vendorUrl)
            : null;
          this.events.push({
            supplierRedirect: {
              requestPath: url.pathname,
              requestMethod: route.request().method(),
              status: upstream.status(),
              targetOrigin: redirect?.origin,
              targetPath: redirect?.pathname,
              queryKeys: redirect ? [...redirect.searchParams.keys()] : [],
            },
          });
          this.queueEvidence();
          this.supplierIssued.resolve();
          await this.permitCallback.promise;
        }
        await route.fulfill({ response: upstream });
      },
    );
    // 钉钉官方脚本边界使用外部 fixture code；本地登录、用户及令牌 API 一律实请求。
    await this.context.route(SDK_URL, async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `(function(){let nativeReady=false;window.dd={ready:function(callback){setTimeout(function(){nativeReady=true;callback()},50)},error:function(){},runtime:{permission:{requestAuthCode:function(options){if(!nativeReady){options.onFail({});return}fetch(${JSON.stringify(`${this.config.vendorUrl}/bridge`)}+'?corpId='+encodeURIComponent(options.corpId)).then(function(response){if(!response.ok)throw new Error('supplier bridge denied');return response.json()}).then(function(value){options.onSuccess({code:value.code})}).catch(function(){options.onFail({})})}}}}})();`,
      }),
    );
    await this.context.route(
      (url) =>
        url.origin === this.config.vendorUrl && url.pathname === '/bridge',
      async (route) => {
        this.pending.resolve();
        await this.permitSupplier.promise;
        const upstream = await route.fetch({ maxRedirects: 0 });
        this.supplierIssued.resolve();
        await this.permitCallback.promise;
        await route.fulfill({ response: upstream });
      },
    );
    // 兑换请求只暂停顺序，随后原样继续；不伪造响应或登录会话。
    await this.context.route(
      (url) =>
        url.origin === this.config.baseUrl &&
        /\/oauth\/transactions\/[^/]+\/exchange$/.test(url.pathname),
      async (route: Route) => {
        if (this.holdExchange) {
          this.exchangeReached.resolve();
          await this.permitExchange.promise;
        }
        await route.continue();
      },
    );
  }

  private queueEvidence(): void {
    const directory =
      process.env.ENTERPRISE_EVIDENCE_DIR || '/tmp/enterprise-inapp-browser';
    const safeBody = JSON.stringify(this.events, null, 2);
    this.evidenceWrites = this.evidenceWrites
      .then(async () => {
        await mkdir(directory, { recursive: true });
        await writeFile(
          join(directory, `${this.provider}-${this.traceId}-network.json`),
          safeBody,
        );
      })
      .catch(() => {});
  }
}
