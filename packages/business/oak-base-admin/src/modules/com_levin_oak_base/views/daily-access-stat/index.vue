<script setup lang="ts">
import type {
  AccessDimensionType,
  AccessSide,
  DailyAccessOverview,
  DailyAccessStat,
  HostResourceStat,
} from '../../api/daily-access-stat-service';

import { onMounted, onUnmounted, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Empty,
  message,
  Select,
  Table,
  Tabs,
} from 'ant-design-vue';

import { dailyAccessStatService } from '../../api/daily-access-stat-service';

// 日期按服务端统计时区选择，避免浏览器所在时区造成跨天查询偏差。
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const statDate = ref(today());
const accessSide = ref<AccessSide>('Backend');
const activeTab = ref('network');
const sideOptions = [
  { label: '后端（管理 API）', value: 'Backend' },
  { label: '前端（客户端 API）', value: 'Frontend' },
];
const { hasPermission } = useRbacAccess();
const allowed = () =>
  hasPermission(buildApiMethodPermissions(dailyAccessStatService, 'top20')) &&
  hasPermission(buildApiMethodPermissions(dailyAccessStatService, 'overview'));

// 两个维度分别查询和展示；并发峰值仅对本行维度有效，不合并为整体峰值。
const rows = ref<Record<AccessDimensionType, DailyAccessStat[]>>({
  Ip: [],
  User: [],
});
const overview = ref<DailyAccessOverview>();
const loading = ref(false);
const error = ref('');
watch(error, (value) => {
  if (value) message.error(value);
});
const columns = [
  { title: '排名', key: 'rank', width: 80 },
  { title: '租户 ID', dataIndex: 'tenantId', key: 'tenantId' },
  { title: '维度值', dataIndex: 'dimensionValue', key: 'dimensionValue' },
  { title: '累计访问次数', dataIndex: 'visitCount', key: 'visitCount' },
  {
    title: '最高并发次数',
    dataIndex: 'peakConcurrency',
    key: 'peakConcurrency',
  },
];
const slowUrlColumns = [
  { title: '排名', key: 'rank', width: 80 },
  { title: 'URL 路径', dataIndex: 'requestPath', key: 'requestPath' },
  { title: '请求次数', dataIndex: 'visitCount', key: 'visitCount' },
  {
    title: '平均响应时间（毫秒）',
    dataIndex: 'averageMillis',
    key: 'averageMillis',
  },
  { title: '最长响应时间（毫秒）', dataIndex: 'maxMillis', key: 'maxMillis' },
];
const osColumns = [
  { title: '节点', dataIndex: 'nodeId', key: 'nodeId' },
  { title: '平均 CPU', key: 'averageCpuPercent' },
  { title: '平均内存', key: 'averageMemoryPercent' },
  { title: '平均磁盘', key: 'averageDiskPercent' },
  { title: '磁盘总量', key: 'diskTotalBytes' },
  { title: '磁盘剩余', key: 'diskFreeBytes' },
];
const poolColumns = [
  { title: '节点', dataIndex: 'nodeId', key: 'nodeId' },
  { title: '连接池活跃/空闲/等待/上限', key: 'poolCurrent' },
  { title: '平均活跃/峰值', key: 'poolActiveSummary' },
  { title: '平均等待/峰值', key: 'poolPendingSummary' },
];
const executorColumns = [
  { title: '线程池 Bean', dataIndex: 'name', key: 'name' },
  { title: '当前活跃', key: 'active' },
  { title: '当前池大小', key: 'poolSize' },
  { title: '最大容量', key: 'maxSize' },
  { title: '等待队列', key: 'queueSize' },
];
const percent = (value?: null | number) =>
  typeof value === 'number' ? `${value.toFixed(1)}%` : '—';
const bytes = (value?: null | number) =>
  typeof value === 'number' ? `${(value / 1024 ** 3).toFixed(1)} GiB` : '—';
const heapBytes = (value?: null | number) =>
  typeof value === 'number' ? `${(value / 1024 ** 2).toFixed(1)} MiB` : '—';
const count = (value?: null | number) =>
  typeof value === 'number' ? String(value) : '—';
const uptime = (value?: null | number) =>
  typeof value === 'number' ? `${(value / 3_600_000).toFixed(1)} 小时` : '—';
const poolCurrent = (record: Partial<HostResourceStat>) =>
  [record.poolActive, record.poolIdle, record.poolPending, record.poolMax]
    .map((value) => count(value))
    .join(' / ');
