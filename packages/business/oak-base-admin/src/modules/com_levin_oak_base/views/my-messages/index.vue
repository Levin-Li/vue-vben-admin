<script lang="ts" setup>
import type { NoticeSourceInfo } from '../../api/notice-service';
import type { MyMessageInfo } from '../../api/user-message-service';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/runtime/stores';

import {
  formatPersonalMessageSummary,
  resolvePersonalMessageSourceRoute,
} from '@levin/admin-framework';
import { globalDomainContextRevision } from '@levin/admin-framework/framework-commons/app/global-domain-context-state';
import { globalOrgContextRevision } from '@levin/admin-framework/framework-commons/app/global-org-context-state';
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  message,
  Modal,
  Pagination,
  Spin,
  Tag,
} from 'ant-design-vue';

import { noticeService } from '../../api/notice-service';
import { userMessageService } from '../../api/user-message-service';
import NoticeContentViewer from './notice-content-viewer.vue';

type MessageFilter = 'all' | 'unread';
const router = useRouter();
const route = useRoute();
const accessStore = useAccessStore();
const userStore = useUserStore();
const loading = ref(false);
const submitting = ref(false);
const errorMessage = ref('');
const messages = ref<MyMessageInfo[]>([]);
const selectedIds = ref(new Set<string>());
const activeFilter = ref<MessageFilter>('unread');
const detailOpen = ref(false);
const activeMessage = ref<MyMessageInfo | null>(null);
const pageIndex = ref(1);
const totalCount = ref(0);
const unreadCount = ref(0);
const PAGE_SIZE = 20;
let listRequestVersion = 0;
let detailRequestVersion = 0;
let noticeRequestVersion = 0;
const noticeSource = ref<NoticeSourceInfo>();
const noticeSourceOpen = ref(false);
const noticeSourceLoading = ref(false);
const noticeSourceError = ref('');

// 来源类型标签与跳转解析分离，正文和外部URL不能成为页面地址。
const sourceLabels: Record<string, string> = {
  Inbox: '收件箱',
  Notice: '通知公告',
  Ticket: '工单',
  Workflow: '工作流',
};
const selectedUnreadIds = computed(() =>
  messages.value
    .filter((item) => !item.readTime && selectedIds.value.has(item.id))
    .map((item) => item.id),
);
const allSelected = computed(
  () =>
    messages.value.length > 0 &&
    messages.value.every((item) => selectedIds.value.has(item.id)),
);
const partiallySelected = computed(
  () => selectedIds.value.size > 0 && !allSelected.value,
);

function formatDate(value?: null | string) {
  return value ? value.replace('T', ' ').slice(0, 19) : '-';
}

function sourceLabel(sourceType?: string) {
  return sourceLabels[sourceType || ''] || '业务消息';
}

function selectItem(id: string, checked: boolean) {
  const next = new Set(selectedIds.value);
  if (checked) next.add(id);
  else next.delete(id);
  selectedIds.value = next;
}

function selectAll(checked: boolean) {
  selectedIds.value = checked
    ? new Set(messages.value.map((item) => item.id))
    : new Set();
}

async function refreshUnreadCount() {
  try {
    unreadCount.value = Number(await userMessageService.unreadCount()) || 0;
  } catch (error) {
    console.error(error);
  }
}

// 每次筛选或换页重新向服务端查询，不过滤已加载页来冒充完整结果。
async function loadMessages(nextPage = pageIndex.value) {
  const version = ++listRequestVersion;
  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await userMessageService.list({
      pageIndex: nextPage,
      pageSize: PAGE_SIZE,
      unreadOnly: activeFilter.value === 'unread',
    });
    if (version !== listRequestVersion) return;
    messages.value = result.items || [];
    pageIndex.value = result.pageIndex || nextPage;
    totalCount.value = Number(result.totals) || 0;
    selectedIds.value = new Set();
  } catch (error) {
    console.error(error);
    if (version === listRequestVersion) {
      errorMessage.value = '我的消息加载失败，请重试';
    }
  } finally {
    if (version === listRequestVersion) loading.value = false;
  }
  if (version === listRequestVersion) await refreshUnreadCount();
}

async function setFilter(filter: MessageFilter) {
  activeFilter.value = filter;
  await loadMessages(1);
}

// 详情通过本人专用接口重新授权；打开详情不隐式标记已读。
async function openMessage(item: MyMessageInfo) {
  const version = ++detailRequestVersion;
  try {
    const detail = await userMessageService.retrieve(item.id);
    if (version !== detailRequestVersion) return;
    activeMessage.value = detail;
    detailOpen.value = true;
  } catch (error) {
    console.error(error);
    message.error('消息详情不可访问或已失效');
  }
}

