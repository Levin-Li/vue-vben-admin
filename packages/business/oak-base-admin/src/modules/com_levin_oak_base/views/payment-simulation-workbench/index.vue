<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { Page } from '@vben/common-ui';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  message,
} from 'ant-design-vue';

import { paymentSimulationWorkbenchService } from '../../api/payment-simulation-workbench-service';

type ProviderCode = 'BitPay' | 'CoinPayments' | 'NowPayments';

interface NotificationRecord {
  createdAt?: string;
  id?: string;
  payStatus?: string;
  payTradeNo?: string;
  tradeType?: string;
}

interface WorkbenchSnapshot {
  available?: boolean;
  channels?: Array<Record<string, any>>;
  cryptoPayOrder?: Record<string, any> | null;
  events?: any[];
  message?: string;
  notificationCount?: number;
  notificationRecords?: NotificationRecord[];
  payOrder?: Record<string, any> | null;
  profile?: string;
  providerCode?: string;
  providerPaymentId?: string;
  previousSnapshot?: WorkbenchSnapshot | null;
  reason?: string;
  settlementEventCount?: number;
  snapshotChanged?: boolean;
  supportedProviders?: string[];
  payChannelId?: string;
  providerEvent?: Record<string, any> | null;
}

const workbenchLoading = ref(true);
const actionLoading = ref(false);
const workbenchState = ref<WorkbenchSnapshot>({});
const latestSnapshot = ref<WorkbenchSnapshot | null>(null);
const formState = reactive({
  amount: '12.34000000',
  merchantOrderNo: '',
  providerCode: 'NowPayments' as ProviderCode,
});
const { hasPermission } = useRbacAccess();
const createPermission = buildApiMethodPermissions(
  paymentSimulationWorkbenchService,
  'createOrder',
);
const confirmPermission = buildApiMethodPermissions(
  paymentSimulationWorkbenchService,
  'advanceConfirmation',
);
const queryPermission = buildApiMethodPermissions(
  paymentSimulationWorkbenchService,
  'query',
);
const expirePermission = buildApiMethodPermissions(
  paymentSimulationWorkbenchService,
  'expire',
);
const callbackPermission = buildApiMethodPermissions(
  paymentSimulationWorkbenchService,
  'callback',
);

const providerOptions = computed(() => {
  const values =
    workbenchState.value.supportedProviders?.length
      ? workbenchState.value.supportedProviders
      : ['NowPayments', 'CoinPayments', 'BitPay'];

  return values.map((value) => ({
    label: value,
    value,
  }));
});

const currentPayOrderId = computed(
  () => latestSnapshot.value?.payOrder?.id || latestSnapshot.value?.payOrder?.payOrderId,
);
const currentProviderPaymentId = computed(
  () =>
    latestSnapshot.value?.providerPaymentId ||
    latestSnapshot.value?.cryptoPayOrder?.providerPaymentId,
);
const currentChannelId = computed(
  () => latestSnapshot.value?.payChannelId || latestSnapshot.value?.payOrder?.payChannelId,
);
const currentConfirmationCount = computed(
  () => Number(latestSnapshot.value?.cryptoPayOrder?.confirmationCount || 0),
);
const currentRequiredConfirmationCount = computed(
  () => Number(latestSnapshot.value?.cryptoPayOrder?.requiredConfirmationCount || 2),
);
const currentSettlementNetwork = computed(
  () =>
    String(
      latestSnapshot.value?.cryptoPayOrder?.network ||
        latestSnapshot.value?.providerEvent?.settlementNetwork ||
        'TRON',
    ),
);
const currentStatusText = computed(
  () =>
    latestSnapshot.value?.payOrder?.payStatus ||
    latestSnapshot.value?.cryptoPayOrder?.status ||
    '未创建测试订单',
);
const currentMessage = computed(
  () =>
    latestSnapshot.value?.message ||
    workbenchState.value.reason ||
    '当前环境未启用本机支付模拟器，本页不会暴露任何模拟动作或真实资金入口。',
);
const previousSnapshotSummary = computed(() => latestSnapshot.value?.previousSnapshot || null);
const canOperate = computed(
  () =>
    workbenchState.value.available === true &&
    Boolean(currentPayOrderId.value || currentProviderPaymentId.value),
);
const latestMutationLabel = computed(() => {
  if (!latestSnapshot.value?.previousSnapshot) {
    return '首个动作快照';
  }
  return latestSnapshot.value.snapshotChanged ? '本次动作已改写状态' : '本次动作未改写状态';
});
const notificationAuditText = computed(() => {
  const count = latestSnapshot.value?.notificationCount ?? 0;
  return count > 0 ? `已记录 ${count} 条通知审计` : '尚未记录通知审计';
});

function normalizeResponsePayload(result: any): WorkbenchSnapshot {
  const payload = result?.data ?? result ?? {};
  if (payload?.snapshot && typeof payload.snapshot === 'object') {
    return {
      ...payload.snapshot,
      message: payload.message || payload.snapshot.message,
      previousSnapshot: payload.previousSnapshot || null,
      snapshotChanged: payload.snapshotChanged,
    };
  }
  return payload;
}

