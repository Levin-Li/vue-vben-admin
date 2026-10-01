<script lang="ts" setup>
import type {
  WorkflowBusinessReference,
  WorkflowEligibility,
  WorkflowInstanceView,
  WorkflowRoundState,
} from './types';

import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';

// 公共包显式导入自身使用的组件，不依赖宿主全局注册或源码自动扫描。
import {
  Alert as AAlert,
  Button as AButton,
  Card as ACard,
  Divider as ADivider,
  Empty as AEmpty,
  List as AList,
  ListItem as AListItem,
  ListItemMeta as AListItemMeta,
  Space as ASpace,
  Spin as ASpin,
  Tag as ATag,
} from 'ant-design-vue';

import { WorkflowRuntimeService } from './workflow-runtime-service';
import { workflowStatusLabel } from './workflow-task-form';

// 宿主传入当前业务引用；身份、轮次与匹配结果始终由后端决定。
const props = defineProps<{
  businessReference: WorkflowBusinessReference;
  canNewRound?: boolean;
  canResubmit?: boolean;
  canRetry?: boolean;
  /** 宿主明确声明的能力契约；缺省时不开放轮次命令。 */
  contractVersion?: string;
  service?: WorkflowRuntimeService;
}>();
const emit = defineEmits<{
  error: [error: unknown];
  retried: [instanceId: string];
  roundChanged: [roundId: string];
  started: [instance: WorkflowInstanceView];
}>();
const defaultService = new WorkflowRuntimeService();
const service = computed(() => props.service ?? defaultService);
const eligibility = ref<WorkflowEligibility[]>([]);
const history = ref<WorkflowInstanceView[]>([]);
const loading = ref(false);
const starting = ref<string>();
const loadError = ref(false);
const startError = ref(false);
const retrying = ref<string>();
const retryError = ref(false);
const roundState = ref<WorkflowRoundState>();
const confirming = ref<'newRound' | 'resubmit'>();
const selectedAttempt = ref<WorkflowInstanceView>();
const roundBusy = ref(false);
const roundPreparing = ref(false);
const roundError = ref(false);
const roundBlockReason = ref('');
type RoundCommand =
  | {
      action: 'newRound';
      data: Parameters<WorkflowRuntimeService['newRound']>[0];
    }
  | {
      action: 'resubmit';
      data: Parameters<WorkflowRuntimeService['resubmit']>[0];
    };
const preparedCommand = ref<RoundCommand>();
// 失败或取消后保留完整命令，重开确认不能把技术重放变为新业务尝试。
const roundCommands = reactive(new Map<string, RoundCommand>());
const roundInteraction = computed(
  () => roundBusy.value || roundPreparing.value || !!confirming.value,
);
const requestKeys = new Map<string, string>();
let requestVersion = 0;
let referenceVersion = 0;
let roundVersion = 0;

async function refresh() {
  if (roundInteraction.value) return;
  // 防止切换业务对象后的迟到响应覆盖当前对象，也不把失败当成空列表。
  const version = ++requestVersion;
  loading.value = true;
  loadError.value = false;
  const reference = { ...props.businessReference };
  try {
    const results = await Promise.all([
      service.value.eligibility(reference),
      service.value.history(reference),
      props.contractVersion && (props.canNewRound || props.canResubmit)
        ? service.value.roundState({
            ...reference,
            contractVersion: props.contractVersion,
          })
        : Promise.resolve(undefined),
    ]);
    if (version !== requestVersion) return;
    [eligibility.value, history.value, roundState.value] = results;
  } catch (error) {
    if (version !== requestVersion) return;
    // 刷新可能因权限或对象范围变化失败，旧历史不能继续留在当前授权页面。
    loadError.value = true;
    eligibility.value = [];
    history.value = [];
    roundState.value = undefined;
    emit('error', error);
  } finally {
    if (version === requestVersion) loading.value = false;
  }
}

async function start(item: WorkflowEligibility) {
  if (
    !item.eligible ||
    item.startMode === 'event' ||
    roundInteraction.value ||
    starting.value ||
    retrying.value ||
    loading.value ||
    loadError.value
  )
    return;
  starting.value = item.purposeKey;
  startError.value = false;
  const reference = { ...props.businessReference };
  const version = referenceVersion;
  const key = JSON.stringify([
    reference.tenantId,
    reference.orgId,
    reference.businessType,
    reference.businessId,
    item.purposeKey,
  ]);
  // 网络失败保留同一幂等键，只有明确成功后下一次命令才使用新键。
  const idempotencyKey = requestKeys.get(key) ?? crypto.randomUUID();
  requestKeys.set(key, idempotencyKey);
  try {
    const instance = await service.value.start({
      ...reference,
      purposeKey: item.purposeKey,
      idempotencyKey,
    });
    requestKeys.delete(key);
    if (version !== referenceVersion) return;
    emit('started', instance);
    await refresh();
  } catch (error) {
    if (version !== referenceVersion) return;
    startError.value = true;
    emit('error', error);
  } finally {
    if (version === referenceVersion) starting.value = undefined;
  }
}

