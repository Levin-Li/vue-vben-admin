import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { buildDetailDisplayEntries } from '../detail-display';
import DetailDisplayPanel from '../detail-display-panel.vue';

vi.mock('@vben/common-ui', () => ({
  JsonViewer: defineComponent({
    name: 'JsonViewer',
    props: {
      value: {
        default: undefined,
        required: false,
        type: null,
      },
    },
    setup(props) {
      return () =>
        h('div', { 'data-test': 'json-viewer' }, JSON.stringify(props.value));
    },
  }),
}));

describe('detail display panel', () => {
  it('renders JSON as a readonly textarea with a viewer entry', async () => {
    const entries = buildDetailDisplayEntries(
      {
        complexObject: { hidden: true },
        mode: 'A',
        setting: { enabled: true, limits: [1, 2] },
        statuses: ['A', 'B'],
      },
      [
        {
          key: 'mode',
          label: '模式',
          options: [
            { label: '模式 A', value: 'A' },
            { label: '模式 B', value: 'B' },
          ],
          type: 'select',
        },
        {
          fullRow: true,
          key: 'setting',
          label: '设置',
          type: 'json',
        },
        {
          key: 'statuses',
          label: '状态列表',
          multiple: true,
          options: [
            { label: '启用', value: 'A' },
            { label: '停用', value: 'B' },
          ],
          type: 'select',
        },
      ],
    );

    const wrapper = mount(DetailDisplayPanel, {
      attachTo: document.body,
      props: {
        entries,
      },
    });

    expect(wrapper.text()).toContain('模式 A');
    expect(wrapper.text()).toContain('启用, 停用');
    expect(wrapper.text()).toContain('查看 JSON');
    expect(wrapper.text()).not.toContain('complexObject');
    expect(wrapper.find('textarea[readonly]').exists()).toBe(true);
    expect(wrapper.find('textarea').element.value).toBe(
      '{"enabled":true,"limits":[1,2]}',
    );

    await wrapper.get('button').trigger('click');

    expect(document.body.textContent).toContain('设置');

    wrapper.unmount();
  });
});