const poolActiveSummary = (record: Partial<HostResourceStat>) =>
  [record.averagePoolActive, record.peakPoolActive]
    .map((value) => count(value))
    .join(' / ');
const poolPendingSummary = (record: Partial<HostResourceStat>) =>
  [record.averagePoolPending, record.peakPoolPending]
    .map((value) => count(value))
    .join(' / ');
let loadVersion = 0;
const LIVE_REFRESH_MILLIS = 5000;
let refreshTimer: ReturnType<typeof setInterval> | undefined;

async function load(periodic = false) {
  if (periodic === true && loading.value) return;
  const current = ++loadVersion;
  if (periodic !== true) {
    rows.value = { Ip: [], User: [] };
    overview.value = undefined;
  }
  error.value = '';
  if (!allowed()) {
    error.value = '没有性能监控查询权限';
    return;
  }
  if (!statDate.value) return;

  loading.value = true;
  try {
    const [ipRows, userRows, currentOverview] = await Promise.all([
      dailyAccessStatService.top20({
        statDate: statDate.value,
        accessSide: accessSide.value,
        dimensionType: 'Ip',
      }),
      dailyAccessStatService.top20({
        statDate: statDate.value,
        accessSide: accessSide.value,
        dimensionType: 'User',
      }),
      dailyAccessStatService.overview({
        statDate: statDate.value,
        accessSide: accessSide.value,
      }),
    ]);
    if (current === loadVersion) {
      rows.value = { Ip: ipRows, User: userRows };
      overview.value = currentOverview;
    }
  } catch {
    if (current === loadVersion) error.value = '访问统计查询失败，请稍后重试';
  } finally {
    if (current === loadVersion) loading.value = false;
  }
}

onMounted(() => {
  void load();
  refreshTimer = setInterval(() => {
    if (statDate.value === today() && document.visibilityState === 'visible') {
      void load(true);
    }
  }, LIVE_REFRESH_MILLIS);
});
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
  loadVersion++;
});
</script>

