<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import {
  computed,
  defineAsyncComponent,
  onMounted,
  ref,
  useSlots,
  watch,
} from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { useWatermark } from '@vben/hooks';
import {
  BasicLayout,
  LockScreen,
  Notification,
  UserDropdown,
} from '@vben/layouts';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  Button,
  Checkbox,
  Empty,
  message,
  Modal,
  Popconfirm,
  Tag,
} from 'ant-design-vue';

import {
  getAdminMenuSyncService,
  getAdminNoticeService,
} from '@levin/admin-framework';
import {
  ADMIN_UI_BASE_SETTING_KEY,
  rbacService,
} from '@levin/admin-framework/framework-commons/app/api';
import { $t } from '@levin/admin-framework/framework-commons/app/locales';
import { resolveAdminPage } from '@levin/admin-framework/framework-commons/app/pages';
import { useAuthStore } from '@levin/admin-framework/framework-commons/app/store';

import {
  getFrameworkEventListeners,
  removeFrameworkEventListener,
  setFrameworkEventListenerEnabled,
  type FrameworkEventListenerInfo,
} from '../../event-bus';
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
const LoginForm = defineAsyncComponent(
  resolveAdminPage('/_core/authentication/login.vue'),
);
const ProfileCenter = defineAsyncComponent(
  resolveAdminPage('/_core/profile/index.vue'),
);
const profileModalOpen = ref(false);
const syncMenuRoutesModalOpen = ref(false);
const saveAdminUiBaseSettingModalOpen = ref(false);
const saveAdminUiBaseSettingLoading = ref(false);
const eventListenerManagerOpen = ref(false);
const eventListeners = ref<FrameworkEventListenerInfo[]>([]);
const preferServerAdminUiBaseSetting = ref(true);
const eventListenerManagerModalMaxWidth = 'min(70vw, 960px)';
const eventListenerManagerModalStyle = {
  maxWidth: eventListenerManagerModalMaxWidth,
};
const { destroyWatermark, updateWatermark } = useWatermark();
const showDot = computed(() => noticeUnreadCount.value > 0);

const canUploadPageRoutes = computed(() => {
  const userInfo = (userStore.userInfo || {}) as Record<string, any>;
  return userInfo.superAdmin === true && Boolean(getAdminMenuSyncService());
});

const menus = computed(() => [
  {
    handler: () => {
      profileModalOpen.value = true;
    },
    icon: 'lucide:user',
    text: $t('page.auth.profile'),
  },
  ...(canUploadPageRoutes.value
    ? [
        {
          handler: () => {
            syncMenuRoutesModalOpen.value = true;
          },
          icon: 'lucide:cloud-upload',
          text: '上传页面路由',
        },
        {
          handler: () => {
            preferServerAdminUiBaseSetting.value = true;
            saveAdminUiBaseSettingModalOpen.value = true;
          },
          icon: 'lucide:settings',
          text: '上传界面设置',
        },
        {
          handler: () => {
            openEventListenerManager();
          },
          icon: 'lucide:list-tree',
          text: '监听器管理',
        },
      ]
    : []),
]);

const avatar = computed(() => {
  return userStore.userInfo?.avatar ?? preferences.app.defaultAvatar;
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

async function handleLogout() {
  await authStore.logout(false);
}

function clonePreferences() {
  return JSON.parse(JSON.stringify(preferences)) as Record<string, any>;
}

async function handleSaveAdminUiBaseSetting() {
  if (saveAdminUiBaseSettingLoading.value) {
    return;
  }

  saveAdminUiBaseSettingLoading.value = true;

  try {
    await rbacService.adjustSiteUiSetting({
      [ADMIN_UI_BASE_SETTING_KEY]: {
        preferServerSetting: preferServerAdminUiBaseSetting.value,
        setting: clonePreferences(),
      },
    });
    message.success('界面设置上传成功');
    saveAdminUiBaseSettingModalOpen.value = false;
  } catch {
    message.error('界面设置上传失败');
  } finally {
    saveAdminUiBaseSettingLoading.value = false;
  }
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
    .filter((item): item is NotificationItem => Boolean(item));
  const unreadItems = visibleItems.filter((item) => !item.isRead);

  notificationUnreadItems.value = unreadItems;
  noticeUnreadCount.value = unreadItems.length;
  notifications.value = unreadItems.slice(0, NOTIFICATION_PREVIEW_LIMIT);
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

onMounted(() => {
  loadNotifications().catch((error) => {
    console.warn('加载通知失败', error);
  });
});

watch(
  () => [accessStore.accessToken, userStore.userInfo?.id],
  () => {
    loadNotifications().catch((error) => {
      console.warn('加载通知失败', error);
    });
  },
);

watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
  }),
  async ({ enable, content }) => {
    if (enable) {
      await updateWatermark({
        content:
          content ||
          `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
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
  <BasicLayout @clear-preferences-and-logout="handleLogout">
    <template #user-dropdown>
      <Modal
        v-model:open="profileModalOpen"
        :footer="null"
        :title="$t('page.auth.profile')"
        :width="960"
        destroy-on-close
      >
        <ProfileCenter class="max-h-[72vh] overflow-y-auto" />
      </Modal>
      <SyncMenuRoutesModal v-model:open="syncMenuRoutesModalOpen" />
      <Modal
        v-model:open="saveAdminUiBaseSettingModalOpen"
        :confirm-loading="saveAdminUiBaseSettingLoading"
        title="上传界面设置"
        @ok="handleSaveAdminUiBaseSetting"
      >
        <Checkbox v-model:checked="preferServerAdminUiBaseSetting">
          优先使用服务端设置参数
        </Checkbox>
      </Modal>
      <Modal
        v-model:open="eventListenerManagerOpen"
        :footer="null"
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
