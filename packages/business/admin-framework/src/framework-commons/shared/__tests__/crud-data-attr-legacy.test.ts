import { flushPromises } from '@vue/test-utils';
import { effectScope } from 'vue';

import { describe, expect, it } from 'vitest';

import {
  configureDataAttrPolicyLoader,
  isDataAttrPolicyEnabled,
  suspendDataAttrPolicies,
} from '../../data-attr-policy';
import { useCrudDataAttrAccess } from '../crud-data-attr-access';

describe('旧宿主与暂停状态的边界', () => {
  it('从未配置时沿用原行为，一旦启用后加载失败或暂停始终关闭', async () => {
    expect(isDataAttrPolicyEnabled()).toBe(false);
    const scope = effectScope();
    const access = scope.run(() =>
      useCrudDataAttrAccess(
        () => ({ apiBase: '/Contract', title: '合同', fields: [] }),
        () => '/Contract/list',
        () => 'legacy',
      ),
    );
    if (!access) throw new Error('Missing scoped access');
    expect(access.allowed('create', 'input', 'amount')).toBe(true);
    expect(access.pruneInput('create', { amount: 900 })).toEqual({
      amount: 900,
    });
    configureDataAttrPolicyLoader(async () => {
      throw new Error('权限服务不可用');
    });
    expect(access.allowed('create', 'input', 'amount')).toBe(false);
    await expect(access.ensure('create')).rejects.toThrow('权限服务不可用');
    suspendDataAttrPolicies();
    await flushPromises();
    expect(isDataAttrPolicyEnabled()).toBe(true);
    expect(access.allowed('create', 'input', 'amount')).toBe(false);
    await expect(access.ensure('create')).rejects.toThrow();
    scope.stop();
  });
});
