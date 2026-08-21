import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { Tooltip } from 'ant-design-vue';

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
  it('clamps detail values to two lines with wide tooltips', async () => {
    const entries = buildDetailDisplayEntries(
      {
        complexObject: { hidden: true },
        mfaQrCode: 'otpauth://totp/example?secret=ABC',
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
          key: 'mfaQrCode',
          label: 'MFA二维码',
          type: 'qrcode',
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
    expect(wrapper.text()).toContain('MFA二维码');
    expect(wrapper.text()).not.toContain('otpauth://totp/example?secret=ABC');
    expect(wrapper.text()).not.toContain('complexObject');
    expect(wrapper.find('textarea[readonly]').exists()).toBe(false);
    expect(wrapper.find('[data-test="detail-display-qrcode"]').exists()).toBe(
      true,
    );

    const valueBlocks = wrapper.findAll('[data-test="detail-display-value"]');
    expect(valueBlocks).toHaveLength(3);
    expect(
      valueBlocks.every((block) => block.classes().includes('line-clamp-2')),
    ).toBe(true);
    expect(valueBlocks[1].text()).toBe('{"enabled":true,"limits":[1,2]}');

    const tooltips = wrapper.findAllComponents(Tooltip);
    expect(tooltips).toHaveLength(3);
    expect(
      tooltips.every(
        (tooltip) =>
          tooltip.props('overlayClassName') === 'crud-detail-display-tooltip',
      ),
    ).toBe(true);
    expect(
      tooltips.every((tooltip) => tooltip.props('mouseEnterDelay') === 1),
    ).toBe(true);

    await valueBlocks[1].trigger('mouseenter');
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const tooltipInner = document.body.querySelector(
      '.crud-detail-display-tooltip .ant-tooltip-inner',
    );
    expect(tooltipInner?.textContent).toContain(
      '{"enabled":true,"limits":[1,2]}',
    );

    await wrapper.get('button').trigger('click');

    expect(document.body.textContent).toContain('设置');

    wrapper.unmount();
  });
});
