<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import type { FrameworkEventListenerInfo } from '../../event-bus';
import type { AdminUiPreferencesScope } from '../admin-ui-preferences-setting';

import {
  computed,
  defineAsyncComponent,
  h,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  useSlots,
  watch,
} from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { useWatermark } from '@vben/runtime/hooks';
import {
  BasicLayout,
  LockScreen,
  Notification,
  registerPreferencesUploadAction,
  UserDropdown,
} from '@vben/layouts';
import { preferences } from '@vben-core/foundation/preferences';
import { useAccessStore, useUserStore } from '@vben/runtime/stores';

import {
  getAdminMenuSyncService,
  getAdminNoticeService,
  getAdminRequestClient,
} from '@levin/admin-framework';
import { $t } from '@levin/admin-framework/framework-commons/app/locales';
import { resolveAdminPage } from '@levin/admin-framework/framework-commons/app/pages';
import { useAuthStore } from '@levin/admin-framework/framework-commons/app/store';
import { useAuthBrand } from '@levin/admin-framework/framework-commons/app/views/_core/authentication/auth-brand';
import {
  Button,
  Empty,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Tag,
} from 'ant-design-vue';

import {
  getFrameworkEventListeners,
  removeFrameworkEventListener,
  setFrameworkEventListenerEnabled,
} from '../../event-bus';
import { getAdminI18nLabelSyncService } from '../../runtime';
import { getAdministrativeAreaOptions } from '../../shared/administrative-area-data';
import { getUserDropdownMenuItems } from '../../shared/user-dropdown-menu-service';
import { getFrontendBuildInfo } from '../frontend-build-versions';
import {
  ADMIN_UI_PREFERENCES_SETTING_CODE,
  loadAdminUiPreferencesSetting,
  loadAdminUiPreferencesUploadTargets,
  loadAdminUiPreferencesScopeOptions,
  saveAdminUiPreferencesSetting,
} from '../admin-ui-preferences-setting';
import { getNavigationVisualThemeClass } from './navigation-visual-theme';
import SyncI18nLabelsModal from './sync-i18n-labels-modal.vue';
import SyncMenuRoutesModal from './sync-menu-routes-modal.vue';

type NoticeProcessStatus = 'Finished' | 'Processing' | 'Rejected';

interface NoticeRecord {
  category?: string;
  content?: string;
  createTime?: string;
  expiredTime?: string;
  id?: number | string;
  lastUpdateTime?: string;
  level?: string;
  name?: string;
  noticeId?: number | string;
  processLogId?: number | string;
  processRemark?: string;
  processStatus?: NoticeProcessStatus;
  processTime?: string;
  publishTime?: string;
  subtitle?: string;
  title?: string;
}

interface NoticeProcessLogRecord {
  createTime?: string;
  id?: number | string;
  noticeId?: number | string;
  remark?: string;
  status?: NoticeProcessStatus;
}

interface NoticeNotificationState extends Record<string, any> {
  logId?: string;
  logStatus?: NoticeProcessStatus;
  noticeId: string;
}

const notifications = ref<NotificationItem[]>([]);
const notificationUnreadItems = ref<NotificationItem[]>([]);
const noticeUnreadCount = ref(0);
const noticeProcessLogMap = ref(new Map<string, NoticeProcessLogRecord>());
const NOTIFICATION_PREVIEW_LIMIT = 7;
const NOTIFICATION_QUERY_LIMIT = 200;
const NOTIFICATION_SYNC_INTERVAL = 3 * 60 * 1000;
const noticeLevelLabelMap: Record<string, string> = {
  Important: '重要',
  Normal: '普通',
  Urgent: '紧急',
  VeryUrgent: '非常紧急',
  VeryVeryUrgent: '非常非常紧急',
};

const userStore = useUserStore();
const authStore = useAuthStore();
const slots = useSlots();
const headerTopSlots = computed(() => {
  return ['header-top-center', 'header-top-right'].filter((name) =>
    Boolean(slots[name]),
  );
});
const accessStore = useAccessStore();
const router = useRouter();
const { appName, copyright, loadAuthBrand, logo } = useAuthBrand();
const LoginForm = defineAsyncComponent(
  resolveAdminPage('/_core/authentication/login.vue'),
);
const ProfileCenter = defineAsyncComponent(
  resolveAdminPage('/_core/profile/index.vue'),
);
const profileModalOpen = ref(false);
const syncMenuRoutesModalOpen = ref(false);
const syncI18nLabelsModalOpen = ref(false);
const adminUiPreferencesUploadLoading = ref(false);
const adminUiPreferencesLoadLoading = ref(false);
const adminUiPreferencesUploadModalOpen = ref(false);
// 仅展示本次加载命中的记录，不将展示信息作为保存目标。
const loadedAdminUiSetting = ref<null | {
  id?: string;
  name?: string;
  lastUpdateTime?: string;
}>(null);
const syncNationalAdministrativeAreasModalOpen = ref(false);
const syncNationalAdministrativeAreasLoading = ref(false);
const eventListenerManagerOpen = ref(false);
const frontendVersionModalOpen = ref(false);
const eventListeners = ref<FrameworkEventListenerInfo[]>([]);
const adminUiPreferencesScope = reactive<AdminUiPreferencesScope>({});
const uploadTargetRecords = ref<
  Array<{ id?: string; name?: string; lastUpdateTime?: string }>
>([]);
const uploadTargetStatus = ref('');
// 范围变更时清除旧目标，并忽略已经过期的查询响应。
watch(
  [adminUiPreferencesUploadModalOpen, () => ({ ...adminUiPreferencesScope })],
  async ([open], _previous, onCleanup) => {
    let expired = false;
    onCleanup(() => {
      expired = true;
    });
    uploadTargetRecords.value = [];
    uploadTargetStatus.value = open ? '正在查询上传目标…' : '';
    if (!open) return;
    try {
      const records = await loadAdminUiPreferencesUploadTargets({
        ...adminUiPreferencesScope,
      });
      if (expired) return;
      uploadTargetRecords.value = records;
      uploadTargetStatus.value =
        records.length === 0
          ? '无精确匹配记录，上传将新建设置'
          : records.length > 1
            ? `匹配 ${records.length} 条，上传时选择更新目标或新建`
            : '';
    } catch {
      if (!expired) uploadTargetStatus.value = '目标查询失败，上传时将重新查询';
    }
  },
);
const adminUiPreferencesScopeOptions = reactive({
  orgCategories: [] as Array<{ label: string; value: string }>,
  orgTypes: [] as Array<{ label: string; value: string }>,
  sites: [] as Array<{ label: string; value: string }>,
  tenants: [] as Array<{ label: string; value: string }>,
  userCategories: [] as Array<{ label: string; value: string }>,
  userTypes: [] as Array<{ label: string; value: string }>,
});
const eventListenerManagerModalMaxWidth = 'min(80vw, 960px)';
const eventListenerManagerModalStyle = {
  maxWidth: eventListenerManagerModalMaxWidth,
};
const { destroyWatermark, updateWatermark } = useWatermark();
const showDot = computed(() => noticeUnreadCount.value > 0);
const extensionUserDropdownMenus = getUserDropdownMenuItems();

