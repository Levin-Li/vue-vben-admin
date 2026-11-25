import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { it } from 'vitest';

import { scanAgentApiCandidates } from './scan-agent-api-candidates.mjs';

it('扫描业务服务的声明方法并保持候选不可执行', async () => {
  const result = await scanAgentApiCandidates();
  assert.ok(
    result.files.some((file) => file.endsWith('/api/customer-service.ts')),
  );
  assert.ok(
    result.files.some(
      (file) =>
        file.includes('/admin-framework/') && file.endsWith('-service.ts'),
    ),
  );
  assert.ok(
    result.candidates.some(
      (entry) =>
        entry.owner === 'CustomerService' &&
        entry.method === 'list' &&
        entry.title === '客户' &&
        entry.controllerClass ===
          'com.levin.oak.base.controller.BizCustomerController' &&
        entry.permissionMetadata,
    ),
  );
  assert.ok(
    result.candidates.some(
      (entry) => entry.owner === 'CustomerService' && entry.method === 'update',
    ),
  );
  assert.ok(result.candidates.every((entry) => entry.executable === false));
  assert.ok(
    result.candidates.some(
      (entry) =>
        entry.owner === 'invitationRegisterService' &&
        entry.method === 'redeem',
    ),
  );
  assert.ok(
    result.candidates.some(
      (entry) =>
        entry.owner === 'OakWorkflowRuntimeService' &&
        entry.inheritedFrom === 'WorkflowRuntimeService',
    ),
  );
  assert.ok(
    !result.candidates.some(
      (entry) =>
        entry.owner === 'CustomerService' &&
        entry.method === 'buildRequestPath',
    ),
  );
  assert.deepEqual(result, await scanAgentApiCandidates());
});

it('继承、覆盖、计算名称与动态对象均不会静默遗漏', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'agent-api-scan-'));
  try {
    const api = path.join(dir, 'api');
    await mkdir(api);
    await writeFile(
      path.join(api, 'base-service.ts'),
      `
      export class Base { list() {} protected hidden() {} action = () => 1; }
      export const objectService = { go() {}, ...runtime };
    `,
    );
    await writeFile(
      path.join(api, 'child-service.ts'),
      `
      export class Child extends Base { list() {} [dynamicName]() {} }
    `,
    );
    await writeFile(
      path.join(api, 'js-service.js'),
      'export function readItem(id) { return id; }',
    );
    const result = await scanAgentApiCandidates({
      repoRoot: dir,
      businessRoot: dir,
    });
    const child = result.candidates.filter((entry) => entry.owner === 'Child');
    assert.equal(child.filter((entry) => entry.method === 'list').length, 1);
    assert.ok(
      child.some(
        (entry) => entry.method === 'action' && entry.inheritedFrom === 'Base',
      ),
    );
    assert.ok(child.some((entry) => entry.dynamic));
    assert.ok(!child.some((entry) => entry.method === 'hidden'));
    assert.ok(
      result.unresolved.some((entry) => entry.owner === 'objectService'),
    );
    assert.ok(result.candidates.some((entry) => entry.method === 'readItem'));
    assert.ok(result.candidates.every((entry) => entry.executable === false));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
