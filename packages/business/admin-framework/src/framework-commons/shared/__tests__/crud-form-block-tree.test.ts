import type { CrudFieldConfig } from '../types';

import { mount } from '@vue/test-utils';
import { h } from 'vue';

import { describe, expect, it } from 'vitest';

import { nestCrudFormBlocks } from '../crud-form-block-tree';
import CrudFormBlockTree from '../crud-form-block-tree.vue';

const flatBlocks = [
  { fields: [{ key: 'plain' }] },
  { complexGroupKey: 'one', fields: [{ key: 'oneTitle' }] },
  { complexGroupKey: 'two', fields: [{ key: 'twoName' }] },
  { complexGroupKey: 'three', fields: [{ key: 'threeLabel' }] },
  { complexGroupKey: 'four', fields: [{ key: 'fourValue' }] },
];
const groups = [
  { key: 'one' },
  { key: 'two', parentKey: 'one' },
  { key: 'three', parentKey: 'two' },
  { key: 'four', parentKey: 'three' },
];

describe('复杂对象表单区块', () => {
  it('四层子边框置于父组字段网格内且不重复缩进，折叠父对象隐藏所有后代', async () => {
    const blocks = nestCrudFormBlocks(flatBlocks, groups);
    const wrapper = mount(CrudFormBlockTree, {
      attachTo: document.body,
      props: {
        blocks: blocks as unknown as ReturnType<
          typeof nestCrudFormBlocks<CrudFieldConfig>
        >,
        collapsed: {},
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        quickFillActive: false,
      },
      slots: {
        fields: ({ block }) =>
          h(
            'span',
            block.fields.map((field: { key: string }) => field.key).join(','),
          ),
        header: ({ block }) => h('strong', block.complexGroupKey),
      },
    });

    const one = wrapper.find('[data-crud-complex-group="one"]');
    const two = wrapper.find('[data-crud-complex-group="two"]');
    const three = wrapper.find('[data-crud-complex-group="three"]');
    const four = wrapper.find('[data-crud-complex-group="four"]');
    for (const [parent, child] of [
      [one, two],
      [two, three],
      [three, four],
    ] as const) {
      expect(parent.element.contains(child.element)).toBe(true);
      expect(parent.element.children[1]?.classList.contains('p-4')).toBe(true);
      expect(child.classes()).not.toContain('ml-6');
    }
    expect(wrapper.text()).toContain('plain');

    await wrapper.setProps({ collapsed: { one: true } });
    expect(two.isVisible()).toBe(false);
    wrapper.unmount();
  });

  it('父对象没有可见字段时不丢弃子对象', () => {
    const blocks = nestCrudFormBlocks(
      flatBlocks.filter((block) => block.complexGroupKey !== 'one'),
      groups,
    );
    expect(blocks.map((block) => block.complexGroupKey)).toContain('two');
    expect(
      blocks.find((block) => block.complexGroupKey === 'two')?.children[0]
        ?.complexGroupKey,
    ).toBe('three');
  });

  it('错误的循环父子配置不会产生递归渲染循环', () => {
    const blocks = nestCrudFormBlocks(
      [
        { complexGroupKey: 'a', fields: [{ key: 'a' }] },
        { complexGroupKey: 'b', fields: [{ key: 'b' }] },
      ],
      [
        { key: 'a', parentKey: 'b' },
        { key: 'b', parentKey: 'a' },
      ],
    );
    expect(blocks).toHaveLength(2);
  });
});
