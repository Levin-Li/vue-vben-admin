<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  brandService,
  domainService,
  payChannelService,
  payOrderService,
  tenantService,
  userService,
} from '@levin/oak-base-admin/modules/com_levin_oak_base/api/index';
import { Button } from 'ant-design-vue';

import { resolveOverviewTotal } from './overview-utils';

defineOptions({ name: 'OakBaseAdminHome' });

type OverviewCardState = 'loading' | 'ready' | 'unavailable';
type OverviewCardTone = 'coral' | 'gold' | 'mint' | 'rose' | 'sky' | 'violet';

interface OverviewCard {
  description: string;
  icon: string;
  key: string;
  label: string;
  load: () => Promise<unknown>;
  state: OverviewCardState;
  tone: OverviewCardTone;
  total?: number;
}

const isRefreshing = ref(false);
const lastUpdatedAt = ref<Date>();
const cards = ref<OverviewCard[]>([
  {
    description: '已登记的平台租户',
    icon: 'lucide:building-2',
    key: 'tenant',
    label: '租户',
    load: () => tenantService.list(createCountQuery()),
    state: 'loading',
    tone: 'coral',
  },
  {
    description: '已配置的根域名',
    icon: 'lucide:globe-2',
    key: 'domain',
    label: '域名',
    load: () => domainService.list(createCountQuery()),
    state: 'loading',
    tone: 'sky',
  },
  {
    description: '系统中的用户账号',
    icon: 'lucide:users-round',
    key: 'user',
    label: '用户',
    load: () => userService.list(createCountQuery()),
    state: 'loading',
    tone: 'violet',
  },
  {
    description: '已维护的品牌信息',
    icon: 'lucide:badge-check',
    key: 'brand',
    label: '品牌',
    load: () => brandService.list(createCountQuery()),
    state: 'loading',
    tone: 'rose',
  },
  {
    description: '可用的支付配置',
    icon: 'lucide:wallet-cards',
    key: 'pay-channel',
    label: '支付渠道',
    load: () => payChannelService.list(createCountQuery()),
    state: 'loading',
    tone: 'mint',
  },
  {
    description: '已创建的支付订单',
    icon: 'lucide:receipt-text',
    key: 'pay-order',
    label: '支付订单',
    load: () => payOrderService.list(createCountQuery()),
    state: 'loading',
    tone: 'gold',
  },
]);

const lastUpdatedLabel = computed(() => {
  if (!lastUpdatedAt.value) {
    return '正在加载实时数据';
  }

  return `更新于 ${lastUpdatedAt.value.toLocaleString('zh-CN', {
    hour12: false,
  })}`;
});

function createCountQuery() {
  return {
    pageIndex: 1,
    pageSize: 1,
    requireResultList: true,
    requireTotals: true,
  };
}

function formatTotal(total?: number) {
  return new Intl.NumberFormat('zh-CN').format(total || 0);
}

async function refreshOverview() {
  if (isRefreshing.value) {
    return;
  }

  isRefreshing.value = true;
  cards.value = cards.value.map((card) => ({
    ...card,
    state: 'loading',
  }));

  const responses = await Promise.allSettled(
    cards.value.map((card) => card.load()),
  );

  cards.value = cards.value.map((card, index) => {
    const response = responses[index];
    const total =
      response?.status === 'fulfilled'
        ? resolveOverviewTotal(response.value)
        : undefined;

    return total === undefined
      ? { ...card, state: 'unavailable' }
      : { ...card, state: 'ready', total };
  });
  lastUpdatedAt.value = new Date();
  isRefreshing.value = false;
}

onMounted(refreshOverview);
</script>

<template>
  <main class="overview-page">
    <section class="overview-shell" aria-labelledby="overview-title">
      <header class="overview-header">
        <div>
          <p class="overview-header__eyebrow">PLATFORM OVERVIEW</p>
          <h1 id="overview-title">平台数据概览</h1>
          <p class="overview-header__subtitle">
            聚合查看核心资源规模与支付业务数据
          </p>
        </div>

        <div class="overview-header__actions">
          <span class="overview-header__updated">{{ lastUpdatedLabel }}</span>
          <Button
            class="overview-header__refresh"
            :loading="isRefreshing"
            type="default"
            @click="refreshOverview"
          >
            <IconifyIcon class="size-4" icon="lucide:refresh-cw" />
            刷新数据
          </Button>
        </div>
      </header>

      <section aria-label="平台资源统计" class="overview-grid">
        <article
          v-for="card in cards"
          :key="card.key"
          :aria-busy="card.state === 'loading'"
          :class="`overview-card--${card.tone}`"
          class="overview-card"
        >
          <div class="overview-card__topline">
            <span class="overview-card__icon">
              <IconifyIcon :icon="card.icon" />
            </span>
            <span class="overview-card__label">{{ card.label }}</span>
          </div>

          <div class="overview-card__metric">
            <span v-if="card.state === 'ready'">
              {{ formatTotal(card.total) }}
            </span>
            <span
              v-else-if="card.state === 'loading'"
              class="overview-card__skeleton"
            ></span>
            <span v-else class="overview-card__unavailable">暂无权限</span>
          </div>

          <div class="overview-card__footer">
            <span>{{ card.description }}</span>
            <span v-if="card.state === 'ready'" class="overview-card__status">
              实时统计
            </span>
          </div>
        </article>
      </section>
    </section>
  </main>
