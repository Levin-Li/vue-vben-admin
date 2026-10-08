import type {
  EnterpriseFixtureConfig,
  EnterpriseProvider,
  FixtureAccount,
  SafeSnapshot,
  SupplierMode,
} from './support/enterprise-inapp-fixture';

import { expect, test } from '@playwright/test';

import {
  control,
  EnterpriseBrowserRun,
  loadFixtureConfig,
} from './support/enterprise-inapp-fixture';

const PROVIDERS: EnterpriseProvider[] = [
  'FEISHU',
  'WECHAT_ENTERPRISE_V2',
  'DINGTALK_V2',
];
let fixture: EnterpriseFixtureConfig;

// IAB 不允许拦截 Document 响应，本套件使用已安装的独立 headless Chromium 补充。
test.beforeAll(async () => {
  fixture = await loadFixtureConfig();
});

function businessFacts(snapshot: SafeSnapshot) {
  // 角色、组织、属主、公司和绑定种类均参与零写入判定，排除正常的访问审计。
  return {
    users: [...snapshot.db.users]
      .map((item) => ({ ...item, roles: [...(item.roles || [])].toSorted() }))
      .toSorted((a, b) => a.id.localeCompare(b.id)),
    bindings: [...snapshot.db.bindings].toSorted((a, b) =>
      a.id.localeCompare(b.id),
    ),
  };
}
function assertBusinessUnchanged(
  before: SafeSnapshot,
  after: SafeSnapshot,
): void {
  expect(businessFacts(after)).toEqual(businessFacts(before));
}
function assertSessionsUnchanged(
  before: SafeSnapshot,
  after: SafeSnapshot,
): void {
  // TTL自然递减；凭据摘要和属主集合不变才证明没有额外签发会话。
  const facts = (snapshot: SafeSnapshot) =>
    snapshot.redis?.sessionProofs
      ?.map(({ credentialFingerprint, ownerUserId }) => ({
        credentialFingerprint,
        ownerUserId,
      }))
      .toSorted((a, b) =>
        a.credentialFingerprint.localeCompare(b.credentialFingerprint),
      );
  expect(Array.isArray(facts(before))).toBe(true);
  expect(facts(after)).toEqual(facts(before));
}

async function passwordLoginOnCurrentPage(
  run: EnterpriseBrowserRun,
  account: FixtureAccount,
): Promise<void> {
  // 用户在当前失败后的登录页面输入凭据，不跳转 URL 触发第二轮自动企业授权。
  await run.page.getByPlaceholder('请输入手机号或邮箱').fill(account.account);
  await run.page.getByPlaceholder('请输入登录密码').fill(account.password);
  const challenge = run.page.waitForResponse(
    (response) =>
      response.url().includes('loginVerifyChallenge') &&
      response.request().method() === 'POST' &&
      !response.url().includes('/complete'),
  );
  await run.page.getByRole('button', { name: /^登\s*录$/ }).click();
  const challengeResponse = await challenge;
  expect(challengeResponse.ok()).toBe(true);
  await expect
    .poll(async () => {
      await run.observeApplicationIdentity();
      return run.userId;
    })
    .toBe(account.userId);
  await expect
    .poll(() => new URL(run.page.url()).pathname)
    .not.toBe('/auth/login');
}
async function openBinding(run: EnterpriseBrowserRun): Promise<void> {
  await run.page.locator('.header-user-dropdown').click();
  await run.page
    .getByRole('menuitem', { name: '个人中心', exact: true })
    .click();
  await run.page
    .getByRole('tab', { name: '第三方账号绑定', exact: true })
    .click();
  const label = await run.waitForProviderLabel();
  await run.page.getByRole('button', { name: label, exact: true }).click();
  await run.page.getByRole('button', { name: '继续绑定', exact: true }).click();
}
async function expectFailure(
  run: EnterpriseBrowserRun,
  preservePending = false,
): Promise<void> {
  const rejectedStates = preservePending ? ['PENDING', 'FAILED'] : ['FAILED'];
  await expect
    .poll(async () => {
      const snapshot = await run.snapshot();
      return rejectedStates.includes(snapshot.transaction?.status || '');
    })
    .toBe(true);
  await expect(
    run.page
      .getByText(
        /普通登录|重新发起账号绑定|个人中心主动绑定|端内身份认证失败|第三方账号绑定未完成/,
      )
      .first(),
  ).toBeVisible({ timeout: 60_000 });
  expect(run.events.some((event) => event.pageErrorType)).toBe(false);
}
async function conclude(
  run: EnterpriseBrowserRun,
  name: string,
): Promise<void> {
  // 证据截图失败也必须释放门控和浏览器，避免掩盖原始断言结果。
  try {
    await run.saveEvidence(name);
  } finally {
    await run.close();
  }
}