const canUploadPageRoutes = computed(() => {
  const userInfo = (userStore.userInfo || {}) as Record<string, any>;
  return userInfo.superAdmin === true && Boolean(getAdminMenuSyncService());
});
let unregisterPreferencesUploadAction: (() => void) | undefined;
let notificationSyncTimer: ReturnType<typeof setInterval> | undefined;

const canViewFrontendVersions = computed(() => {
  const userInfo = (userStore.userInfo || {}) as Record<string, any>;
  return userInfo.superAdmin === true;
});

const frontendBuildInfo = computed(() => getFrontendBuildInfo());

const canUploadI18nLabels = computed(() => {
  const userInfo = (userStore.userInfo || {}) as Record<string, any>;
  return (
    userInfo.superAdmin === true &&
    Boolean(getAdminI18nLabelSyncService()?.uploadModuleLabels)
  );
});

const fixedProfileUserDropdownMenu = computed(() => ({
  handler: () => {
    profileModalOpen.value = true;
  },
  icon: 'lucide:user',
  id: 'profile',
  text: $t('page.auth.profile'),
}));

const builtInUserDropdownExtensionMenus = computed(() =>
  [
    {
      handler: () => {
        return router.push('/clob/V1/MySetting');
      },
      icon: 'lucide:user-cog',
      id: 'my-setting',
      order: 100,
      text: '我的设置',
    },
    ...(canUploadPageRoutes.value
      ? [
          {
            handler: () => {
              syncMenuRoutesModalOpen.value = true;
            },
            icon: 'lucide:cloud-upload',
            id: 'sync-menu-routes',
            order: 200,
            text: '上传页面路由',
          },
          {
            handler: () => {
              syncNationalAdministrativeAreasModalOpen.value = true;
            },
            icon: 'lucide:map-pin',
            id: 'sync-national-administrative-areas',
            order: 350,
            text: '上传默认国家行政编码',
          },
          {
            handler: () => {
              openEventListenerManager();
            },
            icon: 'lucide:list-tree',
            id: 'event-listener-manager',
            order: 400,
            text: '监听器管理',
          },
        ]
      : []),
    ...(canUploadI18nLabels.value
      ? [
          {
            handler: () => {
              syncI18nLabelsModalOpen.value = true;
            },
            icon: 'lucide:languages',
            id: 'sync-i18n-labels',
            order: 250,
            text: '上传国际化资源',
          },
        ]
      : []),
    ...(canViewFrontendVersions.value
      ? [
          {
            handler: () => {
              frontendVersionModalOpen.value = true;
            },
            icon: 'lucide:component',
            id: 'frontend-build-versions',
            order: 450,
            text: '前端组件版本',
          },
        ]
      : []),
  ].toSorted((left, right) => left.order - right.order),
);

const systemMenus = computed(() => builtInUserDropdownExtensionMenus.value);

const menus = computed(() => {
  return extensionUserDropdownMenus.value
    .map((item) => ({
      ...item,
      order: item.order ?? 1000,
    }))
    .toSorted((left, right) => left.order - right.order);
});

const avatar = computed(() => {
  return userStore.userInfo?.avatar || preferences.app.defaultAvatar;
});

const userDropdownDescription = computed(() => {
  const userInfo = (userStore.userInfo || {}) as Record<string, any>;
  return (
    userInfo.telephone ||
    userInfo.mobile ||
    userInfo.phone ||
    userInfo.email ||
    userInfo.loginName ||
    userInfo.username ||
    ''
  );
});
const navigationThemeClass = computed(() => {
  const themeClass = getNavigationVisualThemeClass(
    preferences.navigation.visualStyle,
  );
  const navigation = preferences.navigation;
  const classes = [themeClass];

  if (navigation.visualStyle !== 'brand-gradient') {
    return classes;
  }
  if (navigation.gradientSidebarEnabled !== false) {
    classes.push('admin-navigation-theme-gradient-sidebar');
  }
  if (navigation.gradientHeaderEnabled !== false) {
    classes.push('admin-navigation-theme-gradient-header');
  }
  if (navigation.gradientTabbarEnabled) {
    classes.push('admin-navigation-theme-gradient-tabbar');
  }
  if (navigation.gradientCrudHeaderEnabled !== false) {
    classes.push('admin-navigation-theme-gradient-crud-header');
  }
  if (navigation.gradientCrudToolbarEnabled) {
    classes.push('admin-navigation-theme-gradient-crud-toolbar');
  }
  if (navigation.gradientCrudTableEnabled) {
    classes.push('admin-navigation-theme-gradient-crud-table');
  }
  if (navigation.gradientCrudRowsEnabled) {
    classes.push('admin-navigation-theme-gradient-crud-rows');
  }
  if (navigation.gradientCrudQueryEnabled) {
    classes.push('admin-navigation-theme-gradient-crud-query');
  }
  if (navigation.gradientCrudCreateFormEnabled) {
    classes.push('admin-navigation-theme-gradient-crud-create-form');
  }
  if (navigation.gradientCrudEditFormEnabled) {
    classes.push('admin-navigation-theme-gradient-crud-edit-form');
  }
  if (navigation.gradientCrudDetailFormEnabled) {
    classes.push('admin-navigation-theme-gradient-crud-detail-form');
  }

  return classes;
});
const navigationGradientStyle = computed(() => {
  const navigation = preferences.navigation;
  const endColor = navigation.gradientEndColor || '#fff4f5';

  return {
    '--navigation-gradient-end-color': endColor,
    '--navigation-gradient-transition-color':
      navigation.gradientTransitionColorEnabled
        ? navigation.gradientTransitionColor || endColor
        : endColor,
  };
});

async function handleLogout() {
  await authStore.logout(false);
}

function clonePreferences() {
  return JSON.parse(JSON.stringify(preferences)) as Record<string, any>;
}

function openAdminUiPreferencesUpload() {
  loadedAdminUiSetting.value = null;
  // 每次打开都从独立 UI 设置的通用范围开始选择。
  Object.assign(adminUiPreferencesScope, {});
  void loadAdminUiPreferencesScopeOptions().then((options) =>
    Object.assign(adminUiPreferencesScopeOptions, options),
  );
  adminUiPreferencesUploadModalOpen.value = true;
}

function handleAdminUiPreferencesTenantChange() {
  // 域名候选依赖租户；切换租户后不能保留旧域名。
  adminUiPreferencesScope.domain = undefined;
  adminUiPreferencesScopeOptions.sites = [];
  void loadAdminUiPreferencesScopeOptions(
    adminUiPreferencesScope.tenantId,
  ).then((options) => Object.assign(adminUiPreferencesScopeOptions, options));
}