async function markRead(ids: string[]) {
  if (ids.length === 0) return;
  if (ids.length > 100) {
    message.error('每次最多标记 100 条消息');
    return;
  }
  submitting.value = true;
  try {
    await userMessageService.markRead({ ids });
    message.success(`已标记 ${ids.length} 条消息为已读`);
    if (activeMessage.value && ids.includes(activeMessage.value.id)) {
      activeMessage.value = await userMessageService.retrieve(
        activeMessage.value.id,
      );
    }
    await loadMessages(pageIndex.value);
    if (messages.value.length === 0 && pageIndex.value > 1) {
      await loadMessages(pageIndex.value - 1);
    }
  } catch (error) {
    console.error(error);
    message.error('标记已读失败，请重试');
  } finally {
    submitting.value = false;
  }
}

function sourceRoute(item: MyMessageInfo) {
  return resolvePersonalMessageSourceRoute(item);
}

async function openSource(item: MyMessageInfo) {
  // 目标页面通过自己的详情接口再次授权；此处不传未授权的正文或路径。
  const source = sourceRoute(item);
  if (!source) {
    message.info('来源暂不可打开');
    return;
  }
  await router.push(source.query ? source : source.path);
}

// 公告定位参数不携带身份或租户；每次由专用来源接口重验快照与当前资格。
async function loadNoticeSource(value: unknown) {
  const version = ++noticeRequestVersion;
  noticeSource.value = undefined;
  noticeSourceError.value = '';
  noticeSourceLoading.value = false;
  noticeSourceOpen.value = value !== undefined;
  if (value === undefined) return;
  if (typeof value !== 'string' || !/^[A-Z0-9][\w.:-]{0,63}$/i.test(value)) {
    noticeSourceError.value = '公告来源定位参数无效';
    return;
  }
  if (!accessStore.accessToken || !userStore.userInfo?.id) {
    noticeSourceError.value = '公告来源不可访问或已失效';
    return;
  }
  noticeSourceLoading.value = true;
  try {
    const result = await noticeService.myDetail(value);
    if (version !== noticeRequestVersion) return;
    if (!result || result.id !== value) {
      noticeSourceError.value = '公告来源不可访问或已失效';
      return;
    }
    noticeSource.value = result;
  } catch {
    if (version === noticeRequestVersion)
      noticeSourceError.value = '公告来源不可访问或已失效';
  } finally {
    if (version === noticeRequestVersion) noticeSourceLoading.value = false;
  }
}
function dismissNoticeSource() {
  closeNoticeSource();
  if (route.query.noticeId !== undefined) {
    const query = { ...route.query };
    delete query.noticeId;
    void router.replace({ path: '/clob/V1/MyMessages', query });
  }
}
function closeNoticeSource() {
  noticeRequestVersion += 1;
  noticeSource.value = undefined;
  noticeSourceOpen.value = false;
  noticeSourceLoading.value = false;
}
onMounted(() => {
  void loadMessages(1);
  void loadNoticeSource(route.query.noticeId);
});
watch(() => route.query.noticeId, loadNoticeSource);
watch(
  () => [
    accessStore.accessToken,
    userStore.userInfo?.id,
    userStore.userInfo?.tenantId,
    globalOrgContextRevision.value,
    globalDomainContextRevision.value,
  ],
  () => {
    listRequestVersion += 1;
    detailRequestVersion += 1;
    messages.value = [];
    selectedIds.value = new Set();
    activeMessage.value = null;
    detailOpen.value = false;
    totalCount.value = 0;
    unreadCount.value = 0;
    closeNoticeSource();
    if (accessStore.accessToken && userStore.userInfo?.id) {
      void loadMessages(1);
      void loadNoticeSource(route.query.noticeId);
    }
  },
);
onBeforeUnmount(() => {
  listRequestVersion += 1;
  detailRequestVersion += 1;
  closeNoticeSource();
});
</script>

