import { flushPromises, shallowMount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import LegalSubjectPicker from '../legal-subject-picker.vue';

const mocked = vi.hoisted(() => ({
  load: vi.fn(),
  retrieve: vi.fn(),
  factory: vi.fn(),
  candidates: vi.fn(),
}));

vi.mock('../../../api/legal-subject-service', () => ({
  legalSubjectService: { retrieve: mocked.retrieve },
}));
vi.mock('../../api-module', () => ({
  moduleFetchCrudList: async (...args: unknown[]) => {
    mocked.factory(...args);
    const items = await mocked.load(...args);
    return {
      items: items.map((item: any) => ({
        id: item.value,
        subjectName: item.label,
        tenantId: item.tenantId,
      })),
      totals: items.length === 50 ? 51 : items.length,
    };
  },
}));

vi.mock('../../reference-candidate-options', () => ({
  loadReferenceCandidates: mocked.candidates,
}));

const SelectStub = defineComponent({
  name: 'ASelect',
  props: {
    allowClear: Boolean,
    disabled: Boolean,
    options: { type: Array, default: () => [] },
  },
  emits: ['search', 'update:value'],
  template: '<div />',
});

describe('法律主体选择控件', () => {
  it('合作关系编辑时禁止修改主体 ID', async () => {
    mocked.load.mockResolvedValue([]);
    mocked.retrieve.mockResolvedValue({
      data: { id: 'subject-1', subjectName: '甲公司' },
    });
    const wrapper = shallowMount(LegalSubjectPicker, {
      props: { disabled: true, modelValue: 'subject-1' },
      global: { stubs: { ASelect: SelectStub } },
    });
    const select = wrapper.findComponent(SelectStub);

    expect(select.props('disabled')).toBe(true);
    select.vm.$emit('update:value', 'subject-2');
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    wrapper.unmount();
  });

  it('搜索其它主体后仍保留已选主体的名称', async () => {
    mocked.load.mockResolvedValue([]);
    mocked.retrieve.mockResolvedValue({
      data: { id: 'subject-1', subjectName: '甲公司' },
    });
    const wrapper = shallowMount(LegalSubjectPicker, {
      props: { modelValue: 'subject-1' },
      global: { stubs: { ASelect: SelectStub } },
    });
    await flushPromises();

    const select = wrapper.findComponent(SelectStub);
    select.vm.$emit('search', '其它');
    await flushPromises();

    expect(select.props('options')).toContainEqual({
      label: '甲公司',
      value: 'subject-1',
    });
    wrapper.unmount();
  });

  it('租户用户可显示租户字段脱敏的候选和详情', async () => {
    mocked.load.mockResolvedValue([
      { label: '乙主体', value: 'subject-2' },
      { label: '越租户', value: 'subject-x', tenantId: 'tenant-b' },
    ]);
    mocked.retrieve.mockResolvedValue({
      data: { id: 'subject-1', subjectName: '甲主体' },
    });
    const wrapper = shallowMount(LegalSubjectPicker, {
      props: { tenantId: 'tenant-a', modelValue: 'subject-1' },
      global: { stubs: { ASelect: SelectStub } },
    });
    await flushPromises();
    expect(wrapper.findComponent(SelectStub).props('options')).toEqual(
      expect.arrayContaining([
        { label: '甲主体', value: 'subject-1' },
        { label: '乙主体', value: 'subject-2' },
      ]),
    );
    expect(
      wrapper.findComponent(SelectStub).props('options'),
    ).not.toContainEqual(expect.objectContaining({ value: 'subject-x' }));
    expect(mocked.retrieve).toHaveBeenCalledWith({
      id: 'subject-1',
      tenantId: 'tenant-a',
    });
    wrapper.unmount();
  });

  it('平台先选择租户，切换后清除主体并按新租户加载', async () => {
    mocked.factory.mockClear();
    mocked.candidates.mockResolvedValue({ items: [], totals: 0 });
    mocked.load.mockResolvedValue([]);
    const wrapper = shallowMount(LegalSubjectPicker, {
      props: { requireTenant: true },
      global: { stubs: { ASelect: SelectStub } },
    });
    await flushPromises();
    expect(wrapper.findComponent(SelectStub).props('disabled')).toBe(true);
    expect(mocked.factory).not.toHaveBeenCalled();
    await wrapper.setProps({ tenantId: 'tenant-a', modelValue: 'subject-a' });
    await flushPromises();
    expect(mocked.candidates).toHaveBeenCalledWith(
      'legalSubjects',
      'tenant-a',
      '',
      1,
    );
    await wrapper.setProps({ tenantId: 'tenant-b' });
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')).toContainEqual([undefined]);
    expect(mocked.candidates).toHaveBeenCalledWith(
      'legalSubjects',
      'tenant-b',
      '',
      1,
    );
    wrapper.unmount();
  });

  it('尚未保存时允许清空误选的主体', async () => {
    mocked.load.mockResolvedValue([]);
    mocked.retrieve.mockResolvedValue({ data: { id: 'subject-1' } });
    const wrapper = shallowMount(LegalSubjectPicker, {
      props: { modelValue: 'subject-1' },
      global: { stubs: { ASelect: SelectStub } },
    });
    const select = wrapper.findComponent(SelectStub);
    expect(select.props('allowClear')).toBe(true);
    select.vm.$emit('update:value', undefined);
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:modelValue')).toContainEqual([undefined]);
    wrapper.unmount();
  });
  it('平台候选可加载第二页并保持选中名称', async () => {
    mocked.candidates.mockReset();
    mocked.candidates.mockImplementation(
      async (_type, _tenant, _keyword, page, id) => {
        if (id) return { items: [{ id, name: '已选主体' }], totals: 1 };
        return page === 1
          ? {
              items: Array.from({ length: 50 }, (_, i) => ({
                id: `first-${i}`,
                name: `主体${i}`,
              })),
              totals: 51,
            }
          : { items: [{ id: 'second', name: '第二页主体' }], totals: 51 };
      },
    );
    const wrapper = shallowMount(LegalSubjectPicker, {
      props: {
        requireTenant: true,
        tenantId: 'tenant-a',
        modelValue: 'selected',
      },
      global: {
        stubs: {
          ASelect: SelectStub,
          AButton: {
            template: '<button @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
    });
    await flushPromises();
    const button = wrapper
      .findAll('button')
      .find((item) => item.text().includes('加载更多法律主体'));
    if (!button) throw new Error('缺少加载更多按钮');
    await button.trigger('click');
    await flushPromises();
    expect(wrapper.findComponent(SelectStub).props('options')).toEqual(
      expect.arrayContaining([
        { label: '已选主体', value: 'selected' },
        { label: '第二页主体', value: 'second' },
      ]),
    );
    expect(mocked.candidates).toHaveBeenCalledWith(
      'legalSubjects',
      'tenant-a',
      '',
      2,
    );
    wrapper.unmount();
  });
  it('普通租户按关键字分页并可选择第 51 条', async () => {
    mocked.load.mockReset();
    mocked.load.mockImplementation(async (_path, params) =>
      params.pageIndex === 1
        ? Array.from({ length: 50 }, (_, i) => ({
            value: `one-${i}`,
            label: `主体${i}`,
          }))
        : [{ value: 'last', label: '目标主体' }],
    );
    const wrapper = shallowMount(LegalSubjectPicker, {
      props: { tenantId: 'tenant-a' },
      global: {
        stubs: {
          ASelect: SelectStub,
          AButton: {
            template: '<button @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
    });
    await flushPromises();
    wrapper.findComponent(SelectStub).vm.$emit('search', '目标');
    await flushPromises();
    const button = wrapper
      .findAll('button')
      .find((item) => item.text().includes('加载更多法律主体'));
    if (!button) throw new Error('缺少加载更多按钮');
    await button.trigger('click');
    await flushPromises();
    expect(mocked.load).toHaveBeenLastCalledWith(
      '/LegalSubject/list',
      expect.objectContaining({
        pageIndex: 2,
        containsSubjectName: '目标',
        tenantId: 'tenant-a',
      }),
    );
    expect(wrapper.findComponent(SelectStub).props('options')).toContainEqual({
      label: '目标主体',
      value: 'last',
    });
    wrapper.unmount();
  });
  it('租户切换时迟到的旧租户分页不能覆盖新候选', async () => {
    let resolveOld: (value: any) => void = () => {};
    const oldPage = new Promise((resolve) => {
      resolveOld = resolve;
    });
    mocked.candidates.mockReset();
    mocked.candidates.mockImplementation((_type, tenant) =>
      tenant === 'tenant-a'
        ? oldPage
        : Promise.resolve({
            items: [{ id: 'new', name: '乙主体' }],
            totals: 1,
          }),
    );
    const wrapper = shallowMount(LegalSubjectPicker, {
      props: { requireTenant: true, tenantId: 'tenant-a' },
      global: { stubs: { ASelect: SelectStub } },
    });
    await wrapper.setProps({ tenantId: 'tenant-b' });
    await flushPromises();
    resolveOld({ items: [{ id: 'old', name: '甲主体' }], totals: 1 });
    await flushPromises();
    expect(wrapper.findComponent(SelectStub).props('options')).toEqual([
      { label: '乙主体', value: 'new' },
    ]);
    wrapper.unmount();
  });
});
