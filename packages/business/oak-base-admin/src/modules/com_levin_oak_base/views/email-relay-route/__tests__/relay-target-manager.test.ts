import { mount } from '@vue/test-utils';

import { Button, Form, Modal, Popconfirm, Select } from 'ant-design-vue';
import { describe, expect, it } from 'vitest';

import RelayTargetManager from '../relay-target-manager.vue';

describe('邮件投递目标子列表', () => {
  it('每个目标只占一行，六条时列表内容滚动且不分页', () => {
    const wrapper = mount(RelayTargetManager, {
      props: {
        items: Array.from({ length: 6 }, (_, index) => ({
          type: 'email',
          endpoint: `user${index}@example.test`,
        })),
      },
    });

    expect(wrapper.findAll('[data-relay-target-row]')).toHaveLength(6);
    expect(wrapper.find('[data-relay-target-rows]').classes()).toContain(
      'overflow-y-auto',
    );
    expect(wrapper.text()).toContain('共 6 条');
    expect(wrapper.text()).not.toContain('每页');
    wrapper.unmount();
  });

  it('编辑只替换对应目标，删除保留其它目标与顺序', async () => {
    const wrapper = mount(RelayTargetManager, {
      attachTo: document.body,
      props: {
        items: [
          'email:first@example.test',
          'notify-webhook:https://hooks.example.test/path',
        ],
      },
    });
    expect(wrapper.findAll('[data-relay-target-row]')).toHaveLength(2);

    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '编辑')
      ?.trigger('click');
    const editor = wrapper.findComponent(Modal);
    expect(editor.props('title')).toBe('编辑投递目标');
    const address = editor
      .findAllComponents(Form.Item)
      .find((item) => item.props('label') === '地址');
    expect((address?.get('input').element as HTMLInputElement).value).toBe(
      'first@example.test',
    );
    await address?.get('input').setValue('changed@example.test');
    editor.vm.$emit('ok');
    const edited = wrapper.emitted('update:items')?.[0]?.[0];
    expect(edited).toEqual([
      { type: 'email', endpoint: 'changed@example.test' },
      { type: 'notify-webhook', endpoint: 'https://hooks.example.test/path' },
    ]);

    await wrapper.setProps({ items: edited as any });
    wrapper.findAllComponents(Popconfirm)[0]?.vm.$emit('confirm');
    expect(wrapper.emitted('update:items')?.[1]?.[0]).toEqual([
      { type: 'notify-webhook', endpoint: 'https://hooks.example.test/path' },
    ]);
    wrapper.unmount();
  });

  it('新增表单的类型与地址必须校验通过才能加入列表', async () => {
    const wrapper = mount(RelayTargetManager, {
      attachTo: document.body,
      props: { items: [] },
    });
    await wrapper
      .findAllComponents(Button)
      .find((button) => button.text() === '新增目标')
      ?.trigger('click');
    const editor = wrapper.findComponent(Modal);
    editor.vm.$emit('ok');
    expect(wrapper.emitted('update:items')).toBeUndefined();
    editor.findComponent(Select).vm.$emit('update:value', 'email');
    await editor
      .findAllComponents(Form.Item)
      .find((item) => item.props('label') === '地址')
      ?.get('input')
      .setValue('ops@example.test');
    editor.vm.$emit('ok');
    expect(wrapper.emitted('update:items')?.[0]?.[0]).toEqual([
      { type: 'email', endpoint: 'ops@example.test' },
    ]);
    wrapper.unmount();
  });
});
