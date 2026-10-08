import { readFileSync } from 'node:fs';

import { flushPromises, mount } from '@vue/test-utils';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Basic from '../basic.vue';
import {
  captureBindCallbackBeforeStartup,
  clearPendingBindCallback,
  hasPendingBindCallback,
} from '../../views/_core/profile/oauth-bind-callback';

const mocks = vi.hoisted(() => ({
  adminMenuSyncService: null as null | Record<string, never>,
  adminUserMessageService: null as null | {
    list: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
    unreadCount: ReturnType<typeof vi.fn>;
  },
  messageReadListener: undefined as (() => void) | undefined,
  stopMessageReadListener: vi.fn(),
  accessToken: '',
  routePath: '/index',
  destroyWatermark: vi.fn(),
  loadAuthBrand: vi.fn().mockResolvedValue(undefined),
  refreshAuthBrand: vi.fn().mockResolvedValue(undefined),
  registerPreferencesUploadAction: vi.fn(() => vi.fn()),
  preferences: {
    app: {
      defaultHomePath: '/analytics',
      watermark: false,
      watermarkColor: 'gray',
      watermarkColorCustom: false,
      watermarkTransparency: 85,
      watermarkContent: '',
    },
    navigation: {
      gradientEndColor: '#fff4f5',
      gradientTransitionColor: '#f1efff',
      gradientTransitionColorEnabled: false,
      visualStyle: 'minimal',
    },
  },
  updateWatermark: vi.fn(),
  push: vi.fn(),
  userInfo: {} as Record<string, any>,
}));

vi.mock(
  '@levin/admin-framework/framework-commons/app/views/_core/authentication/auth-brand',
  async () => {
    const { ref } = await vi.importActual<typeof import('vue')>('vue');

    return {
      useAuthBrand: () => ({
        appName: ref('租户站点后台'),
        copyright: ref('租户站点版权'),
        heroImage: ref(''),
        loadAuthBrand: mocks.loadAuthBrand,
        logo: ref(''),
        refreshAuthBrand: mocks.refreshAuthBrand,
      }),
    };
  },
);

vi.mock('@vben/common-ui', () => ({
  AuthenticationLoginExpiredModal: {
    template: '<div><slot /></div>',
  },
}));

vi.mock('@vben/runtime/hooks', () => ({
  useAppConfig: () => ({
    apiURL: '',
  }),
  useWatermark: () => ({
    destroyWatermark: mocks.destroyWatermark,
    updateWatermark: mocks.updateWatermark,
  }),
}));

vi.mock('@vben/layouts', () => ({
  BasicLayout: {
    emits: ['clickLogo'],
    template: `
      <section data-testid="basic-layout">
        <button data-testid="logo-text" @click="$emit('clickLogo')"><slot name="logo-text" /></button>
        <div data-testid="footer"><slot name="footer" /></div>
        <slot name="user-dropdown" />
        <slot name="notification" />
        <slot name="extra" />
        <slot name="lock-screen" />
      </section>
    `,
  },
  LockScreen: {
    template: '<div />',
  },
  Notification: {
    props: ['count', 'notifications'],
    emits: ['read', 'clear', 'makeAll'],
    template: `<div data-testid="notification" :data-count="count">
      <button v-for="item in notifications" :key="item.id" :data-testid="'message-' + item.id" :data-link="item.link" :data-query="JSON.stringify(item.query)" @click="$emit('read', item)">{{ item.title }}</button>
      <button data-testid="clear-messages" @click="$emit('clear')">清空预览</button>
    </div>`,
  },
  registerPreferencesUploadAction: mocks.registerPreferencesUploadAction,
  UserDropdown: {
    props: ['systemMenus'],
    template: `
      <div>
        <button
          v-for="menu in systemMenus"
          :key="menu.id"
          :data-testid="'system-menu-' + menu.id"
          @click="menu.handler"
        >{{ menu.text }}</button>
      </div>
    `,
  },
}));

vi.mock('@vben-core/foundation/preferences', () => ({
  preferences: mocks.preferences,
}));

vi.mock('@vben/runtime/stores', () => ({
  useAccessStore: () => ({
    accessToken: mocks.accessToken,
    loginExpired: false,
  }),
  useUserStore: () => ({
    userInfo: mocks.userInfo,
  }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mocks.push,
    currentRoute: { value: { path: mocks.routePath } },
  }),
}));