function selectAdminUiPreferencesCandidate(
  candidates: any[],
  candidateCount: number,
) {
  return new Promise<any | undefined>((resolve) => {
    let selectedId: string | undefined;
    Modal.confirm({
      cancelText: '新建记录',
      content: h('div', { class: 'grid gap-3' }, [
        h(
          'div',
          `找到 ${candidateCount} 条完全匹配的配置，请选择一条更新；不选择将新建记录。`,
        ),
        h(
          'select',
          {
            class: 'border-border rounded border px-3 py-2',
            onChange: (event: Event) => {
              selectedId =
                (event.target as HTMLSelectElement).value || undefined;
            },
          },
          [
            h('option', { value: '' }, '不选择，改为新建记录'),
            ...candidates.map((item) =>
              h(
                'option',
                { value: item.id },
                `${item.code || '界面偏好设置'} · ${item.id || ''}`,
              ),
            ),
          ],
        ),
      ]),
      okText: '更新所选记录',
      onCancel: () => resolve(undefined),
      onOk: () => resolve(candidates.find((item) => item.id === selectedId)),
      title: '选择界面偏好设置',
    });
  });
}

watch(
  canUploadPageRoutes,
  (canUpload) => {
    unregisterPreferencesUploadAction?.();
    unregisterPreferencesUploadAction = canUpload
      ? registerPreferencesUploadAction(openAdminUiPreferencesUpload)
      : undefined;
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  // 组件卸载时释放全局扩展与通知轮询，避免离开布局后继续发起请求。
  unregisterPreferencesUploadAction?.();
  stopNotificationSync();
});

async function handleSaveAdminUiPreferences() {
  if (adminUiPreferencesUploadLoading.value) {
    return;
  }

  adminUiPreferencesUploadLoading.value = true;

  try {
    await saveAdminUiPreferencesSetting(
      clonePreferences(),
      adminUiPreferencesScope,
      selectAdminUiPreferencesCandidate,
    );
    message.success('界面设置上传成功');
    adminUiPreferencesUploadModalOpen.value = false;
  } catch {
    message.error('界面设置上传失败');
  } finally {
    adminUiPreferencesUploadLoading.value = false;
  }
}

async function handleLoadAdminUiPreferences() {
  if (adminUiPreferencesLoadLoading.value) {
    return;
  }

  adminUiPreferencesLoadLoading.value = true;
  loadedAdminUiSetting.value = null;
  try {
    const resolution = await loadAdminUiPreferencesSetting();
    // 加载设置仅使用服务端返回的匹配范围，空字段不得沿用打开弹窗前的页面上下文。
    Object.keys(adminUiPreferencesScope).forEach((key) => {
      delete adminUiPreferencesScope[key as keyof AdminUiPreferencesScope];
    });
    Object.assign(adminUiPreferencesScope, resolution.scope);
    const options = await loadAdminUiPreferencesScopeOptions(
      resolution.scope.tenantId,
    );
    Object.assign(adminUiPreferencesScopeOptions, options);
    if (resolution.setting) {
      loadedAdminUiSetting.value = resolution.setting;
      message.success('界面设置已加载');
    } else {
      message.warning('无适配设置');
    }
  } catch {
    message.error('加载界面设置失败');
  } finally {
    adminUiPreferencesLoadLoading.value = false;
  }
}

async function syncNationalAdministrativeAreas() {
  if (syncNationalAdministrativeAreasLoading.value) {
    return;
  }
  syncNationalAdministrativeAreasLoading.value = true;
  try {
    const result = await getAdminRequestClient().post<any>(
      '/Area/syncNationalAdministrativeAreas',
      { areas: getAdministrativeAreaOptions() },
    );
    message.success(
      `国家行政编码全量上传完成：新增 ${result?.createdCount || 0} 条，跳过 ${result?.skippedCount || 0} 条`,
    );
    syncNationalAdministrativeAreasModalOpen.value = false;
  } catch {
    message.error('国家行政编码上传失败');
  } finally {
    syncNationalAdministrativeAreasLoading.value = false;
  }
}

function resetAdminUiPreferencesUploadLoading() {
  adminUiPreferencesUploadLoading.value = false;
  adminUiPreferencesLoadLoading.value = false;
}

function refreshEventListeners() {
  eventListeners.value = getFrameworkEventListeners();
}

function openEventListenerManager() {
  refreshEventListeners();
  eventListenerManagerOpen.value = true;
}

function handleRemoveEventListener(id: string) {
  if (removeFrameworkEventListener(id)) {
    message.success('监听器已移除');
  } else {
    message.warning('监听器不存在或已被移除');
  }
  refreshEventListeners();
}

function handleSetEventListenerEnabled(id: string, enabled: boolean) {
  if (setFrameworkEventListenerEnabled(id, enabled)) {
    message.success(enabled ? '监听器已启用' : '监听器已禁用');
  } else {
    message.warning('监听器不存在或已被移除');
  }
  refreshEventListeners();
}

function normalizeListItems<T>(data: any): T[] {
  if (Array.isArray(data)) {
    return data;
  }

  return data?.items || data?.records || data?.list || [];
}

function getNoticeState(item: NotificationItem) {
  return item.state as NoticeNotificationState | undefined;
}

function stripContent(content?: string) {
  return String(content || '')
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function formatNoticeDate(value?: string) {
  if (!value) {
    return '';
  }

  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) {
    return value;
  }

  const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diffSeconds < 60) {
    return '刚刚';
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}小时前`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}天前`;
  }

  return value.slice(0, 10);
}

function getNoticeTitle(notice: NoticeRecord) {
  return String(notice.title || notice.name || '通知').trim();
}

function getNoticeMessage(notice: NoticeRecord) {
  const message = String(
    notice.subtitle || stripContent(notice.content) || notice.category || '',
  ).trim();

  return message || '请查看通知详情';
}

function getNoticeLevelLabel(notice: NoticeRecord) {
  const level = String(notice.level || '').trim();
  return noticeLevelLabelMap[level] || level;
}

function getNoticeAvatar(notice: NoticeRecord) {
  const title = getNoticeTitle(notice);
  const text = encodeURIComponent(title.slice(0, 2) || '通知');
  const seed = encodeURIComponent(String(notice.id || title));
  return `https://avatar.vercel.sh/${seed}.svg?text=${text}`;
}

function isNoticeExpired(notice: NoticeRecord) {
  if (!notice.expiredTime) {
    return false;
  }

  const expiredAt = new Date(notice.expiredTime).getTime();
  return Number.isFinite(expiredAt) && expiredAt < Date.now();
}

function toNotificationItem(
  notice: NoticeRecord,
  log?: NoticeProcessLogRecord,
): NotificationItem | undefined {
  const noticeId = String(notice.id || '').trim();
  const processStatus = log?.status || notice.processStatus;
  if (!noticeId || isNoticeExpired(notice) || processStatus === 'Rejected') {
    return undefined;
  }

  return {
    id: noticeId,
    avatar: getNoticeAvatar(notice),
    date: formatNoticeDate(
      notice.publishTime || notice.createTime || notice.lastUpdateTime,
    ),
    isRead: processStatus === 'Finished',
    level: getNoticeLevelLabel(notice),
    link: '/clob/V1/MyMessages',
    message: getNoticeMessage(notice),
    state: {
      logId: log?.id ? String(log.id) : undefined,
      logStatus: processStatus,
      noticeId,
    },
    title: getNoticeTitle(notice),
  };
}

