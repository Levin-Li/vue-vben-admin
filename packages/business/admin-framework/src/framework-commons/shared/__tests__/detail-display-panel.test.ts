import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';

import { Tag, Tooltip } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import {
  getCrudGroupTitleClass,
  normalizeCrudGroupDisplayStyle,
} from '../crud-group-display';
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

describe('公共详情展示', () => {
  it('保留标签与二维码，并通过独立查看器阅读 JSON', async () => {
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
    expect(wrapper.text()).toContain('启用');
    expect(wrapper.text()).toContain('停用');
    expect(wrapper.text()).toContain('查看 JSON');
    expect(wrapper.text()).toContain('MFA二维码');
    expect(wrapper.text()).not.toContain('otpauth://totp/example?secret=ABC');
    expect(wrapper.text()).not.toContain('complexObject');
    expect(wrapper.find('textarea[readonly]').exists()).toBe(false);
    expect(wrapper.find('[data-test="detail-display-qrcode"]').exists()).toBe(
      true,
    );

    const valueBlocks = wrapper.findAll('[data-test="detail-display-value"]');
    expect(valueBlocks).toHaveLength(2);
    expect(
      valueBlocks.every((block) => block.classes().includes('line-clamp-2')),
    ).toBe(true);
    expect(valueBlocks[1].text()).toBe('{"enabled":true,"limits":[1,2]}');

    const tooltips = wrapper.findAllComponents(Tooltip);
    expect(tooltips).toHaveLength(1);
    expect(
      tooltips.every(
        (tooltip) =>
          tooltip.props('overlayClassName') === 'crud-detail-display-tooltip',
      ),
    ).toBe(true);
    expect(
      tooltips.every((tooltip) => tooltip.props('mouseEnterDelay') === 1),
    ).toBe(true);

    expect(wrapper.findAll('dt')).toHaveLength(4);
    expect(wrapper.findAll('dd')).toHaveLength(4);
    expect(wrapper.find('[data-test="detail-display-array"]').exists()).toBe(
      true,
    );
    expect(
      wrapper
        .findAllComponents(Tag)
        .map((tag) => tag.text())
        .filter((text) => text === '启用' || text === '停用'),
    ).toEqual(['启用', '停用']);

    await wrapper.get('button').trigger('click');

    expect(
      document.body.querySelector('[data-test="json-viewer"]')?.textContent,
    ).toContain('{"enabled":true,"limits":[1,2]}');

    wrapper.unmount();
  });
  it('溢出的正文支持展开、收起和记录切换重置', async () => {
    const height = vi
      .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
      .mockReturnValue(48);
    const scrollHeight = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockReturnValue(120);
    const entries = buildDetailDisplayEntries({ note: '长内容'.repeat(100) }, [
      { key: 'note', label: '备注', type: 'textarea' },
    ]);
    const wrapper = mount(DetailDisplayPanel, { props: { entries } });
    try {
      await nextTick();
      const toggle = wrapper.get('[data-test="detail-display-toggle"]');
      expect(toggle.text()).toBe('展开全文');
      await toggle.trigger('click');
      expect(toggle.attributes('aria-expanded')).toBe('true');
      expect(
        wrapper.get('[data-test="detail-display-value"]').classes(),
      ).not.toContain('line-clamp-2');
      await toggle.trigger('click');
      expect(toggle.attributes('aria-expanded')).toBe('false');
      expect(
        wrapper.get('[data-test="detail-display-value"]').classes(),
      ).toContain('line-clamp-2');
      await toggle.trigger('click');
      scrollHeight.mockReturnValue(24);
      await wrapper.setProps({
        entries: buildDetailDisplayEntries({ note: '短内容' }, [
          { key: 'note', label: '备注' },
        ]),
      });
      await nextTick();
      expect(wrapper.find('[data-test="detail-display-toggle"]').exists()).toBe(
        false,
      );
      expect(wrapper.text()).toContain('短内容');
    } finally {
      wrapper.unmount();
      height.mockRestore();
      scrollHeight.mockRestore();
    }
  });

  it('保留分组初始折叠并在数据更新时重置', async () => {
    const makeEntries = () =>
      buildDetailDisplayEntries({ name: '示例用户' }, [
        {
          key: 'name',
          label: '名称',
          displayGroup: {
            key: 'basic',
            title: '基本信息',
            defaultExpanded: false,
          },
        },
      ]);
    const wrapper = mount(DetailDisplayPanel, {
      props: { entries: makeEntries() },
    });
    const toggle = wrapper.get('[data-test="detail-group-toggle"]');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(wrapper.get('dl').attributes('style')).toContain('display: none');
    await toggle.trigger('click');
    expect(wrapper.get('dl').attributes('style') || '').not.toContain(
      'display: none',
    );
    await wrapper.setProps({ entries: makeEntries() });
    expect(toggle.attributes('aria-expanded')).toBe('false');
    wrapper.unmount();
  });
  it.each([
    ['card', 'border-border'],
    ['border', 'border-primary'],
    ['divider', 'vben-crud-group-divider'],
  ] as const)('详情执行分组样式 %s', async (displayStyle, expectedClass) => {
    const makeEntries = (style: 'divider' | typeof displayStyle) =>
      buildDetailDisplayEntries({ name: '示例' }, [
        {
          key: 'name',
          label: '名称',
          displayGroup: {
            key: 'basic',
            title: '基本信息',
            displayStyle: style,
          },
        },
      ]);
    const wrapper = mount(DetailDisplayPanel, {
      props: { entries: makeEntries(displayStyle) },
    });
    expect(wrapper.get('.detail-section-heading').classes()).toContain(
      expectedClass,
    );
    if (displayStyle !== 'divider')
      expect(wrapper.get('.detail-section-heading').classes()).not.toContain(
        'vben-crud-group-divider',
      );
    await wrapper.setProps({ entries: makeEntries('divider') });
    expect(wrapper.get('.detail-section-heading').classes()).toContain(
      'vben-crud-group-divider',
    );
    wrapper.unmount();
  });
  it('未配置分组样式时默认使用分隔线', () => {
    expect(getCrudGroupTitleClass()).toBe('vben-crud-group-divider');
    expect(normalizeCrudGroupDisplayStyle()).toBe('divider');
    expect(normalizeCrudGroupDisplayStyle('default')).toBe('divider');
  });
  it('空分组随可见字段消失与恢复，收起非空组仍保留展开入口', async () => {
    const known = [
      {
        key: 'name',
        label: '名称',
        displayGroup: { key: 'basic', title: '基本信息' },
      },
      {
        key: 'note',
        label: '备注',
        displayGroup: { key: 'extra', title: '补充信息' },
      },
    ];
    const data = { name: '示例', note: '补充内容' };
    const wrapper = mount(DetailDisplayPanel, {
      props: { entries: buildDetailDisplayEntries(data, known, known) },
    });
    expect(wrapper.findAll('section')).toHaveLength(2);
    await wrapper.setProps({
      entries: buildDetailDisplayEntries(data, known.slice(0, 1), known),
    });
    expect(wrapper.findAll('section')).toHaveLength(1);
    expect(wrapper.text()).not.toContain('补充信息');
    expect(wrapper.text()).not.toContain('补充内容');
    await wrapper.get('[data-test="detail-group-toggle"]').trigger('click');
    expect(
      wrapper
        .get('[data-test="detail-group-toggle"]')
        .attributes('aria-expanded'),
    ).toBe('false');
    expect(wrapper.findAll('section')).toHaveLength(1);
    await wrapper.setProps({
      entries: buildDetailDisplayEntries(data, known, known),
    });
    expect(wrapper.findAll('section')).toHaveLength(2);
    await wrapper.setProps({
      entries: buildDetailDisplayEntries(data, [], known),
    });
    expect(wrapper.findAll('section')).toHaveLength(0);
    expect(wrapper.find('[data-test="detail-group-toggle"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).toContain('暂无可展示内容');
    wrapper.unmount();
  });
  it('空媒体不创建预览请求，关闭空值展示后整组隐藏', async () => {
    const fields = [
      { key: 'image', label: '图片', type: 'image' as const },
      { key: 'file', label: '附件', type: 'file' as const },
      { key: 'qr', label: '二维码', type: 'qrcode' as const },
      { key: 'json', label: 'JSON', type: 'json' as const },
    ].map((field) => ({
      ...field,
      displayGroup: { key: 'empty', title: '空值分组' },
    }));
    const data = { image: null, file: '', qr: undefined, json: {} };
    const wrapper = mount(DetailDisplayPanel, {
      props: { entries: buildDetailDisplayEntries(data, fields) },
    });
    expect(wrapper.findAll('[data-test="detail-display-entry"]')).toHaveLength(
      4,
    );
    expect(wrapper.text()).toContain('{}');
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('[data-test="detail-display-qrcode"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-test="detail-files"]').exists()).toBe(false);
    await wrapper.setProps({
      entries: buildDetailDisplayEntries(data, fields, fields, false),
    });
    expect(wrapper.find('section').exists()).toBe(false);
    wrapper.unmount();
  });
  it('全部过滤后只显示空状态，不回退原始内容', () => {
    const fields = [{ key: 'privateText', label: '隐藏内容' }];
    const wrapper = mount(DetailDisplayPanel, {
      props: {
        entries: buildDetailDisplayEntries(
          { privateText: '不应展示的原始值' },
          [],
          fields,
        ),
      },
    });
    expect(wrapper.get('[role="status"]').text()).toBe('暂无可展示内容');
    expect(wrapper.text()).not.toContain('不应展示的原始值');
    expect(wrapper.find('section').exists()).toBe(false);
    wrapper.unmount();
  });
});