function applySnapshot(snapshot: WorkbenchSnapshot) {
  workbenchState.value = {
    ...workbenchState.value,
    ...snapshot,
  };
  latestSnapshot.value = {
    ...latestSnapshot.value,
    ...snapshot,
  };

  if (!formState.merchantOrderNo && currentPayOrderId.value) {
    formState.merchantOrderNo = String(currentPayOrderId.value);
  }
}

async function loadWorkbenchStatus() {
  workbenchLoading.value = true;
  try {
    const snapshot = normalizeResponsePayload(
      await paymentSimulationWorkbenchService.status(),
    );
    applySnapshot(snapshot);
  } catch (error) {
    workbenchState.value = {
      available: false,
      message:
        error instanceof Error ? error.message : '工作台状态探测失败',
      reason: '当前环境未启用支付模拟器',
    };
  } finally {
    workbenchLoading.value = false;
  }
}

async function runAction(action: () => Promise<any>, successText: string) {
  actionLoading.value = true;
  try {
    const snapshot = normalizeResponsePayload(await action());
    applySnapshot(snapshot);
    message.success(successText);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '支付模拟操作失败');
  } finally {
    actionLoading.value = false;
  }
}

async function handleCreateOrder() {
  await runAction(
    () =>
      paymentSimulationWorkbenchService.createOrder({
        amount: formState.amount,
        merchantOrderNo: formState.merchantOrderNo || undefined,
        providerCode: formState.providerCode,
      }),
    '测试订单已创建',
  );
}

async function handleAdvanceConfirmation() {
  await runAction(
    () =>
      paymentSimulationWorkbenchService.advanceConfirmation({
        confirmationCount: currentConfirmationCount.value + 1,
        payOrderId: currentPayOrderId.value,
        providerCode: latestSnapshot.value?.providerCode || formState.providerCode,
        providerPaymentId: currentProviderPaymentId.value,
      }),
    '确认数已推进',
  );
}

async function handleQuery() {
  await runAction(
    () =>
      paymentSimulationWorkbenchService.query({
        payOrderId: currentPayOrderId.value,
        providerCode: latestSnapshot.value?.providerCode || formState.providerCode,
        providerPaymentId: currentProviderPaymentId.value,
      }),
    '状态已刷新',
  );
}

async function handleExpire() {
  await runAction(
    () => paymentSimulationWorkbenchService.expire({ payOrderId: currentPayOrderId.value }),
    '测试订单已过期',
  );
}

async function handleCallback(invalidSignature = false, replay = false) {
  await runAction(
    () =>
      paymentSimulationWorkbenchService.callback({
        invalidSignature,
        payOrderId: currentPayOrderId.value,
        replay,
      }),
    invalidSignature ? '已发送无效签名回调' : replay ? '已重放模拟回调' : '已发送有效回调',
  );
}

onMounted(loadWorkbenchStatus);
</script>