for (const provider of PROVIDERS) {
  test.describe(`${provider} 群消息到真实后台会话`, () => {
    test('已绑定身份 LOGIN 按节点落库并恢复业务深链、已有会话不换号', async ({
      browser,
    }) => {
      const run = await EnterpriseBrowserRun.create(browser, fixture, provider);
      try {
        await run.scenario('success');
        const before = await run.checkpoint('打开群消息前');
        const marker = `${provider}-success`;
        await run.groupLink(marker);
        await run.assertPending();
        await run.approve();
        const completed = await run.assertCompletedBeforeExchange();
        assertBusinessUnchanged(before, completed);
        expect(completed.transaction?.hasProof).toBe(true);
        run.releaseExchange();
        await run.assertDestination(marker, fixture.accounts.primary.userId);
        const originalId = run.transactionId;
        const createCount = run.events.filter(
          (event) =>
            String(event.path).endsWith('/inApp/transactions') &&
            event.method === 'POST',
        ).length;
        await run.groupLink(`${provider}-existing-session`);
        await expect(run.page).toHaveURL(/from=.*existing-session/);
        await expect
          .poll(async () => {
            await run.observeApplicationIdentity();
            return run.userId;
          })
          .toBe(fixture.accounts.primary.userId);
        expect(run.transactionId).toBe(originalId);
        expect(
          run.events.filter(
            (event) =>
              String(event.path).endsWith('/inApp/transactions') &&
              event.method === 'POST',
          ),
        ).toHaveLength(createCount);
        const after = await run.checkpoint('已有本地会话不发起新授权');
        assertBusinessUnchanged(before, after);
        run.assertSessionOwner(after, fixture.accounts.primary.userId);
        expect(after.transaction).toBeNull();
        expect(Number.isInteger(after.redis?.transactionIdCount)).toBe(true);
        expect(Number.isInteger(after.redis?.transactionStateCount)).toBe(true);
        expect(run.events.some((event) => event.pageErrorType)).toBe(false);
      } finally {
        await conclude(run, `${provider}-LOGIN-success-existing-session`);
      }
    });

    test('未绑定失败后真实密码登录、个人中心弹窗主动 BIND 并回原业务页', async ({
      browser,
    }) => {
      const run = await EnterpriseBrowserRun.create(browser, fixture, provider);
      try {
        await run.scenario('success', 'unbound');
        const before = await run.checkpoint('未绑定场景前');
        await run.groupLink(`${provider}-unbound-bind`);
        await run.assertPending();
        await run.approve();
        await expectFailure(run);
        const denied = await run.checkpoint('未绑定不能创建用户或绑定');
        assertBusinessUnchanged(before, denied);
        assertSessionsUnchanged(before, denied);
        await passwordLoginOnCurrentPage(run, fixture.accounts.primary);
        const businessUrl = run.page.url();
        run.newPhase();
        await run.scenario('success', 'unbound');
        await openBinding(run);
        const pending = await run.assertPending();
        expect(pending.transaction?.purpose).toBe('BIND');
        await run.approve();
        await run.assertCompletedBeforeExchange();
        expect(new URL(run.page.url()).pathname).toBe(
          new URL(businessUrl).pathname,
        );
        expect(new URL(run.page.url()).searchParams.has('oauthInAppCode')).toBe(
          false,
        );
        expect(
          run.events.some(
            (event) =>
              String(event.path).endsWith('/authorize') &&
              event.authorization === true,
          ),
        ).toBe(true);
        run.releaseExchange();
        await expect(
          run.page.getByText('第三方账号绑定成功', { exact: true }),
        ).toBeVisible();
        const bound = await run.checkpoint('主动绑定已写入当前 User');
        expect(businessFacts(bound).users).toEqual(businessFacts(before).users);
        const added = bound.db.bindings.filter(
          (item) =>
            !before.db.bindings.some((original) => original.id === item.id),
        );
        expect(added).toHaveLength(1);
        expect(added[0]).toMatchObject({
          provider,
          innerUserId: fixture.accounts.primary.userId,
          companyRootId: fixture.rootId,
          kind: 'login',
          hasCredential: false,
        });
        expect(
          businessFacts({
            ...bound,
            db: {
              ...bound.db,
              bindings: bound.db.bindings.filter(
                (item) => item.id !== added[0]?.id,
              ),
            },
          }),
        ).toEqual(businessFacts(before));
        await expect
          .poll(async () => {
            await run.observeApplicationIdentity();
            return run.userId;
          })
          .toBe(fixture.accounts.primary.userId);
        expect(bound.transaction).toBeNull();
        expect(bound.redis?.transactionIndexes).toEqual({
          idCount: 0,
          stateCount: 0,
        });
        run.assertSessionOwner(bound, fixture.accounts.primary.userId);
      } finally {
        await conclude(run, `${provider}-unbound-password-modal-BIND`);
      }
    });

    for (const mode of [
      'deny',
      'error',
      'malformed',
      'expired',
      'wrong-state',
    ] as SupplierMode[]) {
      test(`授权 ${mode} 不登录、不写绑定，刷新不循环`, async ({ browser }) => {
        test.skip(
          provider === 'DINGTALK_V2' && mode === 'wrong-state',
          '钉钉 JSAPI 不返回平台 state；后端 POST 错误 state 由专用协议矩阵验证',
        );
        const run = await EnterpriseBrowserRun.create(
          browser,
          fixture,
          provider,
        );
        try {
          await run.scenario(mode);
          const before = await run.checkpoint('异常授权前');
          await run.groupLink(`${provider}-${mode}`);
          await run.assertPending();
          await run.approve();
          await expectFailure(
            run,
            mode === 'wrong-state' ||
              (provider === 'DINGTALK_V2' && mode === 'deny'),
          );
          const failedId = run.transactionId;
          const failed = await run.checkpoint('异常授权失败后');
          assertBusinessUnchanged(before, failed);
          assertSessionsUnchanged(before, failed);
          if (provider === 'DINGTALK_V2' && mode === 'deny') {
            // JSAPI onFail不提供code或回调；无证明PENDING只能自然过期，不能换取成员身份。
            expect(failed.transaction?.status).toBe('PENDING');
            expect(failed.transaction?.hasProof).toBe(false);
            expect(failed.supplier?.issuedCodeCount).toBe(0);
            expect(failed.supplier?.consumedCodeCount).toBe(0);
            expect(failed.supplier?.requests?.map((item) => item.path)).toEqual(
              ['/bridge'],
            );
          }
          await run.page.reload({ waitUntil: 'domcontentloaded' });
          await expect(
            run.page.getByRole('heading', { name: '欢迎回来', exact: true }),
          ).toBeVisible();
          await expect(
            run.page.getByPlaceholder('请输入登录密码'),
          ).toBeVisible();
          expect(run.transactionId).toBe(failedId);
        } finally {
          await conclude(run, `${provider}-LOGIN-${mode}`);
        }
      });
    }

    test('真实 Redis 事务过期后不交换供应商身份', async ({ browser }) => {
      const run = await EnterpriseBrowserRun.create(browser, fixture, provider);
      try {
        await run.scenario('success');
        const before = await run.checkpoint('事务过期场景前');
        await run.groupLink(`${provider}-redis-expired`);
        await run.assertPending();
        await control(fixture.vendorUrl, '/control/expire', {
          transactionId: run.transactionId,
        });
        await run.approve();
        await run.page.waitForURL(
          (url) =>
            url.origin === fixture.baseUrl && url.pathname === '/auth/login',
          { timeout: 60_000 },
        );
        await expect(
          run.page.getByRole('heading', { name: '欢迎回来', exact: true }),
        ).toBeVisible({ timeout: 60_000 });
        await expect(
          run.page.getByText(/普通登录|未完成|失效|重新发起|主动绑定/).first(),
        ).toBeVisible({ timeout: 60_000 });
        const after = await run.checkpoint('Redis 事务过期拒绝 callback');
        assertBusinessUnchanged(before, after);
        expect(after.transaction).toBeNull();
        assertSessionsUnchanged(before, after);
        expect(after.redis?.transactionIndexes).toEqual({
          idCount: 0,
          stateCount: 0,
        });
        expect(after.supplier?.consumedCodeCount).toBe(0);
      } finally {
        await conclude(run, `${provider}-Redis-transaction-expired`);
      }
    });

    test('已绑定身份通过真实个人中心弹窗幂等 BIND', async ({ browser }) => {
      const run = await EnterpriseBrowserRun.create(browser, fixture, provider);
      try {
        await run.scenario('deny');
        await run.groupLink(`${provider}-profile-bind`);
        await run.assertPending();
        await run.approve();
        await expectFailure(run, provider === 'DINGTALK_V2');
        await passwordLoginOnCurrentPage(run, fixture.accounts.primary);
        run.newPhase();
        await run.scenario('success');
        const before = await run.checkpoint('弹窗幂等绑定前');
        await openBinding(run);
        await run.assertPending();
        await run.approve();
        await run.assertCompletedBeforeExchange();
        expect(new URL(run.page.url()).pathname).toBe('/index');
        expect(new URL(run.page.url()).searchParams.has('oauthInAppCode')).toBe(
          false,
        );
        run.releaseExchange();
        await expect(
          run.page.getByText('第三方账号绑定成功', { exact: true }),
        ).toBeVisible();
        const after = await run.checkpoint('弹窗幂等绑定完成');
        assertBusinessUnchanged(before, after);
        await expect
          .poll(async () => {
            await run.observeApplicationIdentity();
            return run.userId;
          })
          .toBe(fixture.accounts.primary.userId);
        run.assertSessionOwner(after, fixture.accounts.primary.userId);
        expect(after.transaction).toBeNull();
        expect(after.redis?.transactionIndexes).toEqual({
          idCount: 0,
          stateCount: 0,
        });
      } finally {
        await conclude(run, `${provider}-modal-idempotent-BIND-success`);
      }
    });

    test('真实回调重放被拒绝且无新的认证业务副作用', async ({ browser }) => {
      const run = await EnterpriseBrowserRun.create(browser, fixture, provider);
      try {
        await run.scenario('success');
        await run.groupLink(`${provider}-replay`);
        await run.assertPending();
        await run.approve();
        await run.assertCompletedBeforeExchange();
        const replayUrl = run.callbackUrl;
        if (provider !== 'DINGTALK_V2') expect(Boolean(replayUrl)).toBe(true);
        run.releaseExchange();
        await run.assertDestination(
          `${provider}-replay`,
          fixture.accounts.primary.userId,
        );
        const before = await run.checkpoint('重放前');
        const fingerprintBeforeReplay = run.sessionFingerprint;
        await (provider === 'DINGTALK_V2'
          ? run.replayCodeAuthorization()
          : run.page.goto(replayUrl, { waitUntil: 'domcontentloaded' }));
        // 无效回调允许显示固定失败入口；重新打开业务链接仍须使用原来的真实会话。
        const rejected = await run.checkpoint('重放已被拒绝，业务入口恢复前');
        run.assertSessionOwner(rejected, fixture.accounts.primary.userId);
        await run.groupLink(`${provider}-replay`);
        await expect
          .poll(async () => {
            await run.observeApplicationIdentity();
            return run.userId;
          })
          .toBe(fixture.accounts.primary.userId);
        const after = await run.checkpoint('同一 callback 重放后');
        expect(after.db.bindings).toHaveLength(before.db.bindings.length);
        expect(after.supplier?.consumedCodeCount).toBe(
          before.supplier?.consumedCodeCount,
        );
        expect(
          after.supplier?.requests?.map((request) => request.path),
        ).toEqual(before.supplier?.requests?.map((request) => request.path));
        assertBusinessUnchanged(before, after);
        assertSessionsUnchanged(before, after);
        expect(after.transaction).toBeNull();
        expect(after.redis?.transactionIndexes).toEqual({
          idCount: 0,
          stateCount: 0,
        });
        run.assertSessionOwner(after, fixture.accounts.primary.userId);
        expect(run.sessionFingerprint).toBe(fingerprintBeforeReplay);
      } finally {
        await conclude(run, `${provider}-callback-replay`);
      }
    });

    test('绑定到另一个本地 User 被真实 owner 冲突检查拒绝', async ({
      browser,
    }) => {
      const run = await EnterpriseBrowserRun.create(browser, fixture, provider);
      try {
        await run.scenario('deny');
        await run.groupLink(`${provider}-conflict`);
        await run.assertPending();
        await run.approve();
        await expectFailure(run, provider === 'DINGTALK_V2');
        await passwordLoginOnCurrentPage(run, fixture.accounts.other);
        const before = await run.checkpoint('绑定冲突前');
        run.newPhase();
        await run.scenario('success');
        await openBinding(run);
        await run.assertPending();
        await run.approve();
        await expectFailure(run);
        const after = await run.checkpoint('绑定冲突拒绝后');
        assertBusinessUnchanged(before, after);
        assertSessionsUnchanged(before, after);
        expect(
          after.db.bindings.filter(
            (binding) =>
              binding.provider === provider &&
              binding.innerUserId === fixture.accounts.other.userId,
          ),
        ).toHaveLength(0);
        expect(new URL(run.page.url()).searchParams.has('oauthInAppCode')).toBe(
          false,
        );
      } finally {
        await conclude(run, `${provider}-BIND-owner-conflict-modal`);
      }
    });

    test('兑换暂停期间用户取消并密码登录，迟到企业结果不能换号', async ({
      browser,
    }) => {
      const run = await EnterpriseBrowserRun.create(browser, fixture, provider);
      try {
        await run.scenario('success');
        await run.groupLink(`${provider}-late-result`);
        await run.assertPending();
        await run.approve();
        await run.assertCompletedBeforeExchange();
        await run.page
          .getByRole('dialog')
          .getByRole('button', { name: /^取\s*消$/ })
          .click();
        await passwordLoginOnCurrentPage(run, fixture.accounts.other);
        const beforeLate =
          await run.checkpoint('本地登录已完成，释放迟到兑换前');
        const localFingerprint = run.sessionFingerprint;
        run.releaseExchange();
        await run.exchangeFinished.promise;
        await run.observeApplicationIdentity();
        expect(run.userId).toBe(fixture.accounts.other.userId);
        expect(run.sessionFingerprint).toBe(localFingerprint);
        const afterLate = await run.checkpoint('迟到企业兑换结果被丢弃');
        assertBusinessUnchanged(beforeLate, afterLate);
        run.assertSessionOwner(afterLate, fixture.accounts.other.userId);
        expect(afterLate.transaction).toBeNull();
        expect(afterLate.redis?.transactionIndexes).toEqual({
          idCount: 0,
          stateCount: 0,
        });
      } finally {
        await conclude(run, `${provider}-late-result-does-not-replace-user`);
      }
    });
  });
}