<template>
  <Page
    auto-content-height
    content-class="!bg-card !m-4 min-w-0 !overflow-hidden rounded-lg"
  >
    <div class="my-messages-page flex h-full min-h-0 flex-col">
      <!-- 工具栏只提供服务端支持的筛选条件及当前页批量操作。 -->
      <div
        class="bg-card flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
      >
        <div class="flex flex-wrap items-center gap-2">
          <strong class="text-base">我的消息</strong>
          <Tag color="blue">共 {{ totalCount }} 条</Tag>
          <Tag v-if="unreadCount > 0" color="processing">
            未读 {{ unreadCount }}
          </Tag>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Checkbox
            :checked="allSelected"
            :indeterminate="partiallySelected"
            @change="selectAll($event.target.checked)"
          >
            当前页全选
          </Checkbox>
          <Button
            :disabled="selectedUnreadIds.length === 0"
            :loading="submitting"
            size="small"
            @click="markRead(selectedUnreadIds)"
          >
            批量已读
          </Button>
          <Button
            :type="activeFilter === 'all' ? 'primary' : 'default'"
            size="small"
            @click="setFilter('all')"
          >
            全部
          </Button>
          <Button
            :type="activeFilter === 'unread' ? 'primary' : 'default'"
            size="small"
            @click="setFilter('unread')"
          >
            未读
          </Button>
          <Button
            aria-label="刷新"
            :loading="loading"
            size="small"
            @click="loadMessages(pageIndex)"
          >
            刷新
          </Button>
        </div>
      </div>

      <Alert
        v-if="errorMessage"
        :message="errorMessage"
        class="m-4"
        show-icon
        type="error"
      />

      <!-- 列表只展示个人消息安全摘要；不渲染来源正文或富文本。 -->
      <Spin :spinning="loading" class="min-h-0 flex-1 overflow-auto">
        <div class="h-full overflow-auto px-4 py-3">
          <Empty
            v-if="!loading && messages.length === 0"
            class="mt-20"
            description="暂无消息"
          />
          <div
            v-for="item in messages"
            :key="item.id"
            class="message-row grid min-w-0 gap-3 border-b px-4 py-3 md:grid-cols-[auto_1fr_auto]"
          >
            <Checkbox
              :checked="selectedIds.has(item.id)"
              class="mt-1"
              @change="selectItem(item.id, $event.target.checked)"
            />
            <button
              class="min-w-0 border-0 bg-transparent p-0 text-left"
              type="button"
              @click="openMessage(item)"
            >
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <Tag :color="item.readTime ? 'default' : 'processing'">
                  {{ item.readTime ? '已读' : '未读' }}
                </Tag>
                <Tag>{{ sourceLabel(item.sourceType) }}</Tag>
                <span class="text-foreground truncate text-sm font-semibold">{{
                  item.title || '业务消息'
                }}</span>
              </div>
              <div class="text-muted-foreground line-clamp-2 text-sm">
                {{ formatPersonalMessageSummary(item) }}
              </div>
              <div class="text-muted-foreground mt-2 text-xs">
                {{ formatDate(item.createTime) }}
              </div>
            </button>
            <div class="flex items-center justify-end gap-2">
              <Button size="small" type="link" @click="openMessage(item)">
                查看
              </Button>
              <Button
                v-if="!item.readTime"
                :loading="submitting"
                size="small"
                type="link"
                @click="markRead([item.id])"
              >
                标记已读
              </Button>
            </div>
          </div>
        </div>
      </Spin>

      <div class="flex justify-end border-t px-4 py-3">
        <Pagination
          :current="pageIndex"
          :page-size="PAGE_SIZE"
          :total="totalCount"
          :show-size-changer="false"
          @change="loadMessages"
        />
      </div>

      <!-- 来源跳转只指向显式白名单中的既有页面。 -->
      <Modal
        v-model:open="detailOpen"
        :footer="null"
        :title="activeMessage?.title || '消息详情'"
        width="640px"
      >
        <div v-if="activeMessage" class="grid gap-4">
          <div class="flex flex-wrap gap-2">
            <Tag :color="activeMessage.readTime ? 'default' : 'processing'">
              {{ activeMessage.readTime ? '已读' : '未读' }}
            </Tag>
            <Tag>{{ sourceLabel(activeMessage.sourceType) }}</Tag>
            <span class="text-muted-foreground text-xs">{{
              formatDate(activeMessage.createTime)
            }}</span>
          </div>
          <!-- 工作流通知正文保存在本人消息摘要中，详情须经安全 Markdown 阅读器展示。 -->
          <NoticeContentViewer
            v-if="activeMessage.sourceType === 'Workflow'"
            :content="activeMessage.summary || '暂无摘要'"
            content-type="Markdown"
          />
          <p v-else class="whitespace-pre-wrap text-sm">
            {{ activeMessage.summary || '暂无摘要' }}
          </p>
          <div class="flex justify-end gap-2">
            <Button @click="detailOpen = false">关闭</Button>
            <Button
              v-if="!activeMessage.readTime"
              :loading="submitting"
              @click="markRead([activeMessage.id])"
            >
              标记已读
            </Button>
            <Button
              :disabled="!sourceRoute(activeMessage)"
              @click="openSource(activeMessage)"
            >
              查看来源
            </Button>
          </div>
          <p
            v-if="!sourceRoute(activeMessage)"
            class="text-muted-foreground text-xs"
          >
            来源暂不可打开
          </p>
        </div>
      </Modal>
      <!-- 本人公告使用受众快照来源接口；管理正文与受众配置不参与该入口。 -->
      <Modal
        :open="noticeSourceOpen"
        :footer="null"
        :title="noticeSource?.title || '公告来源'"
        width="960px"
        @cancel="dismissNoticeSource"
      >
        <Spin :spinning="noticeSourceLoading">
          <Alert
            v-if="noticeSourceError"
            :message="noticeSourceError"
            type="warning"
            show-icon
          />
          <section v-if="noticeSource">
            <p v-if="noticeSource.subtitle">{{ noticeSource.subtitle }}</p>
            <p class="text-muted-foreground text-xs">
              发布时间：{{ formatDate(noticeSource.publishTime) }}
            </p>
            <NoticeContentViewer
              :content="noticeSource.content"
              :content-type="noticeSource.contentType"
            />
          </section>
        </Spin>
      </Modal>
    </div>
  </Page>
</template>

<style scoped>
.my-messages-page :deep(.ant-spin-nested-loading),
.my-messages-page :deep(.ant-spin-container) {
  height: 100%;
  min-height: 0;
}
.message-row {
  border-color: hsl(var(--border));
}
</style>
