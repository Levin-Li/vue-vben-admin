import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';

import { Select, Switch, Tooltip } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import PageDisplaySettingsDrawer from '../page-display-settings-drawer.vue';

vi.mock('../../api', () => ({
  fetchDictOptions: vi.fn().mockResolvedValue([]),
  fetchEnumOptions: vi.fn().mockResolvedValue([]),
  fetchOptions: vi.fn().mockResolvedValue([]),
}));

vi.mock('../config-helpers', () => ({
  OAK_BASE_API_MODULE: 'com.levin.oak.base',
  roleOptionsLoader: vi.fn().mockResolvedValue([]),
}));

vi.mock('../script-workbench-dialog.vue', () => ({
  default: defineComponent({ template: '<div />' }),
}));

function mountDrawer(saving: boolean, showOperationColumn = false) {
  return mount(PageDisplaySettingsDrawer, {
    attachTo: document.body,
    props: {
      code: '/clob/V1/Area',
      fields: [{ key: 'name', label: '名称', search: true }],
      detailFields: [{ key: 'name', label: '名称' }],
      modelValue: { version: 1 },
      open: true,
      saving,
      showOperationColumn,
    },
  });
}

function getUploadButton() {
  return Array.from(document.body.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('上传当前配置'),
  ) as HTMLButtonElement;
}

function getTitleAliasInput() {
  return document.body.querySelector(
    'input[placeholder="名称"]',
  ) as HTMLInputElement;
}

function getTab(title: string) {
  return Array.from(document.body.querySelectorAll('[role="tab"]')).find(
    (tab) => tab.textContent?.trim() === title,
  ) as HTMLElement;
}