function buildNoticeProcessLogMap(logs: NoticeProcessLogRecord[]) {
  const logMap = new Map<string, NoticeProcessLogRecord>();

  logs.forEach((log) => {
    const noticeId = String(log.noticeId || '').trim();
    if (!noticeId) {
      return;
    }

    const current = logMap.get(noticeId);
    if (
      !current ||
      String(log.createTime || '') > String(current.createTime || '')
    ) {
      logMap.set(noticeId, log);
    }
  });

  return logMap;
}

async function loadNotifications() {
  const noticeService = getAdminNoticeService();
  if (!accessStore.accessToken || !noticeService) {
    notifications.value = [];
    notificationUnreadItems.value = [];
    noticeUnreadCount.value = 0;
    noticeProcessLogMap.value = new Map();
    return;
  }

  const noticeData = await noticeService.myMessages({
    pageIndex: 1,
    pageSize: NOTIFICATION_QUERY_LIMIT,
  });

  const notices = normalizeListItems<NoticeRecord>(noticeData);
  const logs = notices.map((notice) => ({
    createTime: notice.processTime,
    id: notice.processLogId,
    noticeId: notice.noticeId || notice.id,
    remark: notice.processRemark,
    status: notice.processStatus,
  }));

  const logMap = buildNoticeProcessLogMap(logs);
  noticeProcessLogMap.value = logMap;

  const visibleItems = notices
    .map((notice) =>
      toNotificationItem(notice, logMap.get(String(notice.id || ''))),
    )
    .filter(Boolean);
  const unreadItems = visibleItems.filter((item) => !item.isRead);

  notificationUnreadItems.value = unreadItems;
  noticeUnreadCount.value = unreadItems.length;
  notifications.value = unreadItems.slice(0, NOTIFICATION_PREVIEW_LIMIT);
}

function syncNotifications() {
  // 统一处理异步同步失败，确保定时器回调不会产生未处理的 Promise 拒绝。
  void loadNotifications().catch((error) => {
    console.warn('加载通知失败', error);
  });
}

function stopNotificationSync() {
  // 同一基础布局只保留一个通知同步计时器。
  if (notificationSyncTimer) {
    clearInterval(notificationSyncTimer);
    notificationSyncTimer = undefined;
  }
}

function startNotificationSync() {
  // 仅在当前存在登录令牌时轮询，并在重新启动前清理旧计时器。
  stopNotificationSync();
  if (!accessStore.accessToken) {
    return;
  }

  notificationSyncTimer = setInterval(
    syncNotifications,
    NOTIFICATION_SYNC_INTERVAL,
  );
}

async function saveNoticeProcessLog(
  item: NotificationItem,
  status: NoticeProcessStatus,
  remark: string,
) {
  const noticeService = getAdminNoticeService();
  const state = getNoticeState(item);
  const noticeId = state?.noticeId;
  if (!noticeId || !noticeService) {
    return;
  }

  const result = (await noticeService.processMyMessage({
    noticeId,
    remark,
    status,
  })) as NoticeRecord | undefined;

  noticeProcessLogMap.value.set(noticeId, {
    id: result?.processLogId || state?.logId,
    noticeId,
    remark,
    status,
  });

  if (status === 'Finished' || status === 'Rejected') {
    noticeUnreadCount.value = Math.max(0, noticeUnreadCount.value - 1);
  }
}

function removeNotificationItems(ids: Set<string>) {
  notificationUnreadItems.value = notificationUnreadItems.value.filter(
    (item) => !ids.has(String(item.id || '')),
  );
  notifications.value = notificationUnreadItems.value.slice(
    0,
    NOTIFICATION_PREVIEW_LIMIT,
  );
  noticeUnreadCount.value = notificationUnreadItems.value.length;
}

async function markNotificationItemsRead(
  items: NotificationItem[],
  remark: string,
) {
  const unreadItems = items.filter((item) => !item.isRead);
  if (unreadItems.length === 0) {
    return;
  }

  for (const item of unreadItems) {
    await saveNoticeProcessLog(item, 'Finished', remark);
  }
  removeNotificationItems(
    new Set(unreadItems.map((item) => String(item.id || ''))),
  );
}

async function handleNoticeClear() {
  await markNotificationItemsRead(
    [...notificationUnreadItems.value],
    '用户清空通知并标记已读',
  );
}

async function markRead(id: number | string) {
  const item = notificationUnreadItems.value.find((item) => item.id === id);
  if (!item || item.isRead) {
    return;
  }

  await markNotificationItemsRead([item], '用户已读通知');
}

async function remove(id: number | string) {
  const item = notificationUnreadItems.value.find((item) => item.id === id);
  if (!item) {
    return;
  }

  await saveNoticeProcessLog(item, 'Rejected', '用户清除通知');
  removeNotificationItems(new Set([String(item.id || '')]));
}

async function handleMakeAll() {
  await markNotificationItemsRead(
    [...notificationUnreadItems.value],
    '用户全部已读通知',
  );
}

function handleViewAllNotifications() {
  router.push('/clob/V1/MyMessages');
}

function handleClickLogo() {
  return router.push(
    userStore.userInfo?.homePath || preferences.app.defaultHomePath,
  );
}

onMounted(() => {
  loadAuthBrand().catch((error) => {
    console.warn('加载租户站点品牌信息失败', error);
  });
  // 布局挂载后立即加载一次，并为已登录会话启动后续的三分钟同步。
  syncNotifications();
  startNotificationSync();
});

watch(
  logo,
  (siteLogo) => {
    if (siteLogo) {
      preferences.logo.source = siteLogo;
    }
  },
  { immediate: true },
);

watch(
  () => [accessStore.accessToken, userStore.userInfo?.id],
  () => {
    // 登录身份变化时立即同步，并按最新登录态更新定时器。
    syncNotifications();
    startNotificationSync();
  },
);

