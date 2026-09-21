import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { Modal } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import type { CrudPageDisplayConfig } from '../types';

import PageDisplaySettingsDrawerV2 from '../page-display-settings-drawer-v2.vue';
import PropertyPanel from '../page-display-settings-v2-property-panel.vue';

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
  default: defineComponent({
    name: 'ScriptWorkbenchDialog',
    props: ['open', 'modelValue', 'testContext', 'title', 'variableGroups'],
    emits: ['update:modelValue', 'update:open'],
    template: '<div />',
  }),
}));

function fieldRow(key: string) {
  const row = document.body.querySelector<HTMLElement>(
    `[data-test="page-display-v2-field-row"][data-field-key="${key}"]`,
  );
  if (!row) throw new Error(`缺少字段 ${key}`);
  return row;
}
async function clickTab(title: string) {
  const tab = [
    ...document.body.querySelectorAll<HTMLElement>('[role="tab"]'),
  ].find((item) => item.textContent?.trim() === title);
  if (!tab) throw new Error(`缺少页签 ${title}`);
  tab.click();
  await flushPromises();
}

function setLeftAlias(key: string, value: string) {
  const input = fieldRow(key).querySelector('input');
  if (!input) throw new Error('缺少左侧别名输入');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function clickGroupConfirmation(text: string) {
  const button = [
    ...document.body.querySelectorAll<HTMLButtonElement>(
      '.ant-modal-confirm button',
    ),
  ].find((item) => item.textContent?.replaceAll(/\s/g, '') === text);
  if (!button) throw new Error(`缺少确认按钮：${text}`);
  button.click();
  await flushPromises();
}
function mountEditor(modelValue: CrudPageDisplayConfig = { version: 1 }) {
  const fields = Array.from({ length: 30 }, (_, index) => ({
    key: `field_${index}`,
    label: `字段 ${index}`,
    layoutGroup: index < 15 ? 'basic' : 'extra',
    layoutGroupTitle: index < 15 ? '基本信息' : '补充信息',
    search: true,
    table: true,
  }));
  return mount(PageDisplaySettingsDrawerV2, {
    attachTo: document.body,
    props: {
      code: '/clob/V1/User',
      fields,
      detailFields: [
        ...fields,
        { key: 'admin', label: '管理员', hasBackingField: false },
      ],
      modelValue,
      open: true,
      actionCandidates: [{ key: 'builtin:edit', label: '编辑' }],
      showOperationColumn: true,
    },
  });
}
function upload() {
  const button = [
    ...document.body.querySelectorAll<HTMLButtonElement>('button'),
  ].find((item) => item.textContent?.includes('上传设置'));
  if (!button) throw new Error('缺少上传按钮');
  button.click();
}

describe('界面UI设置2', () => {
  it('保持打开加载并显示和替换记录标题', async () => {
    const wrapper = mountEditor();
    try {
      await wrapper.setProps({ open: false });
      await wrapper.setProps({ open: true });
      expect(wrapper.emitted('load')).toHaveLength(1);
      await wrapper.setProps({
        settingRecord: {
          id: 'loaded',
          name: '加载记录',
          lastUpdateTime: '2026-09-21T10:00:00',
        },
      });
      expect(
        document.body.querySelector(
          '[data-testid="page-display-setting-record"]',
        )?.textContent,
      ).toContain('loaded');
      await wrapper.setProps({
        settingRecord: {
          id: 'saved',
          name: '上传记录',
          lastUpdateTime: '2026-09-21T11:00:00',
        },
      });
      const title = document.body.querySelector(
        '[data-testid="page-display-setting-record"]',
      )?.textContent;
      expect(title).toContain('saved');
      expect(title).toContain('上传记录');
      expect(title).toContain('2026-09-21T11:00:00');
      expect(title).not.toContain('loaded');
      await wrapper.setProps({ settingRecord: null });
      expect(
        document.body.querySelector(
          '[data-testid="page-display-setting-record"]',
        ),
      ).toBeNull();
    } finally {
      wrapper.unmount();
      document.body.innerHTML = '';
    }
  });

  it('清楚说明页面编码与作用范围的填写语义', () => {
    const wrapper = mountEditor();
    try {
      const scope = document.querySelector<HTMLElement>(
        '[data-test="page-display-v2-scope"]',
      );
      if (!scope) throw new Error('缺少作用范围设置区');

      expect(scope.textContent).toContain('页面编码（自动生成）');
      expect(scope.textContent).toContain('适用租户（留空匹配任意）');
      expect(scope.textContent).toContain(
        '适用站点（留空匹配任意；请先选择租户）',
      );
      expect(scope.textContent).toContain('适用用户类型（留空匹配任意）');
      expect(scope.textContent).toContain('适用用户类别（留空匹配任意）');
      expect(scope.textContent).toContain('适用组织类别（留空匹配任意）');
      expect(scope.textContent).toContain('适用组织类型（留空匹配任意）');
    } finally {
      wrapper.unmount();
    }
  });

  it('列表操作位于搜索之前，默认 true，保存回显且不使用首行测试上下文', async () => {
    const wrapper = mountEditor();
    let savedConfig: CrudPageDisplayConfig;
    try {
      await wrapper.setProps({
        scriptTestContext: {
          user: { id: 'user' },
          org: {},
          tenant: {},
          row: { secret: 'row' },
          form: {},
        },
      });
      await flushPromises();
      await clickTab('展示列表');
      expect(document.querySelectorAll('[role="tab"]')).toHaveLength(5);
      const area = document.querySelector(
        '[data-test="page-display-v2-list-operations"]',
      );
      const tools = document.querySelector(
        '[data-test="page-display-field-tools"]',
      );
      if (!area || !tools) throw new Error('缺少列表操作或搜索区域');
      expect(
        area.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      const openScript = area.querySelector<HTMLButtonElement>(
        '[aria-label="配置导出显示脚本"]',
      );
      if (!openScript) throw new Error('缺少导出显示脚本入口');
      openScript.click();
      await flushPromises();
      const dialog = wrapper.findComponent({ name: 'ScriptWorkbenchDialog' });
      expect(dialog.props('modelValue')).toBe('true');
      expect(dialog.props('testContext')).toEqual({
        user: { id: 'user' },
        org: {},
        tenant: {},
      });
      dialog.vm.$emit('update:modelValue', 'false');
      await flushPromises();
      upload();
      await flushPromises();
      const payload = wrapper.emitted('save')?.at(-1)?.[0] as {
        config: CrudPageDisplayConfig;
      };
      expect(payload.config.listOperations?.['tool:export']?.expression).toBe(
        'false',
      );
      expect(payload.config.list?.headers.length).toBeGreaterThan(0);
      savedConfig = payload.config;
    } finally {
      wrapper.unmount();
    }
    const reopened = mountEditor(savedConfig);
    try {
      await flushPromises();
      await clickTab('展示列表');
      document
        .querySelector<HTMLButtonElement>('[aria-label="配置导出显示脚本"]')
        ?.click();
      await flushPromises();
      expect(
        reopened
          .findComponent({ name: 'ScriptWorkbenchDialog' })
          .props('modelValue'),
      ).toBe('false');
    } finally {
      reopened.unmount();
    }
  });

  it('默认详情标题重名不阻止上传，但新增别名冲突仍拒绝', async () => {
    const wrapper = mountEditor();
    try {
      await wrapper.setProps({
        detailFields: [
          { key: 'orgId', label: '所属组织' },
          { key: 'orgName', label: '所属组织' },
          { key: 'name', label: '名称' },
        ],
      });
      await flushPromises();
      upload();
      await flushPromises();
      expect(wrapper.emitted('save')).toHaveLength(1);
      await clickTab('详情表单');
      setLeftAlias('name', '所属组织');
      upload();
      await flushPromises();
      expect(wrapper.emitted('save')).toHaveLength(1);
      setLeftAlias('name', '验收名称');
      upload();
      await flushPromises();
      expect(wrapper.emitted('save')).toHaveLength(2);
    } finally {
      wrapper.unmount();
    }
  });

  it('行操作名称仅作标签，排序控件一致且拖拽不跨入字段列表', async () => {
    const wrapper = mountEditor();
    try {
      await wrapper.setProps({
        actionCandidates: [
          { key: 'builtin:detail', label: '详情' },
          { key: 'builtin:edit', label: '编辑' },
        ],
      });
      await clickTab('展示列表');
      const operationLabel = fieldRow('__actions').querySelector('.font-bold');
      expect(operationLabel?.textContent?.trim()).toBe('操作列');
      expect(operationLabel?.classList.contains('text-primary')).toBe(true);
      const actions = () => [
        ...document.body.querySelectorAll<HTMLElement>(
          '[data-test="page-display-v2-action-row"]',
        ),
      ];
      const actionAt = (index: number) => {
        const row = actions()[index];
        if (!row) throw new Error(`缺少操作行 ${index}`);
        return row;
      };
      const label = actionAt(0).querySelector<HTMLElement>(
        '[data-test="page-display-v2-action-label"]',
      );
      if (!label) throw new Error('缺少操作名称标签');
      expect(label.tagName).toBe('SPAN');
      expect(label.hasAttribute('tabindex')).toBe(false);
      expect(
        actionAt(0).querySelector('[aria-label="拖动排序"]'),
      ).not.toBeNull();
      label.click();
      await flushPromises();
      expect(wrapper.findComponent(PropertyPanel).props('kind')).toBe('action');
      expect(wrapper.emitted('save')).toBeUndefined();

      // 操作拖拽只改变操作顺序；输入框拖拽、跨类型拖放及取消后落点均无效。
      const initialKeys = actions().map((row) => row.dataset.actionKey);
      const fieldKeys = () =>
        [
          ...document.body.querySelectorAll<HTMLElement>(
            '[data-test="page-display-v2-field-row"]',
          ),
        ].map((row) => row.dataset.fieldKey);
      const originalFields = fieldKeys();
      actionAt(1).dispatchEvent(new Event('dragstart', { bubbles: true }));
      actionAt(0).dispatchEvent(new Event('drop', { bubbles: true }));
      await flushPromises();
      expect(actions().map((row) => row.dataset.actionKey)).toEqual(
        initialKeys.toReversed(),
      );
      const inputDrag = new Event('dragstart', {
        bubbles: true,
        cancelable: true,
      });
      const input = actionAt(0).querySelector('input');
      if (!input) throw new Error('缺少操作别名输入框');
      input.dispatchEvent(inputDrag);
      expect(inputDrag.defaultPrevented).toBe(true);
      actionAt(1).dispatchEvent(new Event('drop', { bubbles: true }));
      actionAt(0).dispatchEvent(new Event('dragstart', { bubbles: true }));
      fieldRow('field_1').dispatchEvent(new Event('drop', { bubbles: true }));
      actionAt(0).dispatchEvent(new Event('dragend', { bubbles: true }));
      actionAt(1).dispatchEvent(new Event('drop', { bubbles: true }));
      fieldRow('field_1').dispatchEvent(
        new Event('dragstart', { bubbles: true }),
      );
      actionAt(0).dispatchEvent(new Event('drop', { bubbles: true }));
      await flushPromises();
      expect(fieldKeys()).toEqual(originalFields);
      expect(actions().map((row) => row.dataset.actionKey)).toEqual(
        initialKeys.toReversed(),
      );
      const moveDown = actionAt(0).querySelector<HTMLButtonElement>(
        '[aria-label="下移操作"]',
      );
      if (!moveDown) throw new Error('缺少操作下移按钮');
      moveDown.click();
      await flushPromises();
      expect(actions().map((row) => row.dataset.actionKey)).toEqual(
        initialKeys,
      );
    } finally {
      wrapper.unmount();
    }
  });

  it('列表状态在左侧直接操作，保留脚本角色且右侧没有重复开关', async () => {
    const modelValue: CrudPageDisplayConfig = {
      version: 1,
      list: {
        headers: [
          {
            key: 'field_0',
            visible: { mode: 'script', expression: 'true' },
            visibleRoleCodes: ['admin'],
          },
        ],
        actions: [
          {
            key: 'builtin:edit',
            label: '编辑',
            visible: { mode: 'script', expression: 'row.active' },
            visibleRoleCodes: ['editor'],
          },
        ],
      },
    };
    const wrapper = mountEditor(modelValue);
    try {
      await flushPromises();
      await clickTab('展示列表');
      expect(
        [...document.body.querySelectorAll('th')].at(-1)?.textContent?.trim(),
      ).toBe('是否展示');
      expect(
        wrapper
          .findComponent(PropertyPanel)
          .find('[aria-label="是否展示"]')
          .exists(),
      ).toBe(false);
      const toggle = fieldRow('field_0').querySelector<HTMLButtonElement>(
        'td:last-child button[role="switch"]',
      );
      if (!toggle) throw new Error('缺少列表字段开关');
      expect(toggle.getAttribute('aria-checked')).toBe('true');
      toggle.click();
      await flushPromises();
      expect(toggle.getAttribute('aria-checked')).toBe('false');

      // 切换操作行的状态无需改变右侧正在编辑的其它字段，也不自动上传。
      fieldRow('field_1').click();
      await flushPromises();
      const actionToggle = document.body.querySelector<HTMLButtonElement>(
        '[data-test="page-display-v2-action-row"] td:last-child button[role="switch"]',
      );
      if (!actionToggle) throw new Error('缺少操作行开关');
      actionToggle.click();
      await flushPromises();
      expect(actionToggle.getAttribute('aria-checked')).toBe('false');
      expect(wrapper.findComponent(PropertyPanel).props('item').key).toBe(
        'field_1',
      );
      expect(wrapper.emitted('save')).toBeUndefined();
      upload();
      await flushPromises();
      const payload = wrapper.emitted('save')?.at(-1)?.[0] as {
        config: CrudPageDisplayConfig;
      };
      expect(payload.config.list?.headers).toHaveLength(31);
      expect(
        payload.config.list?.headers.find((item) => item.key === 'field_0'),
      ).toMatchObject({
        visible: { mode: 'hidden', expression: 'true' },
        visibleRoleCodes: ['admin'],
      });
      expect(payload.config.list?.actions?.[0]).toMatchObject({
        visible: { mode: 'hidden', expression: 'row.active' },
        visibleRoleCodes: ['editor'],
      });
      expect(modelValue.list?.headers[0]?.visible?.mode).toBe('script');
    } finally {
      wrapper.unmount();
      document.body.innerHTML = '';
    }
  });

  it('取消删除分组保持完整草稿与字段归属不变', async () => {
    const wrapper = mountEditor();
    try {
      await flushPromises();
      upload();
      await flushPromises();
      const before = wrapper.emitted('save')?.at(-1)?.[0];
      document.body
        .querySelector<HTMLButtonElement>(
          'button[aria-label="删除分组 基本信息"]',
        )
        ?.click();
      await flushPromises();
      expect(document.body.textContent).toContain('确认删除分组“基本信息”？');
      expect(fieldRow('field_0').querySelector('select')?.value).toBe('basic');
      await clickGroupConfirmation('取消');
      upload();
      await flushPromises();
      expect(wrapper.emitted('save')?.at(-1)?.[0]).toEqual(before);
      expect(fieldRow('field_0').querySelector('select')?.value).toBe('basic');
    } finally {
      Modal.destroyAll();
      wrapper.unmount();
      document.body.innerHTML = '';
    }
  });

  it('表单视图左侧状态只读，右侧修改会同步标记', async () => {
    const wrapper = mountEditor();
    try {
      await flushPromises();
      for (const tab of ['查询表单', '新增表单', '编辑表单', '详情表单']) {
        await clickTab(tab);
        expect(
          [...document.body.querySelectorAll('th')].at(-1)?.textContent?.trim(),
        ).toBe('所属分组');
        const badge = fieldRow('field_0').querySelector<HTMLElement>(
          '[data-test="page-display-v2-visibility"]',
        );
        if (!badge) throw new Error('缺少展示状态标记');
        expect(badge.tagName).toBe('SPAN');
        expect(badge.textContent?.trim()).toBe('展示');
        badge.click();
        await flushPromises();
        expect(badge.textContent?.trim()).toBe('展示');

        // 通过右侧面板的补丁事件修改配置，左侧只消费状态，不提供修改事件。
        wrapper
          .findComponent(PropertyPanel)
          .vm.$emit('patch', { hidden: true, submitWhenHidden: true });
        await flushPromises();
        expect(badge.textContent?.trim()).toBe('隐藏');
        badge.click();
        await flushPromises();
        expect(badge.textContent?.trim()).toBe('隐藏');
        wrapper
          .findComponent(PropertyPanel)
          .vm.$emit('patch', { hidden: false, disabled: true });
        await flushPromises();
        expect(badge.textContent?.trim()).toBe('展示');
      }
    } finally {
      wrapper.unmount();
      document.body.innerHTML = '';
    }
  });

  it('删除默认分组不会在后续渲染中重建，字段回到不分组', async () => {
    const wrapper = mountEditor();
    try {
      await flushPromises();
      const groupButton = [
        ...document.body.querySelectorAll<HTMLButtonElement>('button'),
      ].find((button) => button.textContent?.trim() === '基本信息');
      if (!groupButton) throw new Error('缺少分组入口');
      groupButton.click();
      await flushPromises();
      expect(wrapper.findComponent(PropertyPanel).props('kind')).toBe('group');
      expect(document.body.textContent).toContain('分组 1：');
      document.body
        .querySelector<HTMLButtonElement>(
          'button[aria-label="删除分组 基本信息"]',
        )
        ?.click();
      await flushPromises();
      expect(fieldRow('field_0').querySelector('select')?.value).toBe('basic');
      expect(document.body.textContent).toContain('不会删除字段');
      await clickGroupConfirmation('删除分组');
      expect(fieldRow('field_0').querySelector('select')?.value).toBe('');
      upload();
      await flushPromises();
      const payload = wrapper.emitted('save')?.at(-1)?.[0] as {
        config: Record<string, any>;
      };
      expect(
        payload.config.query.groups.some(
          (group: { key: string }) => group.key === 'basic',
        ),
      ).toBe(false);
      expect(payload.config.query.fields[0]).toMatchObject({
        layoutGroupExcluded: true,
      });
    } finally {
      wrapper.unmount();
      document.body.innerHTML = '';
    }
  });

  it('完整字段清单只保留三列，右侧仅挂载一套属性控件', async () => {
    const wrapper = mountEditor();
    try {
      await flushPromises();
      expect(document.body.textContent).toContain('界面UI设置2');
      expect(
        document.body.querySelectorAll(
          '[data-test="page-display-v2-field-row"]',
        ),
      ).toHaveLength(30);
      expect(
        [...document.body.querySelectorAll('th')].map(
          (item) => item.textContent,
        ),
      ).toEqual(['字段', '标题别名', '所属分组']);
      expect(
        document.body.querySelectorAll(
          '[data-test="page-display-v2-field-list"] .ant-select',
        ),
      ).toHaveLength(0);
      expect(
        document.body.querySelectorAll(
          '[data-test="page-display-v2-property-panel"]',
        ),
      ).toHaveLength(1);
      fieldRow('field_29').click();
      await flushPromises();
      expect(wrapper.findComponent(PropertyPanel).props('item').key).toBe(
        'field_29',
      );
      expect(
        document.body.querySelectorAll(
          '[data-test="page-display-v2-property-panel"]',
        ),
      ).toHaveLength(1);
    } finally {
      wrapper.unmount();
      document.body.innerHTML = '';
    }
  });

  it('切换字段和视图后保留独立草稿，搜索末行不截断保存', async () => {
    const wrapper = mountEditor();
    try {
      await flushPromises();
      setLeftAlias('field_0', '查询标题');
      wrapper.findComponent(PropertyPanel).vm.$emit('patch', {
        hidden: true,
        submitWhenHidden: true,
      });
      await clickTab('新增表单');
      expect(wrapper.findComponent(PropertyPanel).props('item').label).not.toBe(
        '查询标题',
      );
      setLeftAlias('field_0', '新增标题');
      await clickTab('查询表单');
      expect(wrapper.findComponent(PropertyPanel).props('item').label).toBe(
        '查询标题',
      );
      const search = document.body.querySelector<HTMLInputElement>(
        'input[aria-label="搜索字段"]',
      );
      if (!search) throw new Error('缺少搜索框');
      search.value = 'field_29';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await flushPromises();
      expect(
        document.body.querySelectorAll(
          '[data-test="page-display-v2-field-row"]',
        ),
      ).toHaveLength(1);
      expect(wrapper.findComponent(PropertyPanel).props('item').key).toBe(
        'field_29',
      );
      setLeftAlias('field_29', '末行修改');
      upload();
      await flushPromises();
      const payload = wrapper.emitted('save')?.at(-1)?.[0] as {
        config: Record<string, any>;
      };
      expect(payload.config.query.fields).toHaveLength(30);
      expect(payload.config.query.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'field_0',
            label: '查询标题',
            submitWhenHidden: true,
          }),
          expect.objectContaining({ key: 'field_29', label: '末行修改' }),
        ]),
      );
      expect(payload.config.create.fields[0].label).toBe('新增标题');
      expect(wrapper.props('modelValue')).toEqual({ version: 1 });
    } finally {
      wrapper.unmount();
      document.body.innerHTML = '';
    }
  });

  it('支持上下排序、跨组拖拽以及调整分组', async () => {
    const wrapper = mountEditor();
    try {
      await flushPromises();
      fieldRow('field_1')
        .querySelector<HTMLButtonElement>(
          'button[aria-label="上移字段 field_1"]',
        )
        ?.click();
      await flushPromises();
      expect(
        document.body.querySelector('[data-test="page-display-v2-field-row"]')
          ?.dataset.fieldKey,
      ).toBe('field_1');
      const select = fieldRow('field_0').querySelector('select');
      if (!select) throw new Error('缺少分组选择');
      select.value = '';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await flushPromises();
      fieldRow('field_0').dispatchEvent(
        new Event('dragstart', { bubbles: true, cancelable: true }),
      );
      fieldRow('field_15').dispatchEvent(new Event('drop', { bubbles: true }));
      await flushPromises();
      expect(fieldRow('field_0').querySelector('select')?.value).toBe('extra');
      upload();
      await flushPromises();
      const payload = wrapper.emitted('save')?.at(-1)?.[0] as {
        config: Record<string, any>;
      };
      expect(
        payload.config.query.fields.find(
          (item: { key: string }) => item.key === 'field_0',
        ),
      ).toMatchObject({ layoutGroup: 'extra', layoutGroupExcluded: false });
    } finally {
      wrapper.unmount();
      document.body.innerHTML = '';
    }
  });

  it('未编辑时跨详情和列表切换后可直接关闭，原身份字段不触发递归更新', async () => {
    const wrapper = mountEditor();
    try {
      await flushPromises();
      for (const name of ['详情表单', '展示列表', '编辑表单', '查询表单'])
        await clickTab(name);
      document.body
        .querySelector<HTMLButtonElement>('.ant-drawer-close')
        ?.click();
      await flushPromises();
      expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
    } finally {
      wrapper.unmount();
      document.body.innerHTML = '';
    }
  });
});