vi.mock('@levin/admin-framework', () => ({
  getAdminMenuSyncService: () => mocks.adminMenuSyncService,
  getAdminUserMessageService: () => mocks.adminUserMessageService,
}));

vi.mock('@levin/admin-framework/framework-commons/app/locales', () => ({
  $t: (key: string) => key,
}));

vi.mock('@levin/admin-framework/framework-commons/app/pages', () => ({
  resolveAdminPage: () => async () => ({ template: '<div />' }),
}));

vi.mock('@levin/admin-framework/framework-commons/app/store', () => ({
  useAuthStore: () => ({
    logout: vi.fn(),
  }),
}));

vi.mock('../../../event-bus', () => ({
  getFrameworkEventListeners: () => [],
  onFrameworkEvent: (_type: string, _topic: string, listener: () => void) => {
    mocks.messageReadListener = listener;
    return mocks.stopMessageReadListener;
  },
  removeFrameworkEventListener: vi.fn(),
  setFrameworkEventListenerEnabled: vi.fn(),
}));

vi.mock('../../../runtime', () => ({
  getAdminI18nLabelSyncService: () => null,
  getAdminUserMessageService: () => mocks.adminUserMessageService,
}));

vi.mock('../../../shared/user-dropdown-menu-service', () => ({
  getUserDropdownMenuItems: () => ({
    value: [],
  }),
}));

vi.mock('../sync-i18n-labels-modal.vue', () => ({
  default: {
    template: '<div />',
  },
}));

vi.mock('../sync-menu-routes-modal.vue', () => ({
  default: {
    template: '<div />',
  },
}));

vi.mock('../admin-ui-preferences-setting', () => ({
  ADMIN_UI_PREFERENCES_SETTING_CODE: '界面偏好设置',
  loadAdminUiPreferencesScopeOptions: vi.fn().mockResolvedValue({}),
  saveAdminUiPreferencesSetting: vi.fn(),
}));

