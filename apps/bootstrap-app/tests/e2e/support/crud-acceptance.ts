import type { Locator, Page, TestInfo } from '@playwright/test';

import { expect } from '@playwright/test';

import {
  createCrudAcceptanceRun as createCoreCrudAcceptanceRun,
  type CrudAcceptanceRun,
} from './crud-acceptance-core';

export {
  assertRunScoped,
  exerciseCrudLifecycle,
  type CrudAcceptanceRun,
  type CrudCreatedRecord,
  type CrudLifecycleAdapter,
} from './crud-acceptance-core';

export const CRUD_ACCEPTANCE_ENABLE_ENV = 'PLAYWRIGHT_CRUD_ACCEPTANCE';

export interface RealLoginOptions {
  account?: string;
  password?: string;
  timeout?: number;
}

export function createCrudAcceptanceRun(
  testInfo?: TestInfo,
): CrudAcceptanceRun {
  return createCoreCrudAcceptanceRun(testInfo?.parallelIndex);
}

export function isCrudAcceptanceEnabled(): boolean {
  return process.env[CRUD_ACCEPTANCE_ENABLE_ENV] === '1';
}

/**
 * 使用当前登录页真实的 password -> loginVerifyChallenge -> complete 链路。
 * 本地登录页会预填开发账号；共享或远程环境必须用环境变量显式提供凭据。
 */
export async function loginViaCurrentPasswordChallenge(
  page: Page,
  options: RealLoginOptions = {},
): Promise<void> {
  const timeout = options.timeout ?? 30_000;
  const account = options.account ?? process.env.PLAYWRIGHT_CRUD_ACCOUNT;
  const password = options.password ?? process.env.PLAYWRIGHT_CRUD_PASSWORD;

  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });

  const accountInput = page.getByPlaceholder('请输入手机号或邮箱');
  const passwordInput = page.getByPlaceholder('请输入登录密码');
  await expect(accountInput).toBeVisible();
  await expect(passwordInput).toBeVisible();

  if (account) {
    await accountInput.fill(account);
  }
  if (password) {
    await passwordInput.fill(password);
  }

  const actualAccount = await accountInput.inputValue();
  const actualPassword = await passwordInput.inputValue();
  if (!actualAccount || !actualPassword) {
    throw new Error(
      '真实 CRUD 验收需要登录账号和密码：本地可使用登录页预填值，远程环境请设置 PLAYWRIGHT_CRUD_ACCOUNT 与 PLAYWRIGHT_CRUD_PASSWORD。',
    );
  }

  const challengeResponse = page.waitForResponse(
    (response) =>
      response.url().includes('loginVerifyChallenge') &&
      !response.url().includes('/complete') &&
      response.request().method() === 'POST',
    { timeout },
  );

  await page.getByRole('button', { name: /登\s*录/ }).click();
  const challenge = await challengeResponse;
  expect(challenge.ok()).toBe(true);

  await expect
    .poll(async () => !new URL(page.url()).pathname.startsWith('/auth/login'), {
      timeout,
    })
    .toBe(true);
}

/** 供页面适配器在操作后等待当前页面的成功反馈。 */
export async function expectCrudSuccess(
  page: Page,
  text: RegExp | string,
): Promise<void> {
  await expect(page.getByText(text, { exact: false }).last()).toBeVisible();
}

/**
 * 常见列表行定位器。页面适配器仍需先用 run.id 过滤，避免误操作用户数据。
 */
export function rowContainingRunValue(page: Page, runValue: string): Locator {
  return page
    .locator('tr, [role="row"], .vxe-body--row')
    .filter({ hasText: runValue })
    .first();
}