function resubmittableAttempt(
  item: WorkflowInstanceView,
  state = roundState.value,
) {
  // 未确认响应的原请求可以技术重放；服务端会先重验访问权限再返回原结果。
  if (props.canResubmit && roundCommands.has(roundCommandKey('resubmit', item)))
    return true;
  return (
    props.canResubmit &&
    !!props.contractVersion &&
    !!item.runId &&
    !!item.purposeKey &&
    item.roundId === state?.currentRoundId &&
    item.effectStatus === 'Applied' &&
    item.executionStatus === 'Completed' &&
    state?.resubmittableRunIds?.includes(item.runId) &&
    !!item.outcome &&
    ['Rejected', 'Terminated', 'Withdrawn'].includes(item.outcome)
  );
}

function roundCommandKey(
  action: 'newRound' | 'resubmit',
  item?: WorkflowInstanceView,
) {
  return JSON.stringify([
    props.businessReference.tenantId,
    props.businessReference.orgId,
    props.businessReference.businessType,
    props.businessReference.businessId,
    props.contractVersion,
    action,
    item?.runId,
  ]);
}

function cancelRoundAction() {
  if (roundBusy.value) return;
  // 取消也废弃尚未完成的准备查询，迟到结果不能重新打开确认区。
  roundVersion++;
  roundPreparing.value = false;
  confirming.value = undefined;
  selectedAttempt.value = undefined;
  preparedCommand.value = undefined;
  roundBlockReason.value = '';
  roundError.value = false;
}

async function prepareRoundAction(
  action: 'newRound' | 'resubmit',
  item?: WorkflowInstanceView,
) {
  // 契约来自宿主；独立权限、服务端来源许可和当前请求世代共同约束入口。
  const contractVersion = props.contractVersion;
  if (
    !contractVersion ||
    roundInteraction.value ||
    loading.value ||
    loadError.value ||
    starting.value ||
    retrying.value
  )
    return;
  if (
    action === 'newRound'
      ? !props.canNewRound
      : !item || !resubmittableAttempt(item)
  )
    return;
  roundError.value = false;
  roundBlockReason.value = '';
  confirming.value = action;
  selectedAttempt.value = item;
  const commandKey = roundCommandKey(action, item);
  const previous = roundCommands.get(commandKey);
  if (previous) {
    preparedCommand.value = previous;
    return;
  }
  roundPreparing.value = true;
  const version = ++roundVersion;
  const reference = { ...props.businessReference };
  try {
    const state = await service.value.roundState({
      ...reference,
      contractVersion,
    });
    if (version !== roundVersion) return;
    roundState.value = state;
    if (
      state.contractVersion !== contractVersion ||
      !state.currentRoundId ||
      (action === 'newRound' && state.active) ||
      (action === 'resubmit' && (!item || !resubmittableAttempt(item, state)))
    ) {
      roundBlockReason.value =
        state.reasons?.join('；') ||
        '当前轮次或办理记录已变化，请取消后刷新流程信息。';
      return;
    }
    const data = {
      ...reference,
      contractVersion,
      expectedRevision: state.revision,
      expectedRoundId: state.currentRoundId,
      idempotencyKey: crypto.randomUUID(),
    };
    const command: RoundCommand =
      action === 'newRound'
        ? { action, data }
        : {
            action,
            data: {
              ...data,
              purposeKey: item!.purposeKey!,
              sourceRunId: item!.runId!,
            },
          };
    preparedCommand.value = command;
  } catch (error) {
    if (version !== roundVersion) return;
    roundError.value = true;
    emit('error', error);
  } finally {
    if (version === roundVersion) roundPreparing.value = false;
  }
}

