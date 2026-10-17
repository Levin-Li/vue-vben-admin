import { describe, expect, it, vi } from 'vitest';
const post = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ version: 1, policies: [] }),
);
vi.mock('../request', () => ({ requestClient: { post } }));
import { dataAttrPolicyService } from '../data-attr-policy-service';
import { getServiceMeta } from '../../../api-authorize';

describe('API字段策略服务来源', () => {
  it('绑定实际独立控制器并用完整固定入口读取策略', async () => {
    expect(getServiceMeta(dataAttrPolicyService).controllerClass).toBe(
      'com.levin.oak.base.web.dataattr.DataAttrPolicyController',
    );
    await dataAttrPolicyService.resolve({ method: 'POST', path: '/contract' });
    expect(post).toHaveBeenCalledWith(
      '/com.levin.oak.base/V1/api/rbac/apiDataAttrPolicies',
      { method: 'POST', path: '/contract' },
      { baseURL: '' },
    );
  });
});
