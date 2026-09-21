import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';

import { AutoComplete, Select, Switch, Tooltip } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import PageDisplaySettingsDrawer from '../page-display-settings-drawer.vue';
import PageDisplaySettingsDetailTab from '../page-display-settings-detail-tab.vue';
import PageDisplaySettingsListTab from '../page-display-settings-list-tab.vue';

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
    props: { testContext: Object },
    template: '<div />',
  }),
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
    button.textContent?.includes('上传设置'),
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

async function searchFields(keyword: string) {
  // 抽屉通过 Teleport 挂载，输入事件使用真实搜索框驱动过滤。
  const input = document.body.querySelector<HTMLInputElement>(
    'input[aria-label="搜索字段"]',
  );
  if (!input) throw new Error('缺少字段搜索框');
  input.value = keyword;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flushPromises();
}

describe('页面展示设置抽屉', () => {
  it('打开和重开不加载，手动加载才发出事件，并替换标题记录', async () => {
    const wrapper = mountDrawer(false);
    try {
      await flushPromises();
      await wrapper.setProps({ open: false });
      await wrapper.setProps({ open: true });
      expect(wrapper.emitted('load')).toBeUndefined();
      const loadButton = Array.from(
        document.body.querySelectorAll('button'),
      ).find((button) => button.textContent?.includes('加载设置'))!;
      loadButton.click();
      expect(wrapper.emitted('load')).toHaveLength(1);
      await wrapper.setProps({
        settingRecord: {
          id: 'loaded',
          name: '已加载',
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
          name: '已上传',
          lastUpdateTime: '2026-09-21T11:00:00',
        },
      });
      const title = document.body.querySelector(
        '[data-testid="page-display-setting-record"]',
      )?.textContent;
      expect(title).toContain('saved');
      expect(title).toContain('已上传');
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

  it.each([
    ['query', '查询表单'],
    ['create', '新增表单'],
    ['edit', '编辑表单'],
    ['detail', '详情表单'],
    ['list', '展示列表'],
  ] as const)(
    '%s 在完整字段集合中同时搜索名称和别名且不截断保存',
    async (view, tab) => {
      const fields = Array.from({ length: 25 }, (_, index) => {
        let label = `字段 ${index}`;
        if (index === 0) label = '用户名称';
        if (index === 24) label = '尾部字段';
        return { key: `field_${index}`, label, search: true, table: true };
      });
      const wrapper = mount(PageDisplaySettingsDrawer, {
        attachTo: document.body,
        props: {
          code: '/clob/V1/User',
          fields,
          detailFields: fields,
          modelValue: {
            version: 1,
            [view]:
              view === 'list'
                ? { headers: [{ key: 'field_24', title: '用户别名' }] }
                : { fields: [{ key: 'field_24', label: '用户别名' }] },
          },
          open: false,
        },
      });
      try {
        await wrapper.setProps({ open: true });
        getTab(tab).click();
        await flushPromises();
        const renderedRows = () =>
          document.body.querySelectorAll(
            '.page-display-settings-field-row[draggable="true"]',
          );
        expect(renderedRows()).toHaveLength(12);

        // 候选同时包含原名称和当前别名，包括尚未挂载的末行；同名内容仅出现一次。
        const suggestions = wrapper
          .findComponent(AutoComplete)
          .props('options')
          .map((option: { value: string }) => option.value);
        expect(suggestions).toContain('尾部字段');
        expect(suggestions).toContain('用户别名');
        expect(
          suggestions.filter((value: string) => value === '用户名称'),
        ).toHaveLength(1);

        // 属性名作为完整尾段追加，不与每个字段的名称或别名穿插。
        expect(suggestions.slice(-fields.length)).toEqual(
          fields.map((field) => field.key),
        );

        // 一个词分别命中第一行名称和末行别名，后者起初并没有挂载。
        await searchFields('用户');
        expect(renderedRows()).toHaveLength(2);
        for (const keyword of ['尾部字段', '用户别名', '  FiELD_24  ']) {
          await searchFields(keyword);
          expect(renderedRows()).toHaveLength(1);
          expect(renderedRows()[0]?.textContent).toContain('尾部字段');
        }

        // 在编码匹配时编辑别名，再以零结果搜索保存，确认完整草稿仍保留。
        const alias = document.body.querySelector<HTMLInputElement>(
          'input[placeholder="尾部字段"]',
        );
        if (!alias) throw new Error('缺少末行标题别名');
        alias.value = '已编辑别名';
        alias.dispatchEvent(new Event('input', { bubbles: true }));
        await flushPromises();
        await searchFields('没有这个字段');
        expect(renderedRows()).toHaveLength(0);
        expect(document.body.textContent).toContain('未找到匹配的字段');
        getUploadButton().click();
        await flushPromises();
        const payload = wrapper.emitted('save')?.at(-1)?.[0] as {
          config: Record<string, any>;
        };
        const saved =
          view === 'list'
            ? payload.config.list.headers
            : payload.config[view].fields;
        expect(saved).toHaveLength(25);
        expect(
          saved.find((field: { key: string }) => field.key === 'field_24'),
        ).toMatchObject(
          view === 'list' ? { title: '已编辑别名' } : { label: '已编辑别名' },
        );
        expect(JSON.stringify(payload)).not.toContain('没有这个字段');
        await searchFields('');
        expect(renderedRows()).toHaveLength(12);
      } finally {
        wrapper.unmount();
        document.body.innerHTML = '';
      }
    },
  );

  it('计算属性详情补齐后保持数组与字段身份稳定', async () => {
    // 一个计算属性就能触发旧实现的重复替换，测试不依赖大字段规模。
    const wrapper = mountDrawer(false);
    try {
      await wrapper.setProps({
        detailFields: [
          { key: 'admin', label: '管理员', hasBackingField: false },
        ],
      });
      const state = wrapper.vm.$.setupState as unknown as {
        ensureFields: (
          view: 'detail',
        ) => Array<{ hidden?: boolean; key: string; label?: string }>;
      };
      const fields = state.ensureFields('detail');
      const field = fields[0];
      if (!field) throw new Error('缺少计算属性详情草稿');
      field.label = '身份标识';

      // 补齐既不能反复生成对象，也不能丢弃已有字段草稿。
      expect(state.ensureFields('detail')).toBe(fields);
      expect(state.ensureFields('detail')[0]).toBe(fields[0]);
      expect(fields[0]).toMatchObject({ hidden: true, label: '身份标识' });

      // 显式错误的展示值只纠正一次，纠正后仍应复用已补齐结果。
      field.hidden = false;
      const corrected = state.ensureFields('detail');
      expect(corrected[0]).toMatchObject({ hidden: true, label: '身份标识' });
      expect(state.ensureFields('detail')).toBe(corrected);
    } finally {
      wrapper.unmount();
      document.body.innerHTML = '';
    }
  });

  it('搜索词按页签隔离、列表可搜索操作且重新打开后清空', async () => {
    const wrapper = mountDrawer(false, true);
    try {
      await wrapper.setProps({
        actionCandidates: [
          { key: 'assignRoles', label: '分配角色' },
          { key: 'builtin:edit', label: '编辑' },
        ],
      });
      await flushPromises();
      await searchFields('名称');
      getTab('新增表单').click();
      await flushPromises();
      expect(
        document.body.querySelector<HTMLInputElement>(
          'input[aria-label="搜索字段"]',
        )?.value,
      ).toBe('');

      // 操作行与字段行应用相同的搜索条件，且完整保存仍包含未匹配操作。
      getTab('展示列表').click();
      await flushPromises();
      await searchFields('分配角色');
      expect(
        document.body.querySelectorAll(
          '[data-test="page-display-settings-action-row"]',
        ),
      ).toHaveLength(1);
      expect(document.body.textContent).toContain('匹配 1 / 3 项');
      getUploadButton().click();
      await flushPromises();
      expect(wrapper.emitted('save')?.at(-1)?.[0]).toMatchObject({
        config: {
          list: {
            actions: [
              expect.objectContaining({ key: 'assignRoles' }),
              expect.objectContaining({ key: 'builtin:edit' }),
            ],
          },
        },
      });

      getTab('查询表单').click();
      await flushPromises();
      expect(
        document.body.querySelector<HTMLInputElement>(
          'input[aria-label="搜索字段"]',
        )?.value,
      ).toBe('名称');
      await wrapper.setProps({ open: false });
      await wrapper.setProps({ open: true });
      await flushPromises();
      expect(
        document.body.querySelector<HTMLInputElement>(
          'input[aria-label="搜索字段"]',
        )?.value,
      ).toBe('');
    } finally {
      wrapper.unmount();
      document.body.innerHTML = '';
    }
  });

  it('将详情和展示列表的专属设置交由独立 Tab 组件渲染', async () => {
    const wrapper = mountDrawer(false);
    await flushPromises();

    getTab('详情表单').click();
    await flushPromises();
    expect(wrapper.findComponent(PageDisplaySettingsDetailTab).exists()).toBe(
      true,
    );

    getTab('展示列表').click();
    await flushPromises();
    expect(wrapper.findComponent(PageDisplaySettingsListTab).exists()).toBe(
      true,
    );

    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('含用户身份计算属性时可反复切换详情、修改标题并保存完整草稿', async () => {
    // 模拟用户页真实身份字段；只需两个字段便能覆盖递归更新的触发条件。
    const fields = [
      { key: 'name', label: '名称', search: true, table: true },
      { key: 'admin', label: '管理员', hasBackingField: false, form: false },
    ];
    const wrapper = mount(PageDisplaySettingsDrawer, {
      attachTo: document.body,
      props: {
        code: '/clob/V1/User',
        fields,
        detailFields: fields,
        modelValue: { version: 1 },
        open: false,
      },
    });
    try {
      await wrapper.setProps({ open: true });
      await flushPromises();

      // 等待每轮渲染稳定，任一未处理的递归更新异常都会使 Vitest 失败。
      for (const title of [
        '详情表单',
        '展示列表',
        '新增表单',
        '编辑表单',
        '详情表单',
      ]) {
        getTab(title).click();
        await flushPromises();
      }
      const aliasInput = getTitleAliasInput();
      aliasInput.value = '用户名称';
      aliasInput.dispatchEvent(new Event('input', { bubbles: true }));
      await flushPromises();
      getTab('查询表单').click();
      await flushPromises();
      getTab('详情表单').click();
      await flushPromises();
      expect(getTitleAliasInput().value).toBe('用户名称');

      // 保存仍包含身份字段的隐藏约束与用户修改，不能以过滤字段规避崩溃。
      getUploadButton().click();
      await flushPromises();
      const payload = wrapper.emitted('save')?.[0]?.[0] as {
        config: {
          detail: {
            fields: Array<{ hidden?: boolean; key: string; label?: string }>;
          };
        };
      };
      expect(payload.config.detail.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'admin', hidden: true }),
          expect.objectContaining({ key: 'name', label: '用户名称' }),
        ]),
      );
    } finally {
      wrapper.unmount();
      document.body.innerHTML = '';
    }
  });

  it('大字段页签共用一棵活动编辑树并复用同键输入控件', async () => {
    // 允许旧实现完成帧调度，以直接对照切换是否不必要地重建控件。
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      queueMicrotask(() => callback(performance.now()));
      return 1;
    });
    const fields = Array.from({ length: 13 }, (_, index) => ({
      key: `field_${index}`,
      label: `字段 ${index}`,
      search: true,
      table: true,
    }));
    const wrapper = mount(PageDisplaySettingsDrawer, {
      attachTo: document.body,
      props: {
        code: '/clob/V1/LargeFieldSet',
        detailFields: fields,
        fields,
        modelValue: { version: 1 },
        open: true,
        saving: false,
      },
    });
    try {
      await flushPromises();
      const content = document.body.querySelector(
        '.page-display-settings-tab-content',
      );
      const input = document.body.querySelector('input[placeholder="字段 0"]');
      getTab('新增表单').click();
      await flushPromises();
      expect(
        document.body.querySelector('.page-display-settings-tab-content'),
      ).toBe(content);
      expect(document.body.querySelector('input[placeholder="字段 0"]')).toBe(
        input,
      );

      // 即使连续切换也只有最后一个视图，不留下后台缓存树；关闭时完整卸载。
      getTab('编辑表单').click();
      getTab('详情表单').click();
      getTab('展示列表').click();
      await flushPromises();
      expect(wrapper.findComponent(PageDisplaySettingsListTab).exists()).toBe(
        true,
      );
      expect(wrapper.findComponent(PageDisplaySettingsDetailTab).exists()).toBe(
        false,
      );
      expect(
        document.body.querySelectorAll('.page-display-settings-tab-content'),
      ).toHaveLength(1);
      await wrapper.setProps({ open: false });
      await flushPromises();
      expect(
        document.body.querySelector('.page-display-settings-tab-content'),
      ).toBeNull();
    } finally {
      vi.unstubAllGlobals();
      wrapper.unmount();
      document.body.innerHTML = '';
    }
  });

  it('多分组大字段表单视图按当前页签总数分批渲染', async () => {
    const fields = Array.from({ length: 36 }, (_, index) => ({
      key: `field_${index}`,
      label: `字段 ${index}`,
      layoutGroup: `group_${Math.floor(index / 12)}`,
      layoutGroupTitle: `分组 ${Math.floor(index / 12) + 1}`,
      search: true,
    }));
    const wrapper = mount(PageDisplaySettingsDrawer, {
      attachTo: document.body,
      props: {
        code: '/clob/V1/LargeGroupedFieldSet',
        detailFields: fields,
        fields,
        modelValue: { version: 1 },
        open: true,
        saving: false,
      },
    });
    try {
      await flushPromises();
      expect(
        document.body.querySelectorAll(
          '.page-display-settings-field-row[draggable="true"]',
        ),
      ).toHaveLength(12);

      const scrollContainer = document.body.querySelector(
        '[data-test="page-display-settings-scroll"]',
      ) as HTMLElement;
      Object.defineProperties(scrollContainer, {
        clientHeight: { configurable: true, value: 100 },
        scrollHeight: { configurable: true, value: 300 },
        scrollTop: { configurable: true, value: 200 },
      });
      scrollContainer.dispatchEvent(new Event('scroll'));
      await nextTick();
      await flushPromises();
      expect(
        document.body.querySelectorAll(
          '.page-display-settings-field-row[draggable="true"]',
        ),
      ).toHaveLength(24);
    } finally {
      wrapper.unmount();
      document.body.innerHTML = '';
    }
  });

  it('复用控件后各视图的标题和提交状态仍独立读写', async () => {
    const wrapper = mountDrawer(false);
    // 同一字段在三个视图使用不同值，验证复用后事件始终写入当前草稿。
    const scenes = [
      { tab: '查询表单', alias: '查询标题', mode: 'hidden-submit' },
      { tab: '新增表单', alias: '新增标题', mode: 'disabled-submit' },
      { tab: '编辑表单', alias: '编辑标题', mode: 'hidden-omit' },
    ];
    try {
      await flushPromises();
      for (const scene of scenes) {
        getTab(scene.tab).click();
        await flushPromises();
        const input = getTitleAliasInput();
        expect(input.value).toBe('');
        input.value = scene.alias;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const mode = document.body.querySelector<HTMLInputElement>(
          `input[value="${scene.mode}"]`,
        );
        if (!mode) throw new Error('缺少字段提交状态');
        mode.click();
        await flushPromises();
      }

      // 逐一回访核验控件回显，再通过保存载荷检查没有发生跨视图写入。
      for (const scene of scenes) {
        getTab(scene.tab).click();
        await flushPromises();
        expect(getTitleAliasInput().value).toBe(scene.alias);
        expect(
          document.body.querySelector<HTMLInputElement>(
            `input[value="${scene.mode}"]`,
          )?.checked,
        ).toBe(true);
      }
      getUploadButton().click();
      await flushPromises();
      expect(wrapper.emitted('save')?.at(-1)?.[0]).toMatchObject({
        config: {
          query: {
            fields: [
              { label: '查询标题', hidden: true, submitWhenHidden: true },
            ],
          },
          create: {
            fields: [{ label: '新增标题', hidden: false, disabled: true }],
          },
          edit: {
            fields: [
              { label: '编辑标题', hidden: true, submitWhenHidden: false },
            ],
          },
        },
      });
    } finally {
      wrapper.unmount();
      document.body.innerHTML = '';
    }
  });

  it('将脚本测试上下文传给公共脚本工作台', async () => {
    const wrapper = mountDrawer(false);
    await wrapper.setProps({
      scriptTestContext: {
        form: { name: '首条记录' },
        org: { name: '当前组织' },
        row: { name: '首条记录' },
        tenant: { name: '当前租户' },
        user: { username: '当前用户' },
      },
    });
    await flushPromises();
    expect(
      wrapper
        .findComponent({ name: 'ScriptWorkbenchDialog' })
        .props('testContext'),
    ).toMatchObject({
      user: { username: '当前用户' },
    });
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('exposes each concrete row action as an independent display property', async () => {
    const wrapper = mount(PageDisplaySettingsDrawer, {
      attachTo: document.body,
      props: {
        actionCandidates: [
          { key: 'builtin:edit', label: '编辑' },
          { key: 'builtin:delete', label: '删除' },
        ],
        code: '/clob/V1/Dict',
        detailFields: [{ key: 'name', label: '名称' }],
        fields: [{ key: 'name', label: '名称', search: true, table: true }],
        modelValue: { version: 1 },
        open: true,
        saving: false,
        showOperationColumn: true,
      },
    });
    try {
      await flushPromises();
      getTab('展示列表').click();
      await flushPromises();
      expect(document.body.textContent).toContain('操作');
      expect(
        document.body.querySelectorAll('button[aria-label="添加脚本"]'),
      ).not.toHaveLength(0);
      expect(document.body.textContent).not.toContain('列值脚本');
      expect(document.body.textContent).not.toContain('标题脚本');
      expect(
        document.body
          .querySelector('[data-test="page-display-settings-grid-header"]')
          ?.classList.contains('bg-primary-background-lightest'),
      ).toBe(true);
      expect(document.body.innerHTML).toContain('sticky left-[86px] z-30');
      expect(document.body.innerHTML).toContain(
        'page-display-settings-fixed-cell',
      );
      expect(document.body.innerHTML).toContain(
        'page-display-settings-fixed-body-cell',
      );
      expect(document.body.innerHTML).toContain(
        'page-display-settings-fixed-control-cell',
      );
      expect(document.body.innerHTML).toContain(
        'page-display-settings-fixed-header-cell',
      );
      expect(document.body.innerHTML).toContain(
        'page-display-settings-grid-header',
      );
      expect(
        document.body
          .querySelector('[data-test="page-display-settings-scroll"]')
          ?.classList.contains('overflow-auto'),
      ).toBe(true);
      expect(
        document.body.querySelectorAll(
          '.page-display-settings-field-row[draggable="true"]',
        ),
      ).not.toHaveLength(0);
      expect(document.body.textContent).not.toContain('值展示脚本');
      expect(document.body.textContent).toContain('编辑');
      expect(document.body.textContent).toContain('删除');
      expect(document.body.textContent).not.toContain('操作编辑');
      expect(
        document.body.querySelectorAll(
          '[data-test="page-display-settings-action-row"]',
        ),
      ).toHaveLength(2);
      expect(
        document.body
          .querySelector('[data-test="page-display-settings-action-row"]')
          ?.getAttribute('style'),
      ).toContain(
        'grid-template-columns: 66px 110px 190px 120px 124px 124px 124px 120px 200px 200px 100px',
      );
      expect(
        document.body
          .querySelector('[data-test="page-display-settings-action-row"]')
          ?.classList.contains('gap-x-5'),
      ).toBe(true);

      getUploadButton().click();
      await nextTick();
      const payload = wrapper.emitted('save')?.[0]?.[0] as {
        config: Record<string, any>;
      };
      expect(payload.config.list.headers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: '__actions', label: '操作' }),
        ]),
      );
      expect(payload.config.list.actions).toEqual([
        {
          key: 'builtin:edit',
          label: '编辑',
          order: 0,
          visible: { mode: 'always' },
          visibleRoleCodes: [],
        },
        {
          key: 'builtin:delete',
          label: '删除',
          order: 1,
          visible: { mode: 'always' },
          visibleRoleCodes: [],
        },
      ]);
    } finally {
      wrapper.unmount();
      document.body.innerHTML = '';
    }
  });

  it.each([undefined, { fields: [{ key: 'tenantId' }] }])(
    '租户编辑设置缺省或稀疏时选中不提，新增查询保持展提',
    async (edit) => {
      const wrapper = mount(PageDisplaySettingsDrawer, {
        attachTo: document.body,
        props: {
          code: '/clob/V1/Dict',
          fields: [{ key: 'tenantId', label: '租户ID', search: true }],
          detailFields: [{ key: 'tenantId', label: '租户ID' }],
          modelValue: { version: 1, edit },
          open: true,
          saving: false,
        },
      });
      try {
        await flushPromises();
        getTab('编辑表单').click();
        await flushPromises();
        const group = document.body.querySelector(
          '[aria-label="租户ID展示与提交"]',
        );
        expect(group).toBeTruthy();
        if (!group) throw new Error('缺少租户字段展示设置');
        expect(
          (
            group.querySelector(
              'input[value="hidden-omit"]',
            ) as HTMLInputElement
          ).checked,
        ).toBe(true);
        getUploadButton().click();
        await nextTick();
        const payload = wrapper.emitted('save')?.[0]?.[0] as {
          config: Record<string, any>;
        };
        expect(payload.config.edit.fields[0]).toMatchObject({
          key: 'tenantId',
          hidden: true,
        });
        expect(payload.config.edit.fields[0].submitWhenHidden).not.toBe(true);
        expect(payload.config.create.fields[0].hidden).toBe(false);
        expect(payload.config.query.fields[0].hidden).toBe(false);
      } finally {
        wrapper.unmount();
        document.body.innerHTML = '';
      }
    },
  );

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

  it('切换页签后由共享草稿保留字段编辑值', async () => {
    const wrapper = mountDrawer(false);
    await flushPromises();

    const queryAliasInput = getTitleAliasInput();
    expect(queryAliasInput).toBeTruthy();
    queryAliasInput.value = '查询别名';
    queryAliasInput.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();

    getTab('展示列表').click();
    await nextTick();
    expect(getTitleAliasInput()).not.toBe(queryAliasInput);

    getTab('查询表单').click();
    await nextTick();
    expect(getTitleAliasInput().value).toBe('查询别名');

    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('在展示列表的最后提供操作列配置，并保存其默认宽度', async () => {
    const wrapper = mountDrawer(false, true);
    await flushPromises();

    getTab('展示列表').click();
    await nextTick();

    expect(document.body.textContent).toContain('编辑');
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
    expect(
      document.body.querySelector('button[aria-label="添加脚本"]'),
    ).toBeTruthy();
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

  it.each(['新增表单', '编辑表单'] as const)(
    '%s 按稳定字段键去重',
    async (tabName) => {
      const wrapper = mount(PageDisplaySettingsDrawer, {
        attachTo: document.body,
        props: {
          code: '/clob/V1/DeduplicatedField',
          detailFields: [],
          fields: [
            { key: 'tenantId', label: '归属租户' },
            { key: 'name', label: '名称' },
            { key: 'tenantId', label: '归属租户' },
          ],
          modelValue: { version: 1 },
          open: true,
          saving: false,
        },
      });
      await flushPromises();
      getTab(tabName).click();
      await flushPromises();
      expect(
        document.body.querySelectorAll('input[placeholder="归属租户"]'),
      ).toHaveLength(1);
      wrapper.unmount();
      document.body.innerHTML = '';
    },
  );

  it('新增虚拟字段始终位于操作列之前', async () => {
    const wrapper = mountDrawer(false, true);
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
    const virtualField = document.body.querySelector(
      'input[placeholder="虚拟字段编码"]',
    ) as HTMLInputElement;
    const operationHeader = document.body.querySelector(
      'input[placeholder="操作"]',
    ) as HTMLInputElement;
    expect(
      virtualField.compareDocumentPosition(operationHeader) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