async function confirmRoundAction() {
  // 二次确认与实际命令使用同一份刚读取的真实轮次/修订；服务端仍会在写入时重新加锁校验。
  const action = confirming.value;
  const command = preparedCommand.value;
  const attempt = selectedAttempt.value;
  if (
    !action ||
    !command ||
    roundBusy.value ||
    roundPreparing.value ||
    roundBlockReason.value ||
    (action === 'newRound' ? !props.canNewRound : !props.canResubmit)
  )
    return;
  roundBusy.value = true;
  roundError.value = false;
  const version = roundVersion;
  const commandKey = roundCommandKey(action, attempt);
  roundCommands.set(commandKey, command);
  try {
    if (command.action === 'newRound') {
      const roundId = await service.value.newRound(command.data);
      if (version !== roundVersion) return;
      emit('roundChanged', roundId);
    } else {
      const instance = await service.value.resubmit(command.data);
      if (version !== roundVersion) return;
      emit('started', instance);
    }
    if (version !== roundVersion) return;
    roundCommands.delete(commandKey);
    roundBusy.value = false;
    confirming.value = undefined;
    selectedAttempt.value = undefined;
    preparedCommand.value = undefined;
    await refresh();
  } catch (error) {
    if (version !== roundVersion) return;
    roundError.value = true;
    emit('error', error);
  } finally {
    if (version === roundVersion) roundBusy.value = false;
  }
}

async function retry(item: WorkflowInstanceView) {
  // 权限和服务端返回的可重试交付标识缺一不可，点击时再次检查。
  if (
    !props.canRetry ||
    roundInteraction.value ||
    !item.pendingDispatchId ||
    retrying.value ||
    starting.value ||
    loading.value ||
    loadError.value
  )
    return;
  retrying.value = item.pendingDispatchId;
  retryError.value = false;
  const reference = { ...props.businessReference };
  const version = referenceVersion;
  try {
    await service.value.retry({
      ...reference,
      dispatchId: item.pendingDispatchId,
    });
    if (version !== referenceVersion) return;
    emit('retried', item.instanceId);
    await refresh();
  } catch (error) {
    if (version !== referenceVersion) return;
    retryError.value = true;
    emit('error', error);
  } finally {
    if (version === referenceVersion) retrying.value = undefined;
  }
}

// 引用改变立即清空旧对象可见数据，加载当前对象的资格与历史。
watch(
  () => [
    props.businessReference.tenantId,
    props.businessReference.orgId,
    props.businessReference.businessType,
    props.businessReference.businessId,
    props.contractVersion,
    props.service,
  ],
  () => {
    // 作用域切换创建新的请求世代；旧成功、失败及finally均不能影响当前对象。
    referenceVersion++;
    roundVersion++;
    roundPreparing.value = false;
    roundBusy.value = false;
    roundState.value = undefined;
    preparedCommand.value = undefined;
    roundBlockReason.value = '';
    eligibility.value = [];
    history.value = [];
    startError.value = false;
    retryError.value = false;
    roundError.value = false;
    confirming.value = undefined;
    selectedAttempt.value = undefined;
    starting.value = undefined;
    retrying.value = undefined;
    void refresh();
  },
  { immediate: true, flush: 'sync' },
);

// 权限变更立即撤销未提交确认；已发送命令的服务端鉴权仍是最终安全边界。
watch(
  () => [props.canNewRound, props.canResubmit],
  () => {
    if (
      confirming.value === 'newRound'
        ? !props.canNewRound
        : confirming.value === 'resubmit' && !props.canResubmit
    )
      cancelRoundAction();
  },
);

// 宿主切换页面后不再发出旧命令事件或追加查询。
onBeforeUnmount(() => {
  referenceVersion++;
  requestVersion++;
  roundVersion++;
});
defineExpose({ refresh });
</script>

