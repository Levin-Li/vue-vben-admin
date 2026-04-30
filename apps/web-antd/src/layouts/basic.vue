<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import { computed, onMounted, ref, watch } from 'vue';
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

import { Modal } from 'ant-design-vue';

import { noticeService } from '#/api/com_levin_oak_base';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import LoginForm from '#/views/_core/authentication/login.vue';
import ProfileCenter from '#/views/_core/profile/index.vue';

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
const accessStore = useAccessStore();
const router = useRouter();
const profileModalOpen = ref(false);
const syncMenuRoutesModalOpen = ref(false);
const { destroyWatermark, updateWatermark } = useWatermark();
const showDot = computed(() => noticeUnreadCount.value > 0);

const canUploadPageRoutes = computed(() => {
  const userInfo = (userStore.userInfo || {}) as Record<string, any>;
  return userInfo.superAdmin === true;
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
  if (!accessStore.accessToken) {
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
  const state = getNoticeState(item);
  const noticeId = state?.noticeId;
  if (!noticeId) {
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
