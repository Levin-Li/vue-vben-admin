import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  local: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}));
vi.mock('../request', () => ({
  requestClient: { get: mocks.get, post: mocks.post },
}));
vi.mock('../../../data-attr-policy', () => ({
  readDataAttrLocalPolicies: mocks.local,
}));
import { dataAttrPolicyService } from '../data-attr-policy-service';

describe('字段策略旧入口本地兼容', () => {
  it('resolve 与 snapshot 均只读取已注册本地声明，不发 HTTP', async () => {
    const local = { version: 1, policies: [] };
    mocks.local.mockReturnValue(local);
    const target = { method: 'POST', path: '/contract' };
    await expect(dataAttrPolicyService.resolve(target)).resolves.toBe(local);
    await expect(dataAttrPolicyService.snapshot()).resolves.toBe(local);
    expect(mocks.local.mock.calls).toEqual([[target], []]);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