watch(
  () => ({
    enable: preferences.app.watermark,
    color: preferences.app.watermarkColorCustom
      ? preferences.app.watermarkColor || 'gray'
      : 'gray',
    content: preferences.app.watermarkContent,
    transparency: preferences.app.watermarkTransparency ?? 85,
  }),
  async ({ color, enable, content, transparency }) => {
    if (enable) {
      await updateWatermark({
        advancedStyle: {
          colorStops: [
            { color, offset: 0 },
            { color, offset: 1 },
          ],
          type: 'linear',
        },
        content:
          content ||
          `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
        globalAlpha: Math.min(1, Math.max(0, 1 - Number(transparency) / 100)),
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <BasicLayout
    :class="navigationThemeClass"
    :style="navigationGradientStyle"
    @click-logo="handleClickLogo"
  >
    <template #logo-text>
      {{ appName }}
    </template>
    <template v-if="copyright" #footer>
      <div class="text-muted-foreground text-center text-xs">
        {{ copyright }}
      </div>
    </template>
    <template #user-dropdown>
      <Modal
        v-model:open="profileModalOpen"
        :footer="null"
        :mask-closable="false"
        :title="$t('page.auth.profile')"
        :width="960"
        destroy-on-close
      >
        <ProfileCenter class="max-h-[72vh] overflow-y-auto" />
      </Modal>
      <SyncMenuRoutesModal v-model:open="syncMenuRoutesModalOpen" />
      <SyncI18nLabelsModal v-model:open="syncI18nLabelsModalOpen" />
      <Modal
        v-model:open="frontendVersionModalOpen"
        :footer="null"
        :mask-closable="false"
        title="前端组件版本"
      >
        <div class="text-muted-foreground mb-3 text-sm">
          当前页面引用的框架、基础业务包及框架直接公共依赖版本。
        </div>
        <div class="border-border max-h-[56vh] overflow-y-auto rounded border">
          <div
            v-for="item in frontendBuildInfo.versions"
            :key="`${item.id}:${item.version}`"
            class="border-border flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="truncate font-medium">{{ item.name }}</span>
                <Tag class="shrink-0">{{ item.category }}</Tag>
              </div>
              <div class="text-muted-foreground mt-1 text-xs">
                打包时间：{{
                  new Date(item.buildTime).toLocaleString('zh-CN', {
                    hour12: false,
                  })
                }}
              </div>
            </div>
            <Tag class="shrink-0">{{ item.version }}</Tag>
          </div>
        </div>
      </Modal>
      <Modal
        v-model:open="adminUiPreferencesUploadModalOpen"
        :confirm-loading="adminUiPreferencesUploadLoading"
        :mask-closable="false"
        :width="676"
        title="上传界面设置"
        @after-close="resetAdminUiPreferencesUploadLoading"
        @cancel="resetAdminUiPreferencesUploadLoading"
        @ok="handleSaveAdminUiPreferences"
      >
        <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <!-- 已加载记录只读展示，便于管理员确认适配结果。 -->
          <section class="bg-muted min-w-0 rounded p-3 text-sm">
            <div class="mb-2 font-medium">匹配用户的设置</div>
            <dl
              v-if="loadedAdminUiSetting"
              class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 whitespace-nowrap"
              data-testid="loaded-admin-ui-setting"
            >
              <dt class="text-muted-foreground">设置 ID</dt>
              <dd class="truncate" :title="loadedAdminUiSetting.id">
                {{ loadedAdminUiSetting.id || '—' }}
              </dd>
              <dt class="text-muted-foreground">设置名称</dt>
              <dd class="truncate" :title="loadedAdminUiSetting.name">
                {{ loadedAdminUiSetting.name || '—' }}
              </dd>
              <dt class="text-muted-foreground">最后更新时间</dt>
              <dd class="truncate" :title="loadedAdminUiSetting.lastUpdateTime">
                {{ loadedAdminUiSetting.lastUpdateTime || '—' }}
              </dd>
            </dl>
            <div v-else class="text-muted-foreground">尚未加载适配设置</div>
          </section>
          <section
            class="bg-muted min-w-0 rounded p-3 text-sm"
            data-testid="admin-ui-upload-target"
          >
            <div class="mb-2 font-medium">上传更新的设置</div>
            <div v-if="uploadTargetStatus" class="text-muted-foreground">
              {{ uploadTargetStatus }}
            </div>
            <dl
              v-if="uploadTargetRecords.length === 1"
              class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 whitespace-nowrap"
            >
              <dt>设置 ID</dt>
              <dd class="truncate" :title="uploadTargetRecords[0]?.id">
                {{ uploadTargetRecords[0]?.id || '—' }}
              </dd>
              <dt>设置名称</dt>
              <dd class="truncate" :title="uploadTargetRecords[0]?.name">
                {{ uploadTargetRecords[0]?.name || '—' }}
              </dd>
              <dt>最后更新时间</dt>
              <dd
                class="truncate"
                :title="uploadTargetRecords[0]?.lastUpdateTime"
              >
                {{ uploadTargetRecords[0]?.lastUpdateTime || '—' }}
              </dd>
            </dl>
          </section>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <!-- 独立界面偏好记录的编码固定，适用范围为空时匹配任意上下文。 -->
          <Input
            :value="ADMIN_UI_PREFERENCES_SETTING_CODE"
            addon-before="设置项编码"
            disabled
          />
          <Select
            v-model:value="adminUiPreferencesScope.tenantId"
            :options="adminUiPreferencesScopeOptions.tenants"
            allow-clear
            placeholder="适用租户（留空匹配任意）"
            show-search
            @change="handleAdminUiPreferencesTenantChange"
          />
          <Select
            v-model:value="adminUiPreferencesScope.domain"
            :options="adminUiPreferencesScopeOptions.sites"
            :disabled="!adminUiPreferencesScope.tenantId"
            allow-clear
            placeholder="适用站点（留空匹配任意；请先选择租户）"
            show-search
          />
          <Select
            v-model:value="adminUiPreferencesScope.userType"
            :options="adminUiPreferencesScopeOptions.userTypes"
            allow-clear
            placeholder="适用用户类型（留空匹配任意）"
            show-search
          />
          <Select
            v-model:value="adminUiPreferencesScope.userCategory"
            :options="adminUiPreferencesScopeOptions.userCategories"
            allow-clear
            placeholder="适用用户类别（留空匹配任意）"
            show-search
          />
          <Select
            v-model:value="adminUiPreferencesScope.orgCategory"
            :options="adminUiPreferencesScopeOptions.orgCategories"
            allow-clear
            placeholder="适用组织类别（留空匹配任意）"
            show-search
          />
          <Select
            v-model:value="adminUiPreferencesScope.orgType"
            :options="adminUiPreferencesScopeOptions.orgTypes"
            allow-clear
            placeholder="适用组织类型（留空匹配任意）"
            show-search
          />
        </div>
        <template #footer>
          <Button
            :disabled="adminUiPreferencesUploadLoading"
            :loading="adminUiPreferencesLoadLoading"
            @click="handleLoadAdminUiPreferences"
          >
            加载设置
          </Button>
          <Button @click="adminUiPreferencesUploadModalOpen = false"
            >取消</Button
          >
          <Button
            :loading="adminUiPreferencesUploadLoading"
            type="primary"
            @click="handleSaveAdminUiPreferences"
          >
            上传设置
          </Button>
        </template>
      </Modal>
      <Modal
        v-model:open="syncNationalAdministrativeAreasModalOpen"
        :confirm-loading="syncNationalAdministrativeAreasLoading"
        :mask-closable="false"
        title="上传默认国家行政编码"
        @ok="syncNationalAdministrativeAreas"
      >
        <p class="text-muted-foreground m-0 text-sm leading-6">
          将当前有效的全部国家行政编码一次性上传到后端区域镜像。已有编码会跳过，不会修改或删除现有区域数据。
        </p>
      </Modal>
      <Modal
        v-model:open="eventListenerManagerOpen"
        :footer="null"
        :mask-closable="false"
        :style="eventListenerManagerModalStyle"
        :width="eventListenerManagerModalMaxWidth"
        title="监听器管理"
      >
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="text-muted-foreground text-sm">
            当前全局事件总线监听器
          </div>
          <Button size="small" @click="refreshEventListeners">刷新</Button>
        </div>
        <Empty v-if="eventListeners.length === 0" description="暂无监听器" />
        <div
          v-else
          class="border-border max-h-[56vh] w-full max-w-full overflow-y-auto rounded border"
        >
          <div
            class="border-border bg-muted/40 text-muted-foreground grid grid-cols-[minmax(0,1.2fr)_120px_minmax(0,1fr)_72px_116px] gap-3 border-b px-4 py-2 text-xs font-medium"
          >
            <div>描述</div>
            <div>事件类型</div>
            <div>主题匹配</div>
            <div>状态</div>
            <div class="text-right">操作</div>
          </div>
          <div
            v-for="listener in eventListeners"
            :key="listener.id"
            class="border-border grid grid-cols-[minmax(0,1.2fr)_120px_minmax(0,1fr)_72px_116px] items-center gap-3 border-b px-4 py-3 last:border-b-0"
          >
            <div class="min-w-0 flex-1">
              <div class="text-muted-foreground truncate text-xs">
                {{ listener.remark || '未填写备注' }}
              </div>
              <div class="text-muted-foreground mt-1 truncate text-xs">
                {{ listener.id }}
              </div>
            </div>
            <div class="min-w-0">
              <Tag class="max-w-full truncate">{{ listener.type }}</Tag>
            </div>
            <div class="truncate font-medium">
              {{ listener.topicPattern }}
            </div>
            <div>
              <Tag :color="listener.enabled ? 'success' : 'default'">
                {{ listener.enabled ? '启用' : '禁用' }}
              </Tag>
            </div>
            <div class="flex justify-end gap-2">
              <Button
                size="small"
                @click="
                  handleSetEventListenerEnabled(listener.id, !listener.enabled)
                "
              >
                {{ listener.enabled ? '禁用' : '启用' }}
              </Button>
              <Popconfirm
                cancel-text="取消"
                ok-text="移除"
                title="确定移除这个监听器？"
                @confirm="handleRemoveEventListener(listener.id)"
              >
                <Button danger size="small">移除</Button>
              </Popconfirm>
            </div>
          </div>
        </div>
      </Modal>

      <UserDropdown
        :avatar
        :menus
        :profile-menu="fixedProfileUserDropdownMenu"
        :system-menus="systemMenus"
        :text="userStore.userInfo?.realName"
        :description="userDropdownDescription"
        tag-text="Pro"
        @logout="handleLogout"
      />
    </template>
    <template #notification>
      <Notification
        :dot="showDot"
        :count="noticeUnreadCount"
        :notifications="notifications"
        @clear="handleNoticeClear"
        @read="(item) => item.id && markRead(item.id)"
        @remove="(item) => item.id && remove(item.id)"
        @make-all="handleMakeAll"
        @view-all="handleViewAllNotifications"
      />
    </template>
    <template v-for="item in headerTopSlots" #[item]>
      <slot :name="item"></slot>
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
      >
        <LoginForm />
      </AuthenticationLoginExpiredModal>
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
</template>

<style scoped>
/* 浅色侧栏以低饱和品牌渐变建立视觉锚点，不改变深色主题。 */
.admin-navigation-theme-gradient-sidebar :deep(aside.layout-sidebar.light),
.admin-navigation-theme-gradient-sidebar :deep(.layout-sidebar-extra.light) {
  background: linear-gradient(
      165deg,
      hsl(var(--primary) / 18%) 0%,
      var(--navigation-gradient-transition-color) 52%,
      var(--navigation-gradient-end-color) 100%
    )
    fixed !important;
  border: 0 !important;
  outline: 0;
  box-shadow: none;
}

/* 品牌区使用柔和渐变承接应用 Logo 与菜单主体。 */
.admin-navigation-theme-brand-gradient
  :deep(aside.light div.layout-sidebar-brand.light) {
  position: relative;
  margin: 10px 10px 6px;
  overflow: hidden;
  background: linear-gradient(
    125deg,
    hsl(var(--primary) / 16%) 0%,
    hsl(var(--primary) / 8%) 100%
  );
  border: 0;
  border-radius: 9999px;
  box-shadow: none;
}

.admin-navigation-theme-brand-gradient
  :deep(aside.light div.layout-sidebar-brand.light > a.layout-sidebar-brand) {
  position: relative;
  z-index: 1;
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  padding-right: 14px;
  padding-left: 14px;
}

/* 主题 class 切换时也保持品牌区无边框，避免过渡中短暂闪现矩形轮廓。 */
.admin-navigation-theme-brand-gradient
  :deep(aside.light div.layout-sidebar-brand.light),
.admin-navigation-theme-brand-gradient
  :deep(aside.light div.layout-sidebar-brand.light > a.layout-sidebar-brand),
.admin-navigation-theme-minimal
  :deep(aside.light div.layout-sidebar-brand.light),
.admin-navigation-theme-minimal
  :deep(aside.light div.layout-sidebar-brand.light > a.layout-sidebar-brand) {
  border-color: transparent !important;
}

/* 主题渐变下，顶栏与标签栏复用侧栏同一条三段渐变。 */
.admin-navigation-theme-gradient-header :deep(header.light.bg-header),
.admin-navigation-theme-gradient-tabbar :deep(.layout-tabbar) {
  background: linear-gradient(
    165deg,
    hsl(var(--primary) / 18%) 0%,
    var(--navigation-gradient-transition-color) 52%,
    var(--navigation-gradient-end-color) 100%
  ) !important;
  border-color: transparent !important;
  box-shadow: none;
}

/* 菜单组件保持透明，由连续的侧栏或顶栏容器承接渐变。 */
.admin-navigation-theme-gradient-header :deep(.vben-menu),
.admin-navigation-theme-gradient-header :deep(.vben-normal-menu),
.admin-navigation-theme-gradient-sidebar :deep(.vben-menu),
.admin-navigation-theme-gradient-sidebar :deep(.vben-normal-menu) {
  --menu-background-color: transparent !important;
  --sidebar-menu-background-color: transparent !important;
  --sidebar-menu-hover-background-color: transparent !important;
  background: transparent !important;
}

.admin-navigation-theme-gradient-header
  :deep(.vben-menu .vben-menu-item.is-active),
.admin-navigation-theme-gradient-header
  :deep(.vben-normal-menu__item.is-active),
.admin-navigation-theme-gradient-sidebar
  :deep(.vben-menu .vben-menu-item.is-active),
.admin-navigation-theme-gradient-sidebar
  :deep(.vben-normal-menu__item.is-active) {
  background: hsl(var(--primary) / 14%) !important;
  color: hsl(var(--primary));
}

.admin-navigation-theme-gradient-sidebar
  :deep(.layout-sidebar-extra .layout-sidebar-scrollbar) {
  background: transparent !important;
}

/* 顶栏控件静止透明，交互时与当前选中项使用同强度主题色。 */
.admin-navigation-theme-brand-gradient :deep(header.light) {
  --header-control-background: transparent;
  --header-control-background-hover: hsl(var(--primary) / 36%);
}

/* 标签栏与侧栏菜单保持一致的悬停、选中渐变层级。 */
.admin-navigation-theme-brand-gradient
  :deep(
    .layout-tabbar
      .tabs-chrome__item:not(.is-active):hover
      .tabs-chrome__background-content
  ) {
  background: linear-gradient(
    125deg,
    hsl(var(--primary) / 14%) 0%,
    hsl(var(--primary) / 7%) 100%
  ) !important;
}

.admin-navigation-theme-brand-gradient
  :deep(
    .layout-tabbar
      .tabs-chrome__item:not(.is-active):hover
      .tabs-chrome__background-before,
    .layout-tabbar
      .tabs-chrome__item:not(.is-active):hover
      .tabs-chrome__background-after
  ) {
  fill: hsl(var(--primary) / 14%) !important;
}

.admin-navigation-theme-brand-gradient
  :deep(
    .layout-tabbar .tabs-chrome__item.is-active .tabs-chrome__background-content
  ) {
  background: linear-gradient(
    125deg,
    hsl(var(--primary) / 36%) 0%,
    hsl(var(--primary) / 20%) 100%
  ) !important;
  box-shadow: 0 7px 16px hsl(var(--primary) / 18%);
}

.admin-navigation-theme-brand-gradient
  :deep(
    .layout-tabbar .tabs-chrome__item.is-active .tabs-chrome__background-before,
    .layout-tabbar .tabs-chrome__item.is-active .tabs-chrome__background-after
  ) {
  fill: hsl(var(--primary) / 36%) !important;
}

.admin-navigation-theme-brand-gradient
  :deep(.layout-tabbar .tabs-chrome__item.is-active .tab-item-main),
.admin-navigation-theme-brand-gradient
  :deep(.layout-tabbar .tabs-chrome__item.is-active .tabs-chrome__extra) {
  color: hsl(var(--primary)) !important;
}

/* 标准 CRUD 的多种表格实现共用低饱和主题渐变表头。 */
.admin-navigation-theme-gradient-crud-header {
  --admin-crud-header-gradient: linear-gradient(
    125deg,
    color-mix(in srgb, hsl(var(--primary)) 12%, hsl(var(--background))) 0%,
    var(--navigation-gradient-transition-color) 52%,
    var(--navigation-gradient-end-color) 100%
  );
}

.admin-navigation-theme-gradient-crud-header
  :deep(
    .ant-table-thead > tr,
    .vxe-table--header-wrapper .vxe-header--row,
    table thead > tr
  ) {
  background-color: hsl(var(--background)) !important;
  background-image: var(--admin-crud-header-gradient) !important;
  background-attachment: fixed;
}

.admin-navigation-theme-gradient-crud-header
  :deep(
    .ant-table-thead
      > tr
      > th:not(.ant-table-cell-fix-left):not(.ant-table-cell-fix-left-last):not(
        .ant-table-cell-fix-right
      ):not(.ant-table-cell-fix-right-first):not([style*='position: sticky']),
    .vxe-table--header-wrapper .vxe-header--row > th,
    table thead > tr > th
  ) {
  background: transparent !important;
}

/* 固定表头在渐变模式下复用不透明品牌渐变。 */
.admin-navigation-theme-gradient-crud-header
  :deep(
    .ant-table-thead
      > tr
      > th:is(
        .ant-table-cell-fix-left,
        .ant-table-cell-fix-left-last,
        .ant-table-cell-fix-right,
        .ant-table-cell-fix-right-first
      ),
    .ant-table-thead > tr > th[style*='position: sticky']
  ) {
  background-color: hsl(var(--background)) !important;
  background-image: var(--admin-crud-header-gradient) !important;
  background-attachment: fixed;
}

/* 工具栏图标静止时不叠加圆形表面，交互时与顶栏使用同强度主题色。 */
.admin-navigation-theme-brand-gradient :deep(.vben-crud-table-tool-button) {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

.admin-navigation-theme-brand-gradient
  :deep(.vben-crud-table-tool-button:hover),
.admin-navigation-theme-brand-gradient
  :deep(.vben-crud-table-tool-button:focus-visible) {
  color: hsl(var(--primary)) !important;
  background: hsl(var(--primary) / 36%) !important;
  border-color: transparent !important;
}

/* CRUD 操作栏只作轻量承接，不抢占新增和工具按钮的操作层级。 */
.admin-navigation-theme-gradient-crud-toolbar
  :deep(.vben-crud-page > .vben-crud-section:nth-of-type(2) > .mb-3.flex) {
  background: linear-gradient(
    125deg,
    hsl(var(--primary) / 8%) 0%,
    var(--navigation-gradient-transition-color) 52%,
    var(--navigation-gradient-end-color) 100%
  );
  border-radius: calc(var(--radius) + 0.15rem);
}

.admin-navigation-theme-gradient-crud-table
  :deep(.vben-crud-page > .vben-crud-section:nth-of-type(2)) {
  background: linear-gradient(
    125deg,
    hsl(var(--primary) / 5%) 0%,
    var(--navigation-gradient-transition-color) 52%,
    var(--navigation-gradient-end-color) 100%
  );
  border-radius: calc(var(--radius) + 0.2rem);
}

.admin-navigation-theme-gradient-crud-rows
  :deep(
    .ant-table-tbody > tr,
    .vxe-table--body-wrapper .vxe-body--row,
    table tbody > tr
  ) {
  background: linear-gradient(
    125deg,
    hsl(var(--primary) / 4%) 0%,
    var(--navigation-gradient-transition-color) 52%,
    var(--navigation-gradient-end-color) 100%
  ) !important;
}

.admin-navigation-theme-gradient-crud-rows
  :deep(
    .ant-table-tbody > tr > td,
    .vxe-table--body-wrapper .vxe-body--row > td,
    table tbody > tr > td
  ) {
  background: transparent !important;
}

.admin-navigation-theme-gradient-crud-query
  :deep(.vben-crud-page > .vben-crud-section:nth-of-type(1)) {
  background: linear-gradient(
    125deg,
    hsl(var(--primary) / 6%) 0%,
    var(--navigation-gradient-transition-color) 52%,
    var(--navigation-gradient-end-color) 100%
  );
  border-radius: calc(var(--radius) + 0.15rem);
}

.admin-navigation-theme-gradient-crud-create-form
  :deep(.vben-crud-form-modal--create .ant-modal-content),
.admin-navigation-theme-gradient-crud-edit-form
  :deep(.vben-crud-form-modal--edit .ant-modal-content),
.admin-navigation-theme-gradient-crud-detail-form
  :deep(.vben-crud-detail-form-modal .ant-modal-content) {
  background: linear-gradient(
    125deg,
    hsl(var(--primary) / 7%) 0%,
    var(--navigation-gradient-transition-color) 52%,
    var(--navigation-gradient-end-color) 100%
  );
}

.admin-navigation-theme-gradient-crud-create-form
  :deep(
    .vben-crud-form-modal--create .ant-modal-header,
    .vben-crud-form-modal--create .ant-modal-body,
    .vben-crud-form-modal--create .ant-modal-footer
  ),
.admin-navigation-theme-gradient-crud-edit-form
  :deep(
    .vben-crud-form-modal--edit .ant-modal-header,
    .vben-crud-form-modal--edit .ant-modal-body,
    .vben-crud-form-modal--edit .ant-modal-footer
  ),
.admin-navigation-theme-gradient-crud-detail-form
  :deep(
    .vben-crud-detail-form-modal .ant-modal-header,
    .vben-crud-detail-form-modal .ant-modal-body,
    .vben-crud-detail-form-modal .ant-modal-footer
  ) {
  background: transparent !important;
}

/* 菜单主体维持中性，只在悬停和当前项提供明确、轻量的层次。 */
.admin-navigation-theme-brand-gradient
  :deep(aside.light .vben-menu.is-vertical) {
  padding: 6px 8px 20px;
  --menu-background-color: transparent !important;
  --sidebar-menu-active-background-color: transparent !important;
  --sidebar-menu-background-color: transparent !important;
  --sidebar-menu-hover-background-color: transparent !important;
  background: transparent !important;
}

/* 滚动层、子菜单和底部控制层必须透明，才能露出整块侧栏渐变。 */
.admin-navigation-theme-brand-gradient
  :deep(
    aside.light .layout-sidebar-scrollbar,
    aside.light .vben-menu,
    aside.light .vben-menu .vben-sub-menu,
    aside.light .vben-menu .vben-sub-menu-content
  ) {
  background: transparent !important;
}

.admin-navigation-theme-brand-gradient :deep(aside.light .scrollbar-top-shadow),
.admin-navigation-theme-brand-gradient
  :deep(aside.light .scrollbar-bottom-shadow),
.admin-navigation-theme-brand-gradient
  :deep(aside.light .sidebar-bottom-control) {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

/* 底部收起与固定控件静止透明，悬停时与顶部菜单按钮使用同一主色反馈。 */
.admin-navigation-theme-brand-gradient
  :deep(
    aside.light .sidebar-bottom-control:hover,
    aside.light .sidebar-bottom-control:focus-visible
  ) {
  color: hsl(var(--foreground)) !important;
  background: var(
    --header-control-background-hover,
    hsl(var(--primary) / 36%)
  ) !important;
  border-color: transparent !important;
}

.admin-navigation-theme-brand-gradient
  :deep(
    aside.light .vben-menu.is-vertical .vben-menu-item,
    aside.light .vben-menu.is-vertical .vben-sub-menu-content
  ) {
  position: relative;
  border: 1px solid transparent;
  border-radius: calc(var(--radius) + 0.2rem);
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    color 180ms ease;
}

.admin-navigation-theme-brand-gradient
  :deep(
    aside.light .vben-menu.is-vertical .vben-menu-item:not(.is-active):hover,
    aside.light
      .vben-menu.is-vertical
      .vben-sub-menu-content:not(.is-active):hover
  ) {
  background: linear-gradient(
    125deg,
    hsl(var(--primary) / 14%) 0%,
    hsl(var(--primary) / 7%) 100%
  ) !important;
  border-color: transparent;
  border-radius: 9999px;
}

.admin-navigation-theme-brand-gradient
  :deep(aside.light .vben-menu.is-vertical .vben-menu-item.is-active) {
  color: hsl(var(--primary));
  background: linear-gradient(
    125deg,
    hsl(var(--primary) / 36%) 0%,
    hsl(var(--primary) / 20%) 100%
  ) !important;
  border-color: transparent;
  border-radius: 9999px;
  box-shadow: 0 7px 16px hsl(var(--primary) / 18%);
}

.admin-navigation-theme-brand-gradient
  :deep(
    aside.light .vben-menu.is-vertical .vben-menu-item:focus-visible,
    aside.light .vben-menu.is-vertical .vben-sub-menu-content:focus-visible
  ) {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

/* 收起后移除品牌卡片边距，确保图标导航保持紧凑清晰。 */
.admin-navigation-theme-brand-gradient
  :deep(aside.light .vben-menu.is-collapse) {
  padding-right: 0;
  padding-left: 0;
}

.admin-navigation-theme-brand-gradient
  :deep(
    aside.light:has(.vben-menu.is-collapse) div.layout-sidebar-brand.light
  ) {
  margin-right: 0;
  margin-left: 0;
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}

/* 极简留白主题仅保留边界与选中态，适合追求信息密度的后台。 */
.admin-navigation-theme-minimal :deep(aside.light.bg-sidebar) {
  background: hsl(var(--sidebar));
  border-right: 1px solid hsl(var(--border));
}

.admin-navigation-theme-minimal
  :deep(aside.light div.layout-sidebar-brand.light) {
  margin: 10px 10px 8px;
}

.admin-navigation-theme-minimal :deep(aside.light .vben-menu.is-vertical) {
  padding: 6px 8px 20px;
  --menu-item-margin-y: var(--sidebar-menu-item-gap, 2px);
}

.admin-navigation-theme-minimal
  :deep(
    aside.light .vben-menu.is-vertical .vben-menu-item,
    aside.light .vben-menu.is-vertical .vben-sub-menu-content
  ) {
  border: 1px solid transparent;
  border-radius: calc(var(--radius) + 0.2rem);
}

.admin-navigation-theme-minimal
  :deep(aside.light .vben-menu.is-vertical .vben-menu-item.is-active) {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%) !important;
  border-radius: var(--radius);
}

.admin-navigation-theme-minimal :deep(header.light.bg-header) {
  background: hsl(var(--header));
  border-bottom: 1px solid hsl(var(--border));
}

/* 两种导航主题统一收紧租户名称，Logo 图标仍由组件独立尺寸控制。 */
.admin-navigation-theme-brand-gradient
  :deep(aside.light div.layout-sidebar-brand.light),
.admin-navigation-theme-brand-gradient
  :deep(aside.light div.layout-sidebar-brand.light > a.layout-sidebar-brand),
.admin-navigation-theme-minimal
  :deep(aside.light div.layout-sidebar-brand.light),
.admin-navigation-theme-minimal
  :deep(aside.light div.layout-sidebar-brand.light > a.layout-sidebar-brand) {
  font-size: 0.9375rem !important;
}

/* 菜单选中和悬停不依赖边框，主题切换时也不会闪现边框颜色。 */
.admin-navigation-theme-brand-gradient
  :deep(
    aside.light .vben-menu.is-vertical .vben-menu-item,
    aside.light .vben-menu.is-vertical .vben-sub-menu-content
  ),
.admin-navigation-theme-minimal
  :deep(
    aside.light .vben-menu.is-vertical .vben-menu-item,
    aside.light .vben-menu.is-vertical .vben-sub-menu-content
  ) {
  border-color: transparent !important;
  transition-property: background-color, box-shadow, color;
}

/* 父级只负责展开当前分支，不继承叶子菜单的选中颜色和背景。 */
.admin-navigation-theme-brand-gradient
  :deep(aside.light .vben-menu.is-vertical .vben-sub-menu-content.is-active),
.admin-navigation-theme-minimal
  :deep(aside.light .vben-menu.is-vertical .vben-sub-menu-content.is-active) {
  color: inherit;
  background: transparent !important;
  border-color: transparent;
  box-shadow: none;
}
</style>