<template>
  <Page content-class="!bg-card !m-4 !p-4 min-w-0 !overflow-hidden rounded-lg">
    <div class="payment-simulation-workbench">
      <Alert
        message="支付模拟工作台"
        description="这是正式管理端的模拟支付功能页，只驱动本机模拟器，不会调用真实供应商、真实钱包或真实资金。当前环境未启用模拟器时只显示不可用状态。"
        show-icon
        type="info"
      />

      <Spin :spinning="workbenchLoading || actionLoading">
        <Alert
          v-if="workbenchState.available !== true"
          :description="currentMessage"
          message="当前环境未启用支付模拟器"
          show-icon
          type="warning"
        />

        <template v-else>
          <Card size="small" title="测试工作台状态">
            <Space wrap>
              <Tag color="success">测试入口已启用</Tag>
              <Tag>{{ workbenchState.profile || 'test' }}</Tag>
              <Tag>当前状态：{{ currentStatusText }}</Tag>
              <Tag>结算事件：{{ latestSnapshot?.settlementEventCount ?? 0 }}</Tag>
              <Tag>通知审计：{{ latestSnapshot?.notificationCount ?? 0 }}</Tag>
              <Tag :color="latestSnapshot?.snapshotChanged ? 'processing' : 'default'">
                {{ latestMutationLabel }}
              </Tag>
            </Space>

            <Descriptions
              :column="2"
              bordered
              class="payment-simulation-workbench__descriptions"
              size="small"
            >
              <Descriptions.Item label="当前通道">
                {{ currentChannelId || '-' }}
              </Descriptions.Item>
              <Descriptions.Item label="供应商支付单号">
                {{ currentProviderPaymentId || '-' }}
              </Descriptions.Item>
              <Descriptions.Item label="固定结算网络">
                {{ currentSettlementNetwork }}
              </Descriptions.Item>
              <Descriptions.Item label="所需确认数">
                {{ currentRequiredConfirmationCount }}
              </Descriptions.Item>
              <Descriptions.Item label="说明" :span="2">
                {{ currentMessage }}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" title="创建与推进">
            <Form class="payment-simulation-workbench__form">
              <Form.Item label="供应商">
                <Select
                  v-model:value="formState.providerCode"
                  :options="providerOptions"
                />
              </Form.Item>
              <Form.Item label="金额">
                <Input v-model:value="formState.amount" />
              </Form.Item>
              <Form.Item label="商户单号">
                <Input
                  v-model:value="formState.merchantOrderNo"
                  placeholder="可留空，由后端生成"
                />
              </Form.Item>
              <Form.Item label="固定网络">
                <Input :value="currentSettlementNetwork" readonly />
              </Form.Item>
              <Form.Item label="固定确认数">
                <Input :value="String(currentRequiredConfirmationCount)" readonly />
              </Form.Item>
              <Form.Item label="当前 providerPaymentId">
                <Input :value="String(currentProviderPaymentId || '')" readonly />
              </Form.Item>
            </Form>

            <Space wrap>
              <Button
                v-if="hasPermission(createPermission)"
                type="primary"
                @click="handleCreateOrder"
              >
                创建测试订单
              </Button>
              <Button
                v-if="hasPermission(confirmPermission)"
                :disabled="!canOperate"
                @click="handleAdvanceConfirmation"
              >
                推进 1 次确认
              </Button>
              <Button
                v-if="hasPermission(queryPermission)"
                :disabled="!canOperate"
                @click="handleQuery"
              >
                查询当前状态
              </Button>
              <Button
                v-if="hasPermission(expirePermission)"
                :disabled="!canOperate"
                @click="handleExpire"
              >
                模拟过期
              </Button>
              <Button
                v-if="hasPermission(callbackPermission)"
                :disabled="!canOperate"
                @click="handleCallback()"
              >
                发送有效回调
              </Button>
              <Button
                v-if="hasPermission(callbackPermission)"
                :disabled="!canOperate"
                @click="handleCallback(true)"
              >
                发送无效回调
              </Button>
              <Button
                v-if="hasPermission(callbackPermission)"
                :disabled="!canOperate"
                @click="handleCallback(false, true)"
              >
                重放回调
              </Button>
            </Space>
          </Card>

          <div class="payment-simulation-workbench__panels">
            <Card size="small" title="主支付订单">
              <pre v-if="latestSnapshot?.payOrder" class="payment-simulation-workbench__json">{{
                JSON.stringify(latestSnapshot.payOrder, null, 2)
              }}</pre>
              <Empty v-else description="尚未创建测试支付订单" />
            </Card>

            <Card size="small" title="数字货币附属订单">
              <pre
                v-if="latestSnapshot?.cryptoPayOrder"
                class="payment-simulation-workbench__json"
              >{{ JSON.stringify(latestSnapshot.cryptoPayOrder, null, 2) }}</pre>
              <Empty v-else description="尚未返回附属订单快照" />
            </Card>

            <Card size="small" title="供应商当前事件">
              <pre
                v-if="latestSnapshot?.providerEvent"
                class="payment-simulation-workbench__json"
              >{{ JSON.stringify(latestSnapshot.providerEvent, null, 2) }}</pre>
              <Empty v-else description="当前没有供应商事件" />
            </Card>

            <Card size="small" title="已落库结算事件">
              <pre
                v-if="latestSnapshot?.events?.length"
                class="payment-simulation-workbench__json"
              >{{ JSON.stringify(latestSnapshot.events, null, 2) }}</pre>
              <Empty v-else description="当前没有结算事件" />
            </Card>

            <Card size="small" title="通知审计">
              <pre
                v-if="latestSnapshot?.notificationRecords?.length"
                class="payment-simulation-workbench__json"
              >{{ JSON.stringify(latestSnapshot.notificationRecords, null, 2) }}</pre>
              <Empty v-else :description="notificationAuditText" />
            </Card>

            <Card size="small" title="前后状态对比">
              <div class="payment-simulation-workbench__compare">
                <div>
                  <div class="payment-simulation-workbench__compare-title">动作前</div>
                  <pre
                    v-if="previousSnapshotSummary"
                    class="payment-simulation-workbench__json"
                  >{{ JSON.stringify(previousSnapshotSummary, null, 2) }}</pre>
                  <Empty v-else description="当前没有上一份快照" />
                </div>

                <div>
                  <div class="payment-simulation-workbench__compare-title">动作后</div>
                  <pre
                    v-if="latestSnapshot"
                    class="payment-simulation-workbench__json"
                  >{{ JSON.stringify(latestSnapshot, null, 2) }}</pre>
                  <Empty v-else description="当前没有最新快照" />
                </div>
              </div>
            </Card>
          </div>
        </template>
      </Spin>
    </div>
  </Page>
</template>

<style scoped>
.payment-simulation-workbench {
  display: grid;
  gap: 12px;
}

.payment-simulation-workbench__form {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  margin-bottom: 12px;
}

.payment-simulation-workbench__descriptions {
  margin-top: 12px;
}

.payment-simulation-workbench__panels {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.payment-simulation-workbench__compare {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.payment-simulation-workbench__compare-title {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  margin-bottom: 8px;
}

.payment-simulation-workbench__json {
  margin: 0;
  max-height: 320px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
