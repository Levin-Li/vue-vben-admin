import { mount } from '@vue/test-utils';

import {
  Input,
  InputNumber,
  Radio,
  Select,
  Switch,
  Tooltip,
} from 'ant-design-vue';
import { describe, expect, it } from 'vitest';

import PageDisplaySettingsV2PropertyPanel from '../page-display-settings-v2-property-panel.vue';

// 使用真实控件验证事件边界，确保单项编辑不在渲染或输入时直接改变父级对象。
const commonProps = {
  fieldOptions: [{ label: '姓名', value: 'name' }],
  roleOptions: [{ label: '管理员', value: 'admin' }],
  title: '测试字段',
};

describe('界面 UI 设置 2 单项属性面板', () => {
  it('四种字段表单的显隐控制始终排在第一项，列表不重复显示开关', async () => {
    const wrapper = mount(PageDisplaySettingsV2PropertyPanel, {
      props: {
        ...commonProps,
        item: { key: 'name' },
        kind: 'field',
        view: 'query',
      },
    });
    for (const view of ['query', 'create', 'edit', 'detail'] as const) {
      await wrapper.setProps({ view });
      expect(wrapper.find('.ant-form-item-label').text()).toBe(
        view === 'detail' ? '是否展示' : '展示与提交',
      );
    }
    await wrapper.setProps({ view: 'list' });
    expect(wrapper.find('.ant-form-item-label').text()).toBe('列宽');
    expect(wrapper.findComponent(Switch).exists()).toBe(false);
    expect(wrapper.emitted('patch')).toBeUndefined();
    wrapper.unmount();
  });

  it('切换对象后脚本悬停说明同步更新且保持原工作台目标', async () => {
    const wrapper = mount(PageDisplaySettingsV2PropertyPanel, {
      props: {
        ...commonProps,
        item: { key: 'name' },
        kind: 'field',
        view: 'detail',
      },
    });
    const cases = [
      {
        kind: 'field',
        view: 'detail',
        target: 'fieldVisibility',
        text: '编写脚本决定字段是否展示。',
      },
      {
        kind: 'group',
        view: 'query',
        target: 'groupVisibility',
        text: '编写脚本决定整个分组是否展示；不展示时组内字段不提交。',
      },
      {
        kind: 'field',
        view: 'list',
        target: 'headerVisibility',
        text: '编写脚本决定当前列是否展示。',
        valueText: '编写脚本转换当前字段在每一行中的展示内容。',
      },
      {
        kind: 'action',
        view: 'list',
        target: 'actionVisibility',
        text: '使用当前行数据、当前用户、组织和租户设置附加显示条件；表达式失败时隐藏该操作。',
        valueText: '返回非空文本时，它会以最高优先级作为按钮名称。',
      },
    ] as const;
    for (const entry of cases) {
      await wrapper.setProps({ kind: entry.kind, view: entry.view });
      const tooltips = wrapper.findAllComponents(Tooltip);
      const visibility = tooltips.find((tooltip) =>
        tooltip.find('button[aria-label="显示脚本"]').exists(),
      );
      expect(visibility?.props('title')).toBe(entry.text);
      await wrapper.get('button[aria-label="显示脚本"]').trigger('click');
      expect(wrapper.emitted('script')?.at(-1)).toEqual([entry.target]);
      if ('valueText' in entry) {
        const value = tooltips.find((tooltip) =>
          tooltip.find('button[aria-label="展示值脚本"]').exists(),
        );
        expect(value?.props('title')).toBe(entry.valueText);
      }
    }
    expect(wrapper.emitted('patch')).toBeUndefined();
    wrapper.unmount();
  });

  it('默认值与依赖更新保留其它规则且不修改传入草稿', () => {
    const item = {
      key: 'count',
      defaultValue: { applyWhen: 'initialize' as const, value: 3 },
      visibility: { expression: 'true', exclusiveWith: { fieldKeys: ['id'] } },
    };
    const wrapper = mount(PageDisplaySettingsV2PropertyPanel, {
      props: { ...commonProps, item, kind: 'field', view: 'query' },
    });
    expect(wrapper.emitted('patch')).toBeUndefined();
    wrapper.findComponent(InputNumber).vm.$emit('update:value', 5);
    expect(wrapper.emitted('patch')?.[0]).toEqual([
      { defaultValue: { applyWhen: 'initialize', value: 5 } },
    ]);
    const dependencySelect = wrapper
      .findAllComponents(Select)
      .find((select) => select.attributes('aria-label') === '依赖显示项');
    if (!dependencySelect) throw new Error('缺少依赖显示项控件');
    dependencySelect.vm.$emit('update:value', ['name']);
    expect(wrapper.emitted('patch')?.[1]).toEqual([
      {
        visibility: {
          expression: 'true',
          exclusiveWith: { fieldKeys: ['id'] },
          dependsOn: { fieldKeys: ['name'] },
        },
      },
    ]);
    expect(item.defaultValue.value).toBe(3);
    expect(item.visibility).not.toHaveProperty('dependsOn');
    wrapper.unmount();
  });

  it('展示提交四态只发出三项状态补丁，切换详情后不显示提交状态', async () => {
    const item = { key: 'name', label: '姓名' };
    const wrapper = mount(PageDisplaySettingsV2PropertyPanel, {
      props: { ...commonProps, item, kind: 'field', view: 'edit' },
    });
    wrapper
      .findComponent(Radio.Group)
      .vm.$emit('update:value', 'hidden-submit');
    expect(wrapper.emitted('patch')?.[0]).toEqual([
      { hidden: true, disabled: false, submitWhenHidden: true },
    ]);
    expect(item).toEqual({ key: 'name', label: '姓名' });
    await wrapper.setProps({ view: 'detail' });
    expect(wrapper.findComponent(Radio.Group).exists()).toBe(false);
    wrapper.findComponent(Switch).vm.$emit('update:checked', false);
    expect(wrapper.emitted('patch')?.[1]).toEqual([{ hidden: true }]);
    wrapper.unmount();
  });

  it('操作不重复显示别名，仍保留可见脚本与工作台入口', async () => {
    const item = {
      key: 'edit',
      label: '编辑',
      title: '调整',
      visible: { mode: 'script' as const, expression: 'true' },
    };
    const wrapper = mount(PageDisplaySettingsV2PropertyPanel, {
      props: { ...commonProps, item, kind: 'action', view: 'list' },
    });
    expect(wrapper.find('input[aria-label="标题别名"]').exists()).toBe(false);
    expect(wrapper.findComponent(Switch).exists()).toBe(false);
    await wrapper.get('button[aria-label="展示值脚本"]').trigger('click');
    await wrapper.get('button[aria-label="显示脚本"]').trigger('click');
    expect(wrapper.emitted('script')).toEqual([
      ['actionValue'],
      ['actionVisibility'],
    ]);
    expect(item.label).toBe('编辑');
    expect(item.title).toBe('调整');
    wrapper.unmount();
  });

  it('分组编辑只显示分组属性，不在右侧提供删除动作', async () => {
    const item = { key: 'base', title: '基本信息' };
    const wrapper = mount(PageDisplaySettingsV2PropertyPanel, {
      props: { ...commonProps, item, kind: 'group', view: 'create' },
    });
    expect(wrapper.findComponent(InputNumber).exists()).toBe(false);
    wrapper.findComponent(Switch).vm.$emit('update:checked', true);
    expect(wrapper.emitted('patch')?.[0]).toEqual([
      { showSubmitCheckbox: true },
    ]);
    wrapper.findComponent(Input).vm.$emit('update:value', '新分组名称');
    expect(wrapper.emitted('patch')?.[1]).toEqual([{ title: '新分组名称' }]);
    const removeButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '删除分组');
    expect(removeButton).toBeUndefined();
    await wrapper.setProps({ view: 'query' });
    expect(wrapper.findComponent(Switch).exists()).toBe(false);
    wrapper.unmount();
  });

  it('切换选中项复用唯一表单，并回显新项属性', async () => {
    const wrapper = mount(PageDisplaySettingsV2PropertyPanel, {
      props: {
        ...commonProps,
        item: { key: 'first', label: '第一项' },
        kind: 'field',
        view: 'edit',
      },
    });
    const before = wrapper.findAll('input').length;
    await wrapper.setProps({
      item: { key: 'last', label: '末尾项' },
      title: '末尾项',
    });
    expect(wrapper.find('h3').text()).toBe('末尾项');
    expect(wrapper.find('input[aria-label="标题别名"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="所属分组"]').exists()).toBe(false);
    expect(wrapper.findAll('input')).toHaveLength(before);
    expect(
      wrapper.findAll('[data-test="page-display-v2-property-panel"]'),
    ).toHaveLength(1);
    expect(wrapper.emitted('patch')).toBeUndefined();
    wrapper.unmount();
  });
});
