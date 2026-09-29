import { shallowMount } from '@vue/test-utils';
import { defineComponent, markRaw } from 'vue';

import { describe, expect, it } from 'vitest';

import WorkflowBusinessDetail from './workflow-business-detail.vue';

describe('授权业务详情', () => {
  it('注册的宿主详情接收完整作用域引用并保持只读', () => {
    const detailComponent = markRaw(
      defineComponent({
        props: {
          businessReference: { type: Object, required: true },
          readonly: Boolean,
        },
        template: '<div />',
      }),
    );
    const reference = {
      businessType: 'request',
      businessId: '1',
      tenantId: 't1',
      orgId: 'o1',
    };
    const wrapper = shallowMount(WorkflowBusinessDetail, {
      props: {
        components: { detail: detailComponent },
        detail: { ...reference, detailComponentKey: 'detail' },
      },
      global: {
        stubs: {
          'a-descriptions': true,
          'a-descriptions-item': true,
          'a-alert': true,
        },
      },
    });
    const child = wrapper.findComponent(detailComponent);
    expect(child.props('businessReference')).toEqual(reference);
    expect(child.props('readonly')).toBe(true);
  });
});