<template>
  <ACard title="业务流程" size="small" class="levin-workflow-business-panel">
    <template #extra>
      <AButton
        :loading="loading"
        :disabled="!!starting || !!retrying || roundInteraction"
        @click="refresh"
      >
        刷新
      </AButton>
    </template>
    <!-- 资格及阻断原因均来自服务端，不用客户端业务字段推断可发起状态。 -->
    <AAlert
      v-if="loadError"
      class="mb-3"
      type="error"
      message="流程信息加载失败，请重试。"
    />
    <AAlert
      v-if="startError"
      class="mb-3"
      type="error"
      message="发起未成功，请根据错误提示修正后重试；重试将复用本次请求标识。"
    />
    <AAlert
      v-if="roundError"
      class="mb-3"
      type="error"
      message="轮次操作未成功。可再次确认以重试原请求；重试保留原轮次、修订和请求标识。"
    />
    <ASpin :spinning="loading">
      <AAlert
        v-if="retryError"
        class="mb-3"
        type="error"
        message="业务处理重试未成功，请根据错误提示处理后重试。"
      />
      <AList :data-source="eligibility">
        <template #renderItem="{ item }">
          <AListItem>
            <AListItemMeta
              :title="item.purposeName || item.purposeKey"
              :description="
                item.reasons?.join('；') ||
                (item.eligible ? '当前满足发起条件' : '当前不满足发起条件')
              "
            />
            <AButton
              type="primary"
              :loading="starting === item.purposeKey"
              :disabled="
                !item.eligible ||
                item.startMode === 'event' ||
                !!starting ||
                !!retrying ||
                loading ||
                loadError ||
                roundInteraction
              "
              @click="start(item)"
            >
              {{ item.startMode === 'event' ? '由事件触发' : '发起流程' }}
            </AButton>
          </AListItem>
        </template>
      </AList>
      <AEmpty
        v-if="eligibility.length === 0 && !loading && !loadError"
        description="暂无可查看的流程用途，请确认已发布对应业务流程。"
      />

      <!-- 三个状态维度分开显示，业务处理失败不能显示为已成功。 -->
      <ADivider orientation="left">办理历史</ADivider>
      <AAlert
        v-if="confirming"
        class="mb-3"
        type="warning"
        :message="
          confirming === 'newRound'
            ? '确认开启新办理轮次？旧轮次历史保留，原前置结果不再适用于新轮次。'
            : '确认按当前发布定义重新提交该失败尝试？将重新校验业务条件和前置依赖。'
        "
      >
        <template #action>
          <ASpace>
            <AButton :disabled="roundBusy" @click="cancelRoundAction">
              取消
            </AButton>
            <AButton
              type="primary"
              :loading="roundBusy"
              :disabled="
                roundPreparing || !preparedCommand || !!roundBlockReason
              "
              @click="confirmRoundAction"
            >
              确认
            </AButton>
          </ASpace>
        </template>
      </AAlert>
      <AAlert
        v-if="roundPreparing"
        class="mb-3"
        type="info"
        message="正在核验当前业务修订和办理资格…"
      />
      <AAlert
        v-if="roundBlockReason"
        class="mb-3"
        type="warning"
        :message="roundBlockReason"
      />
      <AAlert
        v-if="roundState?.reasons?.length && !confirming"
        class="mb-3"
        type="info"
        :message="roundState.reasons.join('；')"
      />
      <AButton
        v-if="contractVersion && canNewRound"
        class="mb-3"
        :disabled="
          loading || loadError || !!starting || !!retrying || roundInteraction
        "
        @click="prepareRoundAction('newRound')"
      >
        开启新办理轮次
      </AButton>
      <AList :data-source="history">
        <template #renderItem="{ item }">
          <AListItem>
            <AListItemMeta
              :title="item.businessTitle || item.purposeKey || item.instanceId"
            >
              <template #description>
                <div>{{ item.purposeKey }} · {{ item.instanceId }}</div>
                <div v-if="item.roundId">
                  办理轮次 {{ item.roundId }} · 第 {{ item.attemptNo || 1 }} 次
                </div>
                <div v-if="item.lastError" class="text-destructive">
                  {{ item.lastError }}
                </div>
              </template>
            </AListItemMeta>
            <ASpace wrap>
              <ATag>
                执行：{{
                  workflowStatusLabel(item.executionStatus || item.status)
                }}
              </ATag>
              <AButton
                v-if="canRetry && item.pendingDispatchId"
                :loading="retrying === item.pendingDispatchId"
                :disabled="
                  !!retrying ||
                  !!starting ||
                  loading ||
                  loadError ||
                  roundInteraction
                "
                @click="retry(item)"
              >
                重试业务处理
              </AButton>
              <AButton
                v-if="resubmittableAttempt(item)"
                :disabled="
                  loading ||
                  loadError ||
                  !!starting ||
                  !!retrying ||
                  roundInteraction
                "
                @click="prepareRoundAction('resubmit', item)"
              >
                {{
                  roundCommands.has(roundCommandKey('resubmit', item))
                    ? '重试原提交'
                    : '重新提交'
                }}
              </AButton>
              <ATag v-if="item.outcome">
                结果：{{ workflowStatusLabel(item.outcome) }}
              </ATag>
              <ATag
                v-if="item.effectStatus"
                :color="item.effectStatus === 'Failed' ? 'error' : undefined"
              >
                业务处理：{{ workflowStatusLabel(item.effectStatus) }}
              </ATag>
            </ASpace>
          </AListItem>
        </template>
      </AList>
      <AEmpty
        v-if="history.length === 0 && !loading && !loadError"
        description="暂无办理历史"
      />
    </ASpin>
  </ACard>
</template>
