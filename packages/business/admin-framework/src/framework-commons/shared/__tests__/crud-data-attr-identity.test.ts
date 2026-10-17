import type { DataAttrPolicy } from '../../data-attr-policy';

import { flushPromises } from '@vue/test-utils';
import { effectScope, nextTick, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { configureDataAttrPolicyLoader } from '../../data-attr-policy';
import { useCrudDataAttrAccess } from '../crud-data-attr-access';

describe('外部身份更新后的属性组缓存', () => {
  it('身份签名改变会重新读取后端策略，不复用上个身份的allowed结论', async () => {
    const identity = ref('reader');
    const loader = vi.fn(async () => {
      const policy: DataAttrPolicy = {
        id: 'identity-fixture',
        operation: 'fixture:contract::update',
        methods: ['PUT'],
        pathPatterns: ['/Contract/update'],
        restricted: true,
        groups: [
          {
            id: 'finance',
            name: '财务信息',
            allowed: identity.value === 'writer',
          },
        ],
        requestRoots: [{ location: 'body', nodeId: 'dto', parameterIndex: 0 }],
        responseRoot: 'dto',
        viewRoots: { request: ['dto'], response: ['dto'] },
        nodes: {
          dto: {
            kind: 'object',
            fields: [
              {
                name: 'amount',
                wireName: 'amount',
                nodeId: 'value',
                groupIds: ['finance'],
              },
            ],
          },
          value: { kind: 'value' },
        },
      };
      return { version: 1, policies: [policy] };
    });
    configureDataAttrPolicyLoader(loader);
    const scope = effectScope();
    try {
      const access = scope.run(() =>
        useCrudDataAttrAccess(
          () => ({ apiBase: '/Contract', title: '合同', fields: [] }),
          () => '/Contract/list',
          () => identity.value,
        ),
      );
      if (!access) throw new Error('Missing access scope');
      await access.ensure('update');
      expect(access.allowed('update', 'input', 'amount')).toBe(false);
      const before = loader.mock.calls.length;
      identity.value = 'writer';
      await nextTick();
      await flushPromises();
      await access.ensure('update');
      expect(loader.mock.calls.length).toBeGreaterThan(before);
      expect(access.allowed('update', 'input', 'amount')).toBe(true);
    } finally {
      scope.stop();
    }
  });
});