<template>
  <Page title="性能监控">
    <div class="bg-card grid gap-4 rounded-lg p-4">
      <p class="text-muted-foreground m-0 text-sm">
        按北京时间查看每日访问与节点性能。今天的数据每 5
        秒自动更新；有接口请求时每小时顺带保存一次快照，跨天后的请求补写最终值。
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <DatePicker
          v-model:value="statDate"
          value-format="YYYY-MM-DD"
          placeholder="统计日期"
          @change="() => load()"
        />
        <Button :disabled="!allowed()" @click="() => load()">刷新</Button>
      </div>

      <Tabs v-model:active-key="activeTab">
        <Tabs.TabPane key="network" tab="网络访问">
          <p class="text-muted-foreground text-sm">
            前端／后端入口仅用于网络访问统计。IP
            与用户分别排行，各行并发峰值仅表示该维度的请求峰值。
          </p>
          <Select
            v-model:value="accessSide"
            :options="sideOptions"
            class="mb-4 w-48"
            @change="() => load()"
          />

          <!-- 整体数据由独立汇总提供，不能从 IP 和用户维度相加。 -->
          <section>
            <h2 class="mb-2 text-base font-semibold">当日整体访问</h2>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="rounded border p-3">
                <div class="text-muted-foreground text-sm">累计访问次数</div>
                <div class="mt-1 text-2xl font-semibold">
                  {{ overview?.totalVisitCount ?? '—' }}
                </div>
              </div>
              <div class="rounded border p-3">
                <div class="text-muted-foreground text-sm">最高并发次数</div>
                <div class="mt-1 text-2xl font-semibold">
                  {{ overview?.peakConcurrency ?? '—' }}
                </div>
              </div>
            </div>
          </section>

          <!-- 容量超限或采集异常均会标记缺口，页面不推断单一原因。 -->
          <Alert
            v-if="overview?.collectionIncomplete"
            type="warning"
            show-icon
            message="本日维度统计不完整"
            description="IP、用户或 URL 维度可能因容量上限或采集异常出现缺口，以下前 20 名可能少计；整体访问单独统计，发生 Redis 故障时请核对运行日志。"
          />

          <!-- IP 和用户分别展示，避免把一次请求的两条统计记录相加。 -->
          <section
            v-for="dimension in ['Ip', 'User'] as const"
            :key="dimension"
          >
            <h2 class="mb-2 text-base font-semibold">
              {{
                dimension === 'Ip' ? 'IP 访问量前 20 名' : '用户访问量前 20 名'
              }}
            </h2>
            <Table
              :row-key="
                (record: DailyAccessStat) =>
                  `${record.tenantId}:${record.dimensionValue}`
              "
              :columns="columns"
              :data-source="rows[dimension]"
              :loading="loading"
              :pagination="false"
              :scroll="{ x: 640 }"
            >
              <template #bodyCell="{ column, index }">
                <span v-if="column.key === 'rank'">{{ index + 1 }}</span>
              </template>
              <template #emptyText>
                <Empty description="当前日期和入口暂无统计数据" />
              </template>
            </Table>
          </section>

          <!-- URL 按平均响应时间降序，样本次数帮助判断偶发慢请求。 -->
          <section>
            <h2 class="mb-2 text-base font-semibold">
              平均响应时间最长的 URL 前 20 名
            </h2>
            <Table
              row-key="requestPath"
              :columns="slowUrlColumns"
              :data-source="overview?.slowUrls || []"
              :loading="loading"
              :pagination="false"
              :scroll="{ x: 760 }"
            >
              <template #bodyCell="{ column, index }">
                <span v-if="column.key === 'rank'">{{ index + 1 }}</span>
              </template>
              <template #emptyText>
                <Empty description="当前日期和入口暂无 URL 耗时数据" />
              </template>
            </Table>
          </section>
        </Tabs.TabPane>
        <Tabs.TabPane key="os" tab="OS">
          <!-- OS 指标按节点展示；日期筛选仍生效，访问端筛选不影响节点数据。 -->
          <section>
            <h2 class="mb-2 text-base font-semibold">操作系统资源</h2>
            <p class="text-muted-foreground text-sm">
              CPU、物理内存和磁盘利用率为所选日期的有效样本平均值；磁盘容量与剩余空间取最近一次有效采样。节点指标不按访问入口拆分。
            </p>
            <Table
              row-key="nodeId"
              :columns="osColumns"
              :data-source="overview?.hosts || []"
              :loading="loading"
              :pagination="false"
              :scroll="{ x: 820 }"
            >
              <template #bodyCell="{ column, record }">
                <span v-if="column.key === 'averageCpuPercent'">{{
                  percent(record.averageCpuPercent)
                }}</span>
                <span v-else-if="column.key === 'averageMemoryPercent'">{{
                  percent(record.averageMemoryPercent)
                }}</span>
                <span v-else-if="column.key === 'averageDiskPercent'">{{
                  percent(record.averageDiskPercent)
                }}</span>
                <span v-else-if="column.key === 'diskTotalBytes'">{{
                  bytes(record.diskTotalBytes)
                }}</span>
                <span v-else-if="column.key === 'diskFreeBytes'">{{
                  bytes(record.diskFreeBytes)
                }}</span>
              </template>
              <template #emptyText>
                <Empty
                  description="仅平台最高管理员可查看，或当前日期暂无节点采样"
                />
              </template>
            </Table>
          </section>
        </Tabs.TabPane>
        <Tabs.TabPane key="java" tab="Java">
          <h2 class="mb-2 text-base font-semibold">Java 进程与运行时</h2>
          <p class="text-muted-foreground text-sm">
            进程和线程池是最近一次采样；JVM 堆使用率为当日平均与峰值，GC
            为当日增量。
          </p>
          <Empty
            v-if="!loading && !overview?.hosts?.length"
            description="仅平台最高管理员可查看，或当前日期暂无节点采样"
          />
          <!-- 运行时按节点展开，未知值统一呈现为破折号。 -->
          <div
            v-for="host in overview?.hosts || []"
            :key="host.nodeId"
            class="mt-4 grid gap-3 rounded border p-3"
          >
            <h3 class="m-0 text-sm font-semibold">节点 {{ host.nodeId }}</h3>
            <Descriptions
              title="进程当前快照"
              bordered
              size="small"
              :column="2"
            >
              <Descriptions.Item label="进程 CPU">
                {{ percent(host.processCpuPercent) }}
              </Descriptions.Item>
              <Descriptions.Item label="进程运行时长">
                {{ uptime(host.processUptimeMillis) }}
              </Descriptions.Item>
              <Descriptions.Item label="当前堆使用">
                {{ heapBytes(host.heapUsedBytes) }}
              </Descriptions.Item>
              <Descriptions.Item label="堆上限">
                {{ heapBytes(host.heapMaxBytes) }}
              </Descriptions.Item>
              <Descriptions.Item label="当日平均堆利用率">
                {{ percent(host.averageJvmHeapPercent) }}
              </Descriptions.Item>
              <Descriptions.Item label="当日堆利用率峰值">
                {{ percent(host.peakJvmHeapPercent) }}
              </Descriptions.Item>
              <Descriptions.Item label="当前线程数">
                {{ count(host.jvmThreadCount) }}
              </Descriptions.Item>
              <Descriptions.Item label="线程峰值">
                {{ count(host.jvmPeakThreadCount) }}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions
              title="当日 GC 增量"
              bordered
              size="small"
              :column="2"
            >
              <Descriptions.Item label="GC 次数">
                {{ count(host.gcCountToday) }}
              </Descriptions.Item>
              <Descriptions.Item label="GC 总耗时（毫秒）">
                {{ count(host.gcTimeMillisToday) }}
              </Descriptions.Item>
              <Descriptions.Item label="Full GC 次数">
                {{ count(host.fullGcCountToday) }}
              </Descriptions.Item>
              <Descriptions.Item label="Full GC 总耗时（毫秒）">
                {{ count(host.fullGcTimeMillisToday) }}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <h4 class="mb-2 text-sm font-medium">已识别的 Spring 线程池</h4>
              <Table
                row-key="name"
                :columns="executorColumns"
                :data-source="host.executors || []"
                :pagination="false"
                :scroll="{ x: 640 }"
              >
                <template #bodyCell="{ column, record }">
                  <span v-if="column.key === 'active'">{{
                    count(record.active)
                  }}</span>
                  <span v-else-if="column.key === 'poolSize'">{{
                    count(record.poolSize)
                  }}</span>
                  <span v-else-if="column.key === 'maxSize'">{{
                    count(record.maxSize)
                  }}</span>
                  <span v-else-if="column.key === 'queueSize'">{{
                    count(record.queueSize)
                  }}</span>
                </template>
                <template #emptyText>
                  <Empty description="未识别到可监控的线程池" />
                </template>
              </Table>
            </div>
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane key="database" tab="数据库">
          <h2 class="mb-2 text-base font-semibold">
            数据库连接池与 PostgreSQL
          </h2>
          <p class="text-muted-foreground text-sm">
            连接池当前值取最近一次采样，平均值与峰值按所选日期计算；数据库事务与缓存指标为当日增量。
          </p>
          <Table
            row-key="nodeId"
            :columns="poolColumns"
            :data-source="overview?.hosts || []"
            :loading="loading"
            :pagination="false"
            :scroll="{ x: 860 }"
          >
            <template #bodyCell="{ column, record }">
              <span v-if="column.key === 'poolCurrent'">{{
                poolCurrent(record)
              }}</span>
              <span v-else-if="column.key === 'poolActiveSummary'">{{
                poolActiveSummary(record)
              }}</span>
              <span v-else-if="column.key === 'poolPendingSummary'">{{
                poolPendingSummary(record)
              }}</span>
            </template>
            <template #emptyText>
              <Empty
                description="仅平台最高管理员可查看，或当前日期暂无节点采样"
              />
            </template>
          </Table>
          <div
            v-for="host in overview?.hosts || []"
            :key="host.nodeId"
            class="mt-4 rounded border p-3"
          >
            <Descriptions
              :title="`节点 ${host.nodeId} · PostgreSQL 健康`"
              bordered
              size="small"
              :column="2"
            >
              <Descriptions.Item label="当前连接数">
                {{ count(host.database?.numBackends) }}
              </Descriptions.Item>
              <Descriptions.Item label="当日提交事务">
                {{ count(host.database?.xactCommitToday) }}
              </Descriptions.Item>
              <Descriptions.Item label="当日回滚事务">
                {{ count(host.database?.xactRollbackToday) }}
              </Descriptions.Item>
              <Descriptions.Item label="当日缓存命中率">
                {{ percent(host.database?.cacheHitPercent) }}
              </Descriptions.Item>
              <Descriptions.Item label="当日缓存命中块">
                {{ count(host.database?.blksHitToday) }}
              </Descriptions.Item>
              <Descriptions.Item label="当日磁盘读取块">
                {{ count(host.database?.blksReadToday) }}
              </Descriptions.Item>
              <Descriptions.Item label="当日死锁">
                {{ count(host.database?.deadlocksToday) }}
              </Descriptions.Item>
              <Descriptions.Item label="当日临时文件字节">
                {{ count(host.database?.tempBytesToday) }}
              </Descriptions.Item>
            </Descriptions>
          </div>
        </Tabs.TabPane>
      </Tabs>
    </div>
  </Page>
</template>