</template>

<style scoped>
.overview-page {
  min-height: 100%;
  background: #f5f7fb;
  padding: 24px;
}

.overview-shell {
  margin: 0 auto;
  max-width: 1560px;
}

.overview-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin: 4px 0 22px;
}

.overview-header__eyebrow {
  margin: 0 0 6px;
  color: #8791a8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.overview-header h1 {
  margin: 0;
  color: #20263a;
  font-size: clamp(25px, 2.2vw, 32px);
  font-weight: 750;
  letter-spacing: -0.04em;
  line-height: 1.2;
}

.overview-header__subtitle {
  margin: 8px 0 0;
  color: #7e879b;
  font-size: 14px;
}

.overview-header__actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.overview-header__updated {
  color: #8d96a8;
  font-size: 12px;
  white-space: nowrap;
}

.overview-header__refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  border-color: #dfe4ee;
  border-radius: 10px;
  color: #536079;
  font-weight: 600;
  box-shadow: none;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 16px;
}

.overview-card {
  position: relative;
  isolation: isolate;
  display: flex;
  min-height: 205px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e2e7f0;
  border-radius: 16px;
  background: #fff;
  padding: 22px;
  box-shadow: 0 8px 24px rgb(49 66 101 / 4%);
}

.overview-card::after {
  position: absolute;
  z-index: -1;
  right: -32px;
  bottom: -66px;
  width: 170px;
  height: 145px;
  border-radius: 52px 52px 0 0;
  background: var(--overview-accent);
  content: '';
  opacity: 0.8;
  transform: rotate(-12deg);
}

.overview-card__topline {
  display: flex;
  align-items: center;
  gap: 10px;
}

.overview-card__icon {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background: var(--overview-icon-background);
  color: var(--overview-icon-color);
  font-size: 19px;
  box-shadow: 0 5px 12px var(--overview-icon-shadow);
}

.overview-card__label {
  color: #4c566c;
  font-size: 14px;
  font-weight: 700;
}

.overview-card__metric {
  display: flex;
  min-height: 57px;
  align-items: center;
  margin-top: 20px;
  color: #20263a;
  font-size: clamp(34px, 3vw, 44px);
  font-variant-numeric: tabular-nums;
  font-weight: 760;
  letter-spacing: -0.055em;
  line-height: 1;
}

.overview-card__skeleton {
  display: block;
  width: 42%;
  height: 37px;
  border-radius: 8px;
  background: linear-gradient(90deg, #edf0f6 20%, #f7f8fb 50%, #edf0f6 80%);
  background-size: 200% 100%;
  animation: overview-loading 1.25s ease-in-out infinite;
}

.overview-card__unavailable {
  color: #8b94a7;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.overview-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
  color: #8b94a7;
  font-size: 12px;
}

.overview-card__status {
  color: var(--overview-icon-color);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.overview-card--coral {
  --overview-accent: #fff0ef;
  --overview-icon-background: #ff6258;
  --overview-icon-color: #ff6258;
  --overview-icon-shadow: rgb(255 98 88 / 22%);
}

.overview-card--coral .overview-card__icon,
.overview-card--sky .overview-card__icon,
.overview-card--violet .overview-card__icon {
  color: #fff;
}

.overview-card--sky {
  --overview-accent: #ebf3ff;
  --overview-icon-background: #4b90fb;
  --overview-icon-color: #4b90fb;
  --overview-icon-shadow: rgb(75 144 251 / 22%);
}

.overview-card--violet {
  --overview-accent: #f4edff;
  --overview-icon-background: #9055e9;
  --overview-icon-color: #9055e9;
  --overview-icon-shadow: rgb(144 85 233 / 22%);
}

.overview-card--rose {
  --overview-accent: #fff0f6;
  --overview-icon-background: #fff0f6;
  --overview-icon-color: #f04c8b;
  --overview-icon-shadow: rgb(240 76 139 / 10%);
}

.overview-card--mint {
  --overview-accent: #ebfaf2;
  --overview-icon-background: #ebfaf2;
  --overview-icon-color: #16a56a;
  --overview-icon-shadow: rgb(22 165 106 / 10%);
}

.overview-card--gold {
  --overview-accent: #fff8e8;
  --overview-icon-background: #fff3d7;
  --overview-icon-color: #d88a00;
  --overview-icon-shadow: rgb(216 138 0 / 10%);
}

@keyframes overview-loading {
  from {
    background-position: 200% 0;
  }

  to {
    background-position: -200% 0;
  }
}

@media (min-width: 720px) {
  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1180px) {
  .overview-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 719px) {
  .overview-page {
    padding: 18px;
  }

  .overview-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .overview-header__actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