describe('页面展示设置抽屉', () => {
  it('initializes domainId as hidden and omitted in every view until the page setting overrides it', async () => {
    const wrapper = mount(PageDisplaySettingsDrawer, {
      attachTo: document.body,
      props: {
        code: '/clob/V1/DomainOwned',
        detailFields: [{ key: 'domainId', label: '归属域' }],
        domainObject: true,
        fields: [
          { key: 'domainId', label: '归属域', search: true, table: true },
        ],
        modelValue: { version: 1 },
        open: true,
        saving: false,
      },
    });
    await flushPromises();

    getUploadButton().click();
    await nextTick();
    const payload = wrapper.emitted('save')![0]![0] as {
      config: Record<string, any>;
    };

    expect(payload.config.query.fields[0]).toMatchObject({ hidden: true });
    expect(payload.config.create.fields[0]).toMatchObject({ hidden: true });
    expect(payload.config.edit.fields[0]).toMatchObject({ hidden: true });
    expect(payload.config.query.fields[0].submitWhenHidden).not.toBe(true);
    expect(payload.config.create.fields[0].submitWhenHidden).not.toBe(true);
    expect(payload.config.edit.fields[0].submitWhenHidden).not.toBe(true);
    expect(payload.config.detail.fields[0]).toMatchObject({ hidden: true });
    expect(payload.config.list.headers[0]).toMatchObject({
      key: 'domainId',
      visible: { mode: 'hidden' },
    });
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it.each([
    ['查询表单', 'query'],
    ['新增表单', 'create'],
    ['编辑表单', 'edit'],
  ])('在%s用紧凑连续分段按钮保存隐藏提交', async (title, view) => {
    const wrapper = mountDrawer(false);
    await flushPromises();
    const tab = getTab(title);
    if (tab) tab.click();
    await flushPromises();
    const group = document.body.querySelector('[aria-label="名称展示与提交"]')!;
    expect(group).toBeTruthy();
    expect(group.classList.contains('flex')).toBe(true);
    expect(group.classList.contains('ant-radio-group-small')).toBe(false);
    expect(group.classList.contains('ant-radio-group-solid')).toBe(true);
    expect(group.querySelectorAll('.ant-radio-button-wrapper')).toHaveLength(4);
    expect(group.querySelectorAll('.ant-radio-inner')).toHaveLength(0);
    expect(group.textContent?.replaceAll(/\s/g, '')).toBe('展提隐提禁提不提');
    const tooltipTitles = wrapper
      .findAllComponents(Tooltip)
      .map((item) => item.props('title'));
    expect(tooltipTitles).toEqual(
      expect.arrayContaining([
        '展示控件并参与提交',
        '不展示控件仍参与提交',
        '展示控件但不可修改仍参与提交',
        '不展示控件也不参与校验和提交',
      ]),
    );
    const choice = group.querySelector(
      'input[value="hidden-submit"]',
    ) as HTMLInputElement;
    choice.click();
    await nextTick();
    getUploadButton().click();
    await nextTick();
    const payload = wrapper.emitted('save')![0]![0] as {
      config: Record<
        string,
        { fields: Array<{ hidden: boolean; submitWhenHidden: boolean }> }
      >;
    };
    expect(payload.config[view!]!.fields[0]).toMatchObject({
      hidden: true,
      submitWhenHidden: true,
    });
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('禁提按钮保存独立交互状态且切回展提后解除禁用', async () => {
    const wrapper = mountDrawer(false);
    await flushPromises();
    const group = document.body.querySelector(
      '[aria-label="名称展示与提交"]',
    ) as HTMLElement;
    (
      group.querySelector('input[value="disabled-submit"]') as HTMLInputElement
    ).click();
    await nextTick();
    getUploadButton().click();
    await nextTick();
    expect(
      (wrapper.emitted('save')?.at(-1)?.[0] as any).config.query.fields[0],
    ).toMatchObject({ hidden: false, disabled: true, submitWhenHidden: false });
    (
      group.querySelector('input[value="display-submit"]') as HTMLInputElement
    ).click();
    await nextTick();
    getUploadButton().click();
    await nextTick();
    expect(
      (wrapper.emitted('save')?.at(-1)?.[0] as any).config.query.fields[0],
    ).toMatchObject({ hidden: false, disabled: false });
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('上传中禁用上传按钮且不重复提交', async () => {
    const wrapper = mountDrawer(true);
    await flushPromises();

    const button = getUploadButton();
    expect(button).toBeTruthy();
    expect(button.disabled).toBe(true);

    button.click();
    await nextTick();
    expect(wrapper.emitted('save')).toBeUndefined();
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('空闲时允许提交当前配置', async () => {
    const wrapper = mountDrawer(false);
    await flushPromises();

    const button = getUploadButton();
    expect(button).toBeTruthy();
    button.click();
    await nextTick();
    expect(wrapper.emitted('save')).toHaveLength(1);
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('在查询页签保存独立字段标题别名', async () => {
    const wrapper = mountDrawer(false);
    await flushPromises();

    const input = getTitleAliasInput();
    expect(input).toBeTruthy();
    input.value = '机构名称';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();

    getUploadButton().click();
    await nextTick();
    expect(wrapper.emitted('save')?.at(-1)?.[0]).toMatchObject({
      config: {
        query: { fields: [{ key: 'name', label: '机构名称' }] },
      },
    });
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('首次打开页签后保留该页签的字段编辑实例', async () => {
    const wrapper = mountDrawer(false);
    await flushPromises();

    const queryAliasInput = getTitleAliasInput();
    expect(queryAliasInput).toBeTruthy();

    getTab('展示列表').click();
    await nextTick();
    expect(getTitleAliasInput()).not.toBe(queryAliasInput);

    getTab('查询表单').click();
    await nextTick();
    expect(getTitleAliasInput()).toBe(queryAliasInput);

    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('在展示列表的最后提供操作列配置，并保存其默认宽度', async () => {
    const wrapper = mountDrawer(false, true);
    await flushPromises();

    getTab('展示列表').click();
    await nextTick();

    expect(document.body.textContent).toContain('操作');
    getUploadButton().click();
    await nextTick();
    expect(wrapper.emitted('save')?.at(-1)?.[0]).toMatchObject({
      config: {
        list: {
          headers: [
            {
              key: '__actions',
              label: '操作',
              width: 220,
            },
          ],
        },
      },
    });

    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('默认分组不提供折叠配置，命名分组仍可配置折叠', async () => {
    const wrapper = mountDrawer(false);
    await flushPromises();

    expect(document.body.textContent).not.toContain('组自动折叠行数');

    const addGroupButton = Array.from(
      document.body.querySelectorAll('button'),
    ).find((button) =>
      button.textContent?.includes('添加分组'),
    ) as HTMLButtonElement;
    addGroupButton.click();
    await nextTick();

    expect(document.body.textContent).toContain('组自动折叠行数');
    expect(document.body.textContent).toContain('展示脚本');
    const roleSelect = wrapper
      .findAllComponents(Select)
      .find((component) => component.props('placeholder') === '分组可见角色');
    expect(roleSelect).toBeDefined();
    roleSelect?.vm.$emit('update:value', ['R_ADMIN']);
    await nextTick();
    getUploadButton().click();
    await nextTick();
    const saved = (
      wrapper.emitted('save')?.at(-1)?.[0] as { config: Record<string, any> }
    ).config;
    expect(saved.query.groups[0]).toMatchObject({
      visibleRoleCodes: ['R_ADMIN'],
    });
    wrapper.unmount();
    document.body.innerHTML = '';
  });
  it.each([
    ['create', '新增表单'],
    ['edit', '编辑表单'],
    ['detail', '详情表单'],
  ] as const)('保存 %s 分隔线配置且可重新加载', async (view, title) => {
    const wrapper = mountDrawer(false);
    await wrapper.setProps({ open: false });
    await wrapper.setProps({
      open: true,
      modelValue: {
        version: 1,
        [view]: {
          groups: [{ key: 'basic', title: '基本信息' }],
          fields: [{ key: 'name', layoutGroup: 'basic' }],
        },
      },
    });
    await flushPromises();
    getTab(title).click();
    await flushPromises();
    const select = wrapper
      .findAllComponents(Select)
      .find((component) =>
        component
          .props('options')
          ?.some((option: { value: string }) => option.value === 'divider'),
      );
    expect(select).toBeDefined();
    expect(select?.props('value')).toBe('divider');
    expect(select?.props('options')).toHaveLength(3);
    expect(select?.props('options')).not.toContainEqual({
      label: '默认',
      value: 'default',
    });
    expect(select?.props('options')).not.toContainEqual({
      label: '换行',
      value: 'newline',
    });
    expect(select?.props('options')).toContainEqual({
      label: '默认',
      value: 'divider',
    });
    select?.vm.$emit('update:value', 'divider');
    await nextTick();
    getUploadButton().click();
    await nextTick();
    const saved = (
      wrapper.emitted('save')?.at(-1)?.[0] as { config: Record<string, any> }
    ).config;
    expect(saved[view].groups[0].displayStyle).toBe('divider');
    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true, modelValue: saved });
    await flushPromises();
    expect(select?.props('value')).toBe('divider');
    wrapper.unmount();
    document.body.innerHTML = '';
  });
  it('详情空值展示默认开启，关闭后保存并重开回显', async () => {
    const wrapper = mountDrawer(false);
    await flushPromises();
    getTab('详情表单').click();
    await flushPromises();
    const getToggle = () =>
      wrapper
        .findAllComponents(Switch)
        .find((component) => component.attributes('aria-label') === '展示空值');
    expect(getToggle()?.props('checked')).toBe(true);
    getToggle()?.vm.$emit('update:checked', false);
    await nextTick();
    getUploadButton().click();
    await nextTick();
    const saved = (
      wrapper.emitted('save')?.at(-1)?.[0] as { config: Record<string, any> }
    ).config;
    expect(saved.detail.showEmptyValues).toBe(false);
    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true, modelValue: saved });
    await flushPromises();
    expect(getToggle()?.props('checked')).toBe(false);
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('详情设置排除查询专用字段和显式虚拟列，不按标签误删真实字段', async () => {
    const wrapper = mountDrawer(false);
    await wrapper.setProps({ open: false });
    await wrapper.setProps({
      open: true,
      fields: [
        { key: 'tenantId', label: '归属租户', search: true },
        {
          key: '__tenant',
          label: '归属租户',
          form: false,
          table: true,
          detail: false,
        },
        { key: 'containsName', label: '角色名称', form: false, search: true },
        { key: 'name', label: '角色名称', table: true },
        { key: 'containsCode', label: '角色编码', form: false, search: true },
        { key: 'code', label: '角色编码', table: true },
        { key: 'inType', label: '角色类型', form: false, search: true },
        { key: 'type', label: '角色类型', table: true },
        { key: 'id', label: '角色ID', form: false, search: true, table: true },
        { key: 'createdAt', label: '创建时间', form: false, table: true },
      ],
    });
    await wrapper.setProps({
      detailFields: [
        { key: 'tenantId', label: '归属租户' },
        { key: 'name', label: '角色名称' },
        { key: 'code', label: '角色编码' },
        { key: 'type', label: '角色类型' },
        { key: 'id', label: '角色ID' },
        { key: 'createdAt', label: '创建时间' },
      ],
    });
    await flushPromises();
    getTab('详情表单').click();
    await flushPromises();
    getUploadButton().click();
    await nextTick();
    const saved = (
      wrapper.emitted('save')?.at(-1)?.[0] as { config: Record<string, any> }
    ).config;
    expect(
      saved.detail.fields.map((field: { key: string }) => field.key),
    ).toEqual(['tenantId', 'name', 'code', 'type', 'id', 'createdAt']);
    getTab('查询表单').click();
    await flushPromises();
    getUploadButton().click();
    await nextTick();
    const query = (
      wrapper.emitted('save')?.at(-1)?.[0] as { config: Record<string, any> }
    ).config.query;
    expect(query.fields.map((field: { key: string }) => field.key)).toContain(
      'containsName',
    );
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it.each([
    ['create', '新增表单'],
    ['edit', '编辑表单'],
  ] as const)('%s 可配置是否显示提交勾选并保存回显', async (view, title) => {
    const wrapper = mountDrawer(false);
    await wrapper.setProps({ open: false });
    await wrapper.setProps({
      open: true,
      modelValue: {
        version: 1,
        [view]: {
          fields: [{ key: 'name', layoutGroup: 'basic' }],
          groups: [{ key: 'basic', title: '基本信息' }],
        },
      },
    });
    await flushPromises();
    getTab(title).click();
    await flushPromises();
    const toggle = () =>
      wrapper
        .findAllComponents(Switch)
        .find(
          (component) => component.attributes('aria-label') === '显示提交勾选',
        );
    expect(toggle()?.props('checked')).toBe(false);
    toggle()?.vm.$emit('update:checked', true);
    await nextTick();
    getUploadButton().click();
    await nextTick();
    const saved = (
      wrapper.emitted('save')?.at(-1)?.[0] as { config: Record<string, any> }
    ).config;
    expect(saved[view].groups[0].showSubmitCheckbox).toBe(true);
    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true, modelValue: saved });
    await flushPromises();
    expect(toggle()?.props('checked')).toBe(true);
    getTab('详情表单').click();
    await flushPromises();
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it.each([
    ['create', '新增表单'],
    ['edit', '编辑表单'],
  ] as const)('%s 的快捷填写默认关闭，开启后保存回显', async (view, title) => {
    const wrapper = mountDrawer(false);
    await flushPromises();
    getTab(title).click();
    await flushPromises();
    const quickFill = () =>
      wrapper
        .findAllComponents(Switch)
        .find((component) => component.attributes('aria-label') === '快捷填写');
    expect(quickFill()).toBeDefined();
    expect(quickFill()?.props('checked')).toBeFalsy();
    quickFill()?.vm.$emit('update:checked', true);
    await nextTick();
    getUploadButton().click();
    await nextTick();
    const saved = (
      wrapper.emitted('save')?.at(-1)?.[0] as {
        config: Record<string, any>;
      }
    ).config;
    expect(saved[view].quickFill).toBe(true);
    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true, modelValue: saved });
    await flushPromises();
    expect(quickFill()?.props('checked')).toBe(true);
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('标题别名默认留空，未填写时沿用开发配置中的字段名称', async () => {
    const wrapper = mountDrawer(false);
    await flushPromises();

    const input = getTitleAliasInput();
    expect(input).toBeTruthy();
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('名称');

    getUploadButton().click();
    await nextTick();
    expect(wrapper.emitted('save')?.at(-1)?.[0]).toMatchObject({
      config: { query: { fields: [{ key: 'name' }] } },
    });
    expect(
      (wrapper.emitted('save')?.at(-1)?.[0] as any).config.query.fields[0],
    ).not.toHaveProperty('label');
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('将开发默认分组作为可编辑草稿展示，并可恢复默认分组', async () => {
    const wrapper = mountDrawer(false);
    await wrapper.setProps({ open: false });
    await wrapper.setProps({
      fields: [
        {
          key: 'name',
          label: '名称',
          layoutGroup: 'basic',
          layoutGroupTitle: '基本信息',
          search: true,
        },
        { key: 'code', label: '编码', layoutGroup: 'basic' },
        { key: 'type', label: '类型', layoutGroup: 'basic' },
        { key: 'status', label: '状态', layoutGroup: 'other' },
        { key: 'remark', label: '备注', layoutGroup: 'other' },
        { key: 'creator', label: '创建人', layoutGroup: 'other' },
        { key: 'extra', label: '扩展信息', layoutGroup: 'other' },
      ],
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    getTab('新增表单').click();
    await flushPromises();

    expect(document.body.textContent).toContain('基本信息');
    const groupSelect = wrapper
      .findAllComponents(Select)
      .find((component) =>
        component
          .props('options')
          ?.some((option: { value: string }) => option.value === 'basic'),
      );
    expect(groupSelect?.props('value')).toBe('basic');
    const restoreButton = Array.from(
      document.body.querySelectorAll('button'),
    ).find((button) =>
      button.textContent?.includes('恢复开发默认分组'),
    ) as HTMLButtonElement;
    restoreButton.click();
    await nextTick();
    expect(groupSelect?.props('value')).toBe('basic');

    getUploadButton().click();
    await nextTick();
    const saved = (wrapper.emitted('save')?.at(-1)?.[0] as any).config.create;
    expect(saved.groups.map((group: { key: string }) => group.key)).toEqual([
      'basic',
      'other',
    ]);
    expect(
      saved.fields.find((field: { key: string }) => field.key === 'name'),
    ).toMatchObject({ layoutGroup: 'basic' });
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('展示列表可添加虚拟字段，并要求填写值展示脚本', async () => {
    const wrapper = mountDrawer(false);
    await flushPromises();
    getTab('展示列表').click();
    await flushPromises();
    const addVirtual = Array.from(
      document.body.querySelectorAll('button'),
    ).find((button) =>
      button.textContent?.includes('添加虚拟字段'),
    ) as HTMLButtonElement;
    addVirtual.click();
    await nextTick();
    expect(document.body.textContent).toContain('虚拟字段');
    const generatedCode = document.body.querySelector(
      'input[placeholder="虚拟字段编码"]',
    ) as HTMLInputElement;
    expect(generatedCode.readOnly).toBe(true);
    getUploadButton().click();
    await nextTick();
    expect(wrapper.emitted('save')).toBeUndefined();
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('阻止上传重复的最终列表标题', async () => {
    const wrapper = mountDrawer(false);
    await wrapper.setProps({ open: false });
    await wrapper.setProps({
      modelValue: {
        list: {
          headers: [
            {
              key: 'name',
              label: '名称',
              title: '重复标题',
              visible: { mode: 'always' },
            },
            {
              key: 'code',
              label: '编码',
              title: '重复标题',
              visible: { mode: 'always' },
            },
          ],
        },
        version: 1,
      },
      fields: [
        { key: 'name', label: '名称', search: true, table: true },
        { key: 'code', label: '编码', table: true },
      ],
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    getTab('展示列表').click();
    await flushPromises();
    getUploadButton().click();
    await nextTick();
    expect(wrapper.emitted('save')).toBeUndefined();
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('阻止上传重复的最终表单标题', async () => {
    const wrapper = mountDrawer(false);
    await wrapper.setProps({ open: false });
    await wrapper.setProps({
      fields: [
        { key: 'name', label: '名称', search: true },
        { key: 'code', label: '编码' },
      ],
      modelValue: {
        create: {
          fields: [
            { key: 'name', label: '重复标题' },
            { key: 'code', label: '重复标题' },
          ],
        },
        version: 1,
      },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    getTab('新增表单').click();
    await flushPromises();
    getUploadButton().click();
    await nextTick();
    expect(wrapper.emitted('save')).toBeUndefined();
    wrapper.unmount();
    document.body.innerHTML = '';
  });
});