describe('basic layout tenant site brand', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearPendingBindCallback();
    mocks.routePath = '/index';
    mocks.loadAuthBrand.mockClear();
    mocks.stopMessageReadListener.mockClear();
    mocks.registerPreferencesUploadAction.mockClear();
    mocks.adminMenuSyncService = null;
    mocks.adminUserMessageService = null;
    mocks.accessToken = '';
    mocks.userInfo.superAdmin = false;
  });

  afterEach(() => {
    clearPendingBindCallback();
    vi.useRealTimers();
  });

  it.each(['/index', '/profile'])(
    '绑定回跳 %s 保留业务路由并只恢复相应个人中心入口',
    async (path) => {
      mocks.accessToken = 'valid-session';
      mocks.routePath = path;
      captureBindCallbackBeforeStartup(
        `https://example.test${path}?from=group&oauthTransaction=tx&oauthInAppCode=code&oauthInAppState=state`,
        vi.fn(),
      );
      const wrapper = mount(Basic, {
        global: {
          stubs: {
            Button: true,
            Empty: true,
            Popconfirm: true,
            Tag: true,
            AModal: {
              props: ['open', 'title'],
              template:
                '<section :data-title="title" :data-open="open"><slot /></section>',
            },
          },
        },
      });
      await flushPromises();
      const modal = wrapper.find('[data-title="page.auth.profile"]');
      expect(modal.attributes('data-open')).toBe(
        path === '/index' ? 'true' : 'false',
      );
      expect(mocks.push).not.toHaveBeenCalled();
      expect(hasPendingBindCallback()).toBe(true);
      if (path === '/index')
        expect(wrapper.find('[initial-tab="social-account"]').exists()).toBe(
          true,
        );
      wrapper.unmount();
    },
  );

  it('登录后每三分钟同步一次通知，并在布局卸载后停止同步', async () => {
    mocks.accessToken = 'access-token';
    mocks.adminUserMessageService = {
      list: vi.fn().mockResolvedValue({ items: [], totals: 0 }),
      unreadCount: vi.fn().mockResolvedValue(0),
      markRead: vi.fn().mockResolvedValue(undefined),
    };

    const wrapper = mount(Basic, {
      global: {
        stubs: {
          Button: true,
          Checkbox: true,
          Empty: true,
          Modal: true,
          Popconfirm: true,
          Tag: true,
        },
      },
    });
    await flushPromises();

    expect(mocks.adminUserMessageService.list).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
    expect(mocks.adminUserMessageService.list).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
    expect(mocks.adminUserMessageService.list).toHaveBeenCalledTimes(2);
    expect(mocks.adminUserMessageService.list).toHaveBeenCalledWith({
      unreadOnly: true,
      pageIndex: 1,
      pageSize: 7,
    });
  });

  it('计数取独立接口，预览只显示七条且已读只提交当前消息', async () => {
    mocks.accessToken = 'access-token';
    mocks.adminUserMessageService = {
      list: vi.fn().mockResolvedValue({
        items: Array.from({ length: 8 }, (_, index) => ({
          id: String(index + 1),
          title: `消息${index + 1}`,
          sourceType: index === 0 ? 'https://evil.example' : 'Notice',
          sourceId: `notice-${index + 1}`,
        })),
        totals: 52,
      }),
      unreadCount: vi.fn().mockResolvedValue(52),
      markRead: vi.fn().mockResolvedValue(undefined),
    };
    const wrapper = mount(Basic);
    await flushPromises();
    expect(
      wrapper.get('[data-testid="notification"]').attributes('data-count'),
    ).toBe('52');
    expect(wrapper.findAll('[data-testid^="message-"]')).toHaveLength(7);
    expect(
      wrapper.get('[data-testid="message-1"]').attributes('data-link'),
    ).toBeUndefined();
    expect(
      wrapper.get('[data-testid="message-2"]').attributes('data-link'),
    ).toBe('/clob/V1/MyMessages');
    expect(
      wrapper.get('[data-testid="message-2"]').attributes('data-query'),
    ).toBe(JSON.stringify({ noticeId: 'notice-2' }));
    await wrapper.get('[data-testid="message-1"]').trigger('click');
    await flushPromises();
    expect(mocks.adminUserMessageService.markRead).toHaveBeenCalledWith({
      ids: ['1'],
    });
    expect(mocks.push).not.toHaveBeenCalled();
    const previousCalls =
      mocks.adminUserMessageService.unreadCount.mock.calls.length;
    mocks.messageReadListener?.();
    await flushPromises();
    expect(mocks.adminUserMessageService.unreadCount).toHaveBeenCalledTimes(
      previousCalls + 1,
    );
    wrapper.unmount();
    expect(mocks.stopMessageReadListener).toHaveBeenCalledOnce();
  });

  it('工作流铃铛只使用可信动作目标，缺失目标不推断任务', async () => {
    mocks.accessToken = 'access-token';
    mocks.adminUserMessageService = {
      list: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'task-message',
            sourceType: 'Workflow',
            sourceId: 'instance-1',
            actionTarget: { kind: 'WorkflowTask', id: 'task+1' },
          },
          {
            id: 'instance-message',
            sourceType: 'Workflow',
            actionTarget: { kind: 'WorkflowInstance', id: 'instance-2' },
          },
          {
            id: 'missing-message',
            sourceType: 'Workflow',
            sourceId: 'not-a-task',
          },
          {
            id: 'bad-message',
            sourceType: 'Workflow',
            actionTarget: { kind: 'Url', id: 'https://evil.example' },
          },
        ],
        totals: 4,
      }),
      unreadCount: vi.fn().mockResolvedValue(4),
      markRead: vi.fn(),
    };
    const wrapper = mount(Basic);
    await flushPromises();
    expect(
      wrapper
        .get('[data-testid="message-task-message"]')
        .attributes('data-link'),
    ).toBe('/clob/V1/MyWorkflow');
    expect(
      wrapper
        .get('[data-testid="message-task-message"]')
        .attributes('data-query'),
    ).toBe(JSON.stringify({ taskId: 'task+1' }));
    expect(
      wrapper
        .get('[data-testid="message-instance-message"]')
        .attributes('data-query'),
    ).toBe(JSON.stringify({ instanceId: 'instance-2' }));
    expect(
      wrapper
        .get('[data-testid="message-missing-message"]')
        .attributes('data-link'),
    ).toBeUndefined();
    expect(
      wrapper
        .get('[data-testid="message-bad-message"]')
        .attributes('data-link'),
    ).toBeUndefined();
    wrapper.unmount();
  });

  it('全部已读按服务端未读第一页分批，不把七条预览当成全部', async () => {
    mocks.accessToken = 'access-token';
    const records = Array.from({ length: 102 }, (_, index) => ({
      id: String(index + 1),
      title: '个人消息',
    }));
    mocks.adminUserMessageService = {
      list: vi
        .fn()
        .mockResolvedValueOnce({ items: records.slice(0, 7), totals: 102 })
        .mockResolvedValueOnce({ items: records.slice(0, 100), totals: 102 })
        .mockResolvedValueOnce({ items: records.slice(100), totals: 2 })
        .mockResolvedValue({ items: [], totals: 0 }),
      unreadCount: vi.fn().mockResolvedValue(102),
      markRead: vi.fn().mockResolvedValue(undefined),
    };
    const wrapper = mount(Basic);
    await flushPromises();
    await wrapper.get('[data-testid="clear-messages"]').trigger('click');
    await flushPromises();
    expect(mocks.adminUserMessageService.markRead).toHaveBeenCalledTimes(2);
    expect(mocks.adminUserMessageService.markRead).toHaveBeenNthCalledWith(1, {
      ids: records.slice(0, 100).map((item) => item.id),
    });
    expect(mocks.adminUserMessageService.markRead).toHaveBeenNthCalledWith(2, {
      ids: ['101', '102'],
    });
    expect(mocks.adminUserMessageService.list).toHaveBeenNthCalledWith(3, {
      pageIndex: 1,
      pageSize: 100,
      unreadOnly: true,
    });
    wrapper.unmount();
  });

  it('仅为超级管理员向偏好设置注册上传入口，并从用户菜单移除入口', async () => {
    mocks.adminMenuSyncService = {};
    mocks.userInfo.superAdmin = true;

    const wrapper = mount(Basic, {
      global: {
        stubs: {
          Button: true,
          Checkbox: true,
          Empty: true,
          Modal: true,
          Popconfirm: true,
          Tag: true,
        },
      },
    });

    await flushPromises();

    expect(mocks.registerPreferencesUploadAction).toHaveBeenCalledOnce();
    expect(
      wrapper
        .find('[data-testid="system-menu-save-admin-ui-base-setting"]')
        .exists(),
    ).toBe(false);
    wrapper.unmount();
  });

  it('将界面偏好上传表单放大到默认宽度的 1.3 倍', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/app/layouts/basic.vue',
      'utf8',
    );

    expect(source).toContain(':width="676"');
  });

  it('only exposes frontend versions to a super administrator', async () => {
    mocks.userInfo.superAdmin = true;

    const wrapper = mount(Basic, {
      global: {
        stubs: {
          Button: true,
          Checkbox: true,
          Empty: true,
          Modal: true,
          Popconfirm: true,
          Tag: true,
        },
      },
    });

    await flushPromises();

    expect(
      wrapper.get('[data-testid="system-menu-frontend-build-versions"]').text(),
    ).toBe('前端组件版本');

    mocks.userInfo.superAdmin = false;
    wrapper.unmount();
  });

  it('打开版本弹窗后显示包名、版本与逐包打包时间', async () => {
    mocks.userInfo.superAdmin = true;
    const wrapper = mount(Basic, {
      global: {
        stubs: {
          Button: true,
          Checkbox: true,
          Empty: true,
          Popconfirm: true,
          Tag: { template: '<span><slot /></span>' },
          AModal: {
            props: ['open', 'title'],
            template:
              '<section v-if="open" :aria-label="title"><slot /></section>',
          },
        },
      },
    });
    await flushPromises();
    await wrapper
      .get('[data-testid="system-menu-frontend-build-versions"]')
      .trigger('click');
    const panel = wrapper.get('[aria-label="前端组件版本"]');
    expect(panel.text()).toContain('@levin/admin-framework');
    expect(panel.text()).toContain('@vben/runtime');
    expect(panel.text()).toContain('打包时间：');
    expect(panel.text()).not.toContain('Invalid Date');
    expect(panel.text()).not.toContain('版本不匹配');
    expect(panel.text()).not.toContain('开发模式');
    wrapper.unmount();
  });

  it('renders the layout logo text from tenant site brand state', async () => {
    const wrapper = mount(Basic, {
      global: {
        stubs: {
          Button: true,
          Checkbox: true,
          Empty: true,
          Modal: true,
          Popconfirm: true,
          Tag: true,
        },
      },
    });

    await flushPromises();

    expect(mocks.loadAuthBrand).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-testid="logo-text"]').text()).toBe(
      '租户站点后台',
    );
    expect(wrapper.get('[data-testid="footer"]').text()).toBe('租户站点版权');
    expect(wrapper.get('[data-testid="basic-layout"]').classes()).toContain(
      'admin-navigation-theme-minimal',
    );
  });

  it('仅在交互时为主题渐变用户入口显示圆角高亮', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/app/layouts/basic.vue',
      'utf8',
    );

    // 静止状态不覆盖用户入口，确保它与默认主题的透明状态一致。
    expect(source).not.toContain(':deep(header.light .header-user-dropdown) {');
  });

  it('使主题渐变顶栏控件使用选中态主题色强度', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/app/layouts/basic.vue',
      'utf8',
    );
    const headerControlSection = source.slice(
      source.indexOf(
        '/* 顶栏控件静止透明，交互时与当前选中项使用同强度主题色。 */',
      ),
      source.indexOf('/* 标签栏与侧栏菜单保持一致的悬停、选中渐变层级。 */'),
    );

    // 静止态透明，折叠、刷新和头像等控件继承同一选中态强度。
    expect(headerControlSection).toContain(
      '--header-control-background: transparent;',
    );
    expect(headerControlSection).toContain(
      '--header-control-background-hover: hsl(var(--primary) / 36%);',
    );
    expect(headerControlSection).not.toContain('hsl(var(--primary) / 10%)');
  });

  it('仅在交互时为主题渐变 CRUD 工具栏图标显示选中态主题色', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/app/layouts/basic.vue',
      'utf8',
    );
    const toolbarControlSection = source.slice(
      source.indexOf(
        '/* 工具栏图标静止时不叠加圆形表面，交互时与顶栏使用同强度主题色。 */',
      ),
      source.indexOf(
        '/* CRUD 操作栏只作轻量承接，不抢占新增和工具按钮的操作层级。 */',
      ),
    );

    // 统一工具栏类覆盖导入、导出、刷新、展示设置、全屏和列设置。
    expect(toolbarControlSection).toContain(
      ':deep(.vben-crud-table-tool-button) {',
    );
    expect(toolbarControlSection).toContain(
      'background: transparent !important;',
    );
    expect(toolbarControlSection).toContain(
      ':deep(.vben-crud-table-tool-button:hover)',
    );
    expect(toolbarControlSection).toContain(
      ':deep(.vben-crud-table-tool-button:focus-visible)',
    );
    expect(toolbarControlSection).toContain(
      'background: hsl(var(--primary) / 36%) !important;',
    );
  });

  it('navigates to the current user home path when the layout logo is clicked', async () => {
    const wrapper = mount(Basic, {
      global: {
        stubs: {
          Button: true,
          Checkbox: true,
          Empty: true,
          Modal: true,
          Popconfirm: true,
          Tag: true,
        },
      },
    });

    await wrapper.get('[data-testid="logo-text"]').trigger('click');

    expect(mocks.push).toHaveBeenCalledWith('/analytics');
  });

  it('uses the custom watermark color when creating a watermark', async () => {
    Object.assign(mocks.preferences.app, {
      watermark: true,
      watermarkColor: 'hsl(340 82% 52%)',
      watermarkColorCustom: true,
      watermarkTransparency: 60,
      watermarkContent: '内部资料',
    });
    mocks.updateWatermark.mockClear();

    const wrapper = mount(Basic, {
      global: {
        stubs: {
          Button: true,
          Checkbox: true,
          Empty: true,
          Modal: true,
          Popconfirm: true,
          Tag: true,
        },
      },
    });

    await flushPromises();

    expect(mocks.updateWatermark).toHaveBeenCalledWith({
      advancedStyle: {
        colorStops: [
          { color: 'hsl(340 82% 52%)', offset: 0 },
          { color: 'hsl(340 82% 52%)', offset: 1 },
        ],
        type: 'linear',
      },
      content: '内部资料',
      globalAlpha: 0.4,
    });

    wrapper.unmount();
    Object.assign(mocks.preferences.app, {
      watermark: false,
      watermarkColor: 'gray',
      watermarkColorCustom: false,
      watermarkTransparency: 85,
      watermarkContent: '',
    });
  });
});
