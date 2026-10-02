<script lang="ts" setup>
import type { Component } from 'vue';

import type {
  WorkflowActionInput,
  WorkflowAttachmentMeta,
  WorkflowFormItem,
  WorkflowTaskAction,
  WorkflowTaskSubmitPayload,
  WorkflowTaskView,
  WorkflowVerificationChallenge,
} from './types';

import { computed, reactive, ref, watch } from 'vue';

import {
  BehaviorCaptcha,
  normalizeBehaviorCaptchaChallenge,
} from '@levin/admin-framework';
import { workflowVerificationLabel } from '@levin/bpm-designer';
// 审批表单、动作和轨迹在公共包内显式注册，独立宿主也能直接交互。
import {
  Alert as AAlert,
  Button as AButton,
  Card as ACard,
  Descriptions as ADescriptions,
  DescriptionsItem as ADescriptionsItem,
  Divider as ADivider,
  Empty as AEmpty,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputNumber as AInputNumber,
  List as AList,
  ListItem as AListItem,
  ListItemMeta as AListItemMeta,
  Select as ASelect,
  Space as ASpace,
  Tag as ATag,
  Textarea as ATextarea,
  Timeline as ATimeline,
  TimelineItem as ATimelineItem,
} from 'ant-design-vue';

import WorkflowBusinessDetail from './workflow-business-detail.vue';
import {
  isWorkflowEmpty,
  validateWorkflowAction,
  workflowActionUnavailable,
  workflowFormData,
  workflowStatusLabel,
} from './workflow-task-form';

// 任务及服务端动作是唯一授权来源，不补造默认“通过”动作。
const props = defineProps<{
  attachments?: WorkflowAttachmentMeta[];
  canDeletePendingAttachment?: boolean;
  canDownloadAttachment?: boolean;
  canUploadAttachment?: boolean;
  deletingAttachmentId?: string;
  detailComponents?: Record<string, Component>;
  downloadingAttachmentId?: string;
  submitting?: boolean;
  task: WorkflowTaskView;
  uploadingAttachment?: boolean;
  verificationChallenge?: WorkflowVerificationChallenge;
}>();
const emit = defineEmits<{
  action: [action: WorkflowTaskAction];
  deletePendingAttachment: [attachment: WorkflowAttachmentMeta];
  downloadAttachment: [attachment: WorkflowAttachmentMeta];
  prepareVerification: [
    payload: WorkflowActionInput & {
      action: WorkflowTaskAction;
      contextVersion: number;
      verificationType: string;
    },
  ];
  submit: [payload: WorkflowTaskSubmitPayload];
  uploadAttachment: [file: File];
  verificationInvalidated: [];
}>();
const formData = reactive<Record<string, unknown>>({});
const comment = ref('');
const targetNodeId = ref<string>();
const targetUserId = ref<string>();
const targetUserIds = ref<string[]>([]);
const addSignPosition = ref<string>();
const verificationCode = ref('');
const verificationType = ref<string>();
const contextVersion = ref(0);
const selectedAction = ref<WorkflowTaskAction>();
const errors = ref<string[]>([]);
const displayFormItems = computed<WorkflowFormItem[]>(
  () =>
    props.task.formItems ??
    props.task.requiredFields?.map((key) => ({
      key,
      label: key,
      required: true,
      type: 'text',
    })) ??
    [],
);
const actions = computed(() =>
  props.task.status === 'Todo'
    ? (props.task.actions ?? []).filter(
        (action) => !workflowActionUnavailable(action),
      )
    : [],
);
const unavailableActions = computed(() =>
  props.task.status === 'Todo'
    ? (props.task.actions ?? []).filter((action) =>
        workflowActionUnavailable(action),
      )
    : [],
);
const readOnly = computed(
  () =>
    props.task.status !== 'Todo' ||
    props.submitting ||
    props.uploadingAttachment,
);
const missingRequired = computed(() =>
  displayFormItems.value.some(
    (item) =>
      !item.readOnly && item.required && isWorkflowEmpty(formData[item.key]),
  ),
);

// 挑战只有在任务、类型和输入代际都匹配时才能进入当前办理表单。
const currentChallenge = computed(() => {
  const challenge = props.verificationChallenge;
  return challenge?.successful &&
    challenge.taskId === props.task.taskId &&
    challenge.contextVersion === contextVersion.value &&
    challenge.verificationType === verificationType.value
    ? challenge
    : undefined;
});
const captchaImage = computed(() => {
  if (verificationType.value !== 'Captcha') return undefined;
  const data = currentChallenge.value?.interactionData;
  return typeof data === 'string' &&
    /^[A-Z0-9+/]+={0,2}$/i.test(data) &&
    data.length <= 2_800_000
    ? `data:image/gif;base64,${data}`
    : undefined;
});
function safePuzzleImage(value: unknown, raw = false) {
  if (typeof value !== 'string' || value.length > 2_800_040) return false;
  // 公共题面会把裸 base64 规范化为 PNG；正式服务也可直接返回 JPEG/PNG data URI。
  if (raw && (value === '' || /^[A-Z0-9+/]+={0,2}$/i.test(value))) return true;
  return /^data:image\/(?:jpeg|png);base64,[A-Z0-9+/]+={0,2}$/i.test(value);
}
const behaviorChallenge = computed(() => {
  if (verificationType.value !== 'Hmi') return null;
  const data = currentChallenge.value?.interactionData;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const puzzle = (data as Record<string, unknown>).puzzle;
  if (!puzzle || typeof puzzle !== 'object' || Array.isArray(puzzle))
    return null;
  for (const key of [
    'image',
    'masterImage',
    'backgroundImage',
    'sceneImage',
    'thumb',
    'thumbImage',
  ]) {
    const value = (puzzle as Record<string, unknown>)[key];
    if (value !== undefined && !safePuzzleImage(value, true)) return null;
  }
  const challenge = normalizeBehaviorCaptchaChallenge(data);
  if (!challenge || !safePuzzleImage(challenge.payload.image)) return null;
  if (
    challenge.mode !== 'IDIOM_CLICK' &&
    challenge.mode !== 'OBSTACLE_AVOIDANCE' &&
    (!('thumb' in challenge.payload) ||
      !safePuzzleImage(challenge.payload.thumb))
  )
    return null;
  return challenge;
});
const challengeReady = computed(() => {
  if (!currentChallenge.value) return false;
  if (verificationType.value === 'Captcha') return Boolean(captchaImage.value);
  if (verificationType.value === 'Hmi') return Boolean(behaviorChallenge.value);
  return true;
});

// 换任务时清除上一对象输入和凭据；同任务失败后保留用户输入。
watch(
  () => props.task.taskId,
  () => {
    for (const key of Object.keys(formData)) delete formData[key];
    for (const field of displayFormItems.value)
      if (field.value !== undefined) formData[field.key] = field.value;
    comment.value = '';
    selectedAction.value = undefined;
    resetActionParameters();
    errors.value = [];
  },
  { immediate: true },
);

watch(
  () => props.attachments?.map((item) => item.id).join('|'),
  () => {
    // 文件集合进入动作摘要；上传新文件或切换任务后必须重新准备二次验证。
    invalidateVerification();
  },
);

function chooseAttachment(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || readOnly.value || !props.canUploadAttachment) return;
  if (
    file.size === 0 ||
    file.size > 5 * 1024 * 1024 ||
    (props.attachments?.filter((item) => !item.attached).length ?? 0) >= 5
  ) {
    errors.value = ['附件须非空、单件不超过5 MiB，且同一任务最多五件。'];
    return;
  }
  errors.value = [];
  emit('uploadAttachment', file);
}

// 验证挑战绑定表单、意见与动作参数，修改后不能继续使用旧验证码。
watch(
  [
    formData,
    comment,
    targetNodeId,
    targetUserId,
    targetUserIds,
    addSignPosition,
    verificationType,
  ],
  () => {
    invalidateVerification();
  },
  { deep: true, flush: 'sync' },
);

function resetActionParameters() {
  targetNodeId.value = undefined;
  targetUserId.value = undefined;
  targetUserIds.value = [];
  addSignPosition.value = undefined;
  invalidateVerification();
  verificationType.value = undefined;
}

function invalidateVerification() {
  ++contextVersion.value;
  verificationCode.value = '';
  emit('verificationInvalidated');
}

watch(
  () => props.verificationChallenge,
  (challenge) => {
    if (!challenge || !challenge.successful) verificationCode.value = '';
  },
);

// 控件仅接收其声明支持的标量，提交模型仍保留原始业务类型。
function inputValue(value: unknown): number | string | undefined {
  return typeof value === 'string' || typeof value === 'number'
    ? value
    : undefined;
}

function selectValue(item: WorkflowFormItem) {
  const value = formData[item.key];
  if (value === undefined || value === null) return undefined;
  const index =
    item.options?.findIndex((option) => option.value === value) ?? -1;
  return index < 0 ? 'current' : String(index);
}

function selectOptions(item: WorkflowFormItem) {
  // 用稳定位置传递选择，避免Ant Select把布尔业务值强制转换成字符串。
  const options = (item.options ?? []).map((option, index) => ({
    label: option.label,
    value: String(index),
    disabled: false,
  }));
  if (selectValue(item) === 'current')
    options.push({
      label: String(formData[item.key]),
      value: 'current',
      disabled: true,
    });
  return options;
}

function updateSelectValue(item: WorkflowFormItem, value: unknown) {
  const option = selectOptions(item).find(
    (entry) => entry.value === value && !entry.disabled,
  );
  if (option) formData[item.key] = item.options?.[Number(option.value)]?.value;
}

function chooseAction(action: WorkflowTaskAction) {
  if (
    readOnly.value ||
    !actions.value.some((item) => item.code === action.code)
  )
    return;
  selectedAction.value = action;
  resetActionParameters();
  errors.value = [];
  emit('action', action);
}

function actionInput(): WorkflowActionInput {
  // 只组装所选动作适用参数，切换后不得携带上个动作的目标。
  const input: WorkflowActionInput = {
    formData: workflowFormData(props.task, formData),
    comment: comment.value.trim() || undefined,
  };
  const pending =
    props.attachments
      ?.filter((item) => !item.attached)
      .map((item) => item.id) ?? [];
  if (pending.length > 0) input.attachmentIds = pending;
  if (selectedAction.value?.code === 'return')
    input.targetNodeId = targetNodeId.value;
  if (['delegate', 'transfer'].includes(selectedAction.value?.code ?? ''))
    input.targetUserId = targetUserId.value;
  if (selectedAction.value?.code === 'add-sign') {
    input.targetUserIds = [...targetUserIds.value];
    input.addSignPosition = addSignPosition.value;
  }
  return input;
}

function prepareVerification() {
  if (!selectedAction.value || !verificationType.value || readOnly.value)
    return;
  const input = actionInput();
  errors.value = validateWorkflowAction(
    props.task,
    selectedAction.value,
    input,
  );
  if (errors.value.length > 0) return;
  invalidateVerification();
  emit('prepareVerification', {
    ...input,
    action: selectedAction.value,
    verificationType: verificationType.value,
    contextVersion: contextVersion.value,
  });
}

function submit() {
  if (!selectedAction.value || readOnly.value) return;
  const input = actionInput();
  errors.value = validateWorkflowAction(
    props.task,
    selectedAction.value,
    input,
  );
  if (
    props.task.verificationTypes?.length &&
    (!verificationType.value ||
      !challengeReady.value ||
      !verificationCode.value.trim())
  )
    errors.value.push('请完成二次验证');
  if (errors.value.length > 0) return;
  emit('submit', {
    ...input,
    action: selectedAction.value,
    verificationCode: verificationCode.value || undefined,
    verificationType: verificationType.value,
  });
}
</script>

<template>
  <section class="levin-workflow-task-panel">
    <ACard
      :title="task.businessTitle || task.taskName || '流程待办'"
      size="small"
    >
      <template #extra>
        <ATag>
          {{
            task.status === 'Completed'
              ? '已处理'
              : workflowStatusLabel(task.status)
          }}
        </ATag>
      </template>
      <!-- 授权业务摘要与流程运行事实分开呈现。 -->
      <WorkflowBusinessDetail
        v-if="task.businessType && task.businessId"
        :detail="{
          ...task,
          businessType: task.businessType,
          businessId: task.businessId,
        }"
        :components="detailComponents"
      />
      <AAlert
        v-else
        type="info"
        message="此任务尚未提供可授权查看的业务引用。"
      />
      <ADescriptions class="mt-3" :column="1" size="small">
        <ADescriptionsItem label="流程实例">
          {{ task.processInstanceId || '—' }}
        </ADescriptionsItem>
        <ADescriptionsItem label="节点">
          {{ task.taskName || task.taskDefinitionKey || '—' }}
        </ADescriptionsItem>
        <ADescriptionsItem v-if="task.executionStatus" label="执行状态">
          {{ workflowStatusLabel(task.executionStatus) }}
        </ADescriptionsItem>
        <ADescriptionsItem v-if="task.outcome" label="流程结果">
          {{ workflowStatusLabel(task.outcome) }}
        </ADescriptionsItem>
        <ADescriptionsItem v-if="task.effectStatus" label="业务处理">
          {{ workflowStatusLabel(task.effectStatus) }}
        </ADescriptionsItem>
      </ADescriptions>

      <!-- 只渲染节点明确声明的控件，数字和布尔保持实际类型。 -->
      <template v-if="displayFormItems.length > 0">
        <ADivider orientation="left">审批表单</ADivider>
        <AForm layout="vertical" @submit.prevent>
          <AFormItem
            v-for="item in displayFormItems"
            :key="item.key"
            :label="item.label"
            :required="item.required"
          >
            <ATextarea
              v-if="item.type === 'textarea'"
              :value="inputValue(formData[item.key])"
              @update:value="formData[item.key] = $event"
              :disabled="readOnly || item.readOnly"
            />
            <AInputNumber
              v-else-if="item.type === 'number'"
              :value="inputValue(formData[item.key])"
              @update:value="formData[item.key] = $event"
              :disabled="readOnly || item.readOnly"
              style="width: 100%"
            />
            <ASelect
              v-else-if="item.type === 'boolean'"
              :value="
                typeof formData[item.key] === 'boolean'
                  ? String(formData[item.key])
                  : undefined
              "
              :disabled="readOnly || item.readOnly"
              :options="[
                { label: '是', value: 'true' },
                { label: '否', value: 'false' },
              ]"
              @update:value="
                (value: unknown) => {
                  // 清空与否不是同一值；只把明确的两个选项写入业务表单。
                  if (value === 'true' || value === 'false')
                    formData[item.key] = value === 'true';
                  else delete formData[item.key];
                }
              "
            />
            <ASelect
              v-else-if="item.type === 'select'"
              :value="selectValue(item)"
              @update:value="(value: unknown) => updateSelectValue(item, value)"
              :disabled="readOnly || item.readOnly"
              :options="selectOptions(item)"
            />
            <AInput
              v-else
              :value="inputValue(formData[item.key])"
              @update:value="formData[item.key] = $event"
              :type="item.type === 'date' ? 'date' : 'text'"
              :disabled="readOnly || item.readOnly"
            />
          </AFormItem>
        </AForm>
        <AAlert
          v-if="missingRequired && !readOnly"
          class="mb-3"
          message="请填写节点要求的表单字段后再提交。"
          type="warning"
        />
      </template>
      <slot
        name="form"
        :task="task"
        :form-data="formData"
        :read-only="readOnly"
      ></slot>

      <!-- 私有附件仅保存工作流 ID，不把公开文件 URL 写入表单或历史。 -->
      <template
        v-if="
          attachments?.length || (task.status === 'Todo' && canUploadAttachment)
        "
      >
        <ADivider orientation="left">任务附件</ADivider>
        <AFormItem
          v-if="task.status === 'Todo' && canUploadAttachment"
          label="上传私有附件"
        >
          <input
            type="file"
            aria-label="上传任务附件"
            :disabled="readOnly || uploadingAttachment"
            @change="chooseAttachment"
          />
          <p>单件不超过 5 MiB；上传后须随本次办理动作提交才进入历史。</p>
        </AFormItem>
        <AList
          v-if="attachments?.length"
          :data-source="attachments"
          size="small"
        >
          <template #renderItem="{ item }">
            <AListItem>
              <ASpace wrap>
                <span>{{ item.fileName }}（{{ item.sizeBytes }} 字节）</span>
                <ATag>{{ item.attached ? '已绑定' : '待随本次办理绑定' }}</ATag>
                <AButton
                  v-if="item.attached && canDownloadAttachment"
                  size="small"
                  :loading="downloadingAttachmentId === item.id"
                  @click="emit('downloadAttachment', item)"
                >
                  下载附件
                </AButton>
                <AButton
                  v-if="
                    !item.attached &&
                    canDeletePendingAttachment &&
                    task.status === 'Todo'
                  "
                  size="small"
                  danger
                  :disabled="readOnly || uploadingAttachment || submitting"
                  :loading="deletingAttachmentId === item.id"
                  @click="emit('deletePendingAttachment', item)"
                >
                  撤销上传
                </AButton>
              </ASpace>
            </AListItem>
          </template>
        </AList>
      </template>

      <!-- 动作参数来自任务专属选项，不能输入任意人员或节点。 -->
      <template v-if="task.status === 'Todo'">
        <ADivider orientation="left">审批动作</ADivider>
        <ASpace wrap>
          <AButton
            v-for="action in actions"
            :key="action.code"
            :type="selectedAction?.code === action.code ? 'primary' : 'default'"
            :disabled="readOnly"
            @click="chooseAction(action)"
          >
            {{ action.label }}
          </AButton>
        </ASpace>
        <AAlert
          v-if="actions.length === 0"
          type="info"
          message="当前没有可执行的授权动作。"
        />
        <AAlert
          v-for="action in unavailableActions"
          :key="action.code"
          class="mt-2"
          type="info"
          :message="`${action.label}：${workflowActionUnavailable(action)}`"
        />
        <AForm
          v-if="selectedAction"
          class="mt-4"
          layout="vertical"
          @submit.prevent
        >
          <AFormItem
            label="审批意见"
            :required="selectedAction.requiresComment"
          >
            <ATextarea
              v-model:value="comment"
              :disabled="submitting"
              :rows="3"
            />
          </AFormItem>
          <AFormItem
            v-if="selectedAction.code === 'return'"
            label="退回节点"
            required
          >
            <ASelect
              v-model:value="targetNodeId"
              :options="selectedAction.returnTargets"
              :disabled="submitting"
            />
          </AFormItem>
          <AFormItem
            v-if="['transfer', 'delegate'].includes(selectedAction.code)"
            label="目标处理人"
            required
          >
            <ASelect
              v-model:value="targetUserId"
              :options="selectedAction.candidateUsers"
              :disabled="submitting"
            />
          </AFormItem>
          <template v-if="selectedAction.code === 'add-sign'">
            <AFormItem label="加签人员" required>
              <ASelect
                v-model:value="targetUserIds"
                mode="multiple"
                :options="selectedAction.candidateUsers"
                :disabled="submitting"
              />
            </AFormItem>
            <AFormItem label="加签顺序" required>
              <ASelect
                v-model:value="addSignPosition"
                :options="selectedAction.addSignPositions"
                :disabled="submitting"
              />
            </AFormItem>
          </template>
          <template v-if="task.verificationTypes?.length">
            <AFormItem label="二次验证" required>
              <ASelect
                v-model:value="verificationType"
                :options="
                  task.verificationTypes.map((type) => ({
                    label: workflowVerificationLabel(type),
                    value: type,
                  }))
                "
                :disabled="submitting"
              />
            </AFormItem>
            <img
              v-if="captchaImage"
              :src="captchaImage"
              alt="图形验证码"
              class="mb-2 max-w-full"
            />
            <BehaviorCaptcha
              v-if="behaviorChallenge"
              :challenge="behaviorChallenge"
              @refresh="prepareVerification"
              @complete="(code: string) => (verificationCode = code)"
            />
            <AAlert
              v-if="currentChallenge && !challengeReady"
              type="error"
              message="验证挑战格式不受支持，请重新获取。"
            />
            <AFormItem
              v-if="verificationType !== 'Hmi'"
              label="验证码"
              required
            >
              <AInput
                v-model:value="verificationCode"
                autocomplete="one-time-code"
                :disabled="submitting || !challengeReady"
              />
            </AFormItem>
            <AButton
              :disabled="!verificationType || submitting"
              @click="prepareVerification"
            >
              {{ verificationType === 'Hmi' ? '获取人机挑战' : '获取验证码' }}
            </AButton>
          </template>
        </AForm>
        <AAlert
          v-if="errors.length > 0"
          class="mt-3"
          type="error"
          :message="errors.join('；')"
          role="alert"
        />
        <AButton
          v-if="selectedAction"
          class="mt-4"
          type="primary"
          :loading="submitting || uploadingAttachment"
          @click="submit"
        >
          确认{{ selectedAction.label }}
        </AButton>
      </template>

      <!-- 轨迹只能展示已记录事实，不通过按钮点击推算历史。 -->
      <ADivider orientation="left">流程轨迹</ADivider>
      <AAlert
        v-if="task.timelineTruncated"
        class="mb-3"
        type="info"
        message="仅展示最近1000条记录，原始历史仍保留。"
      />
      <ATimeline v-if="task.timeline?.length">
        <ATimelineItem
          v-for="(item, index) in task.timeline"
          :key="item.id || index"
        >
          <div>{{ item.time }}</div>
          <strong>{{ item.name }}</strong>
          <div v-if="item.actor || item.comment">
            {{ item.actor }} {{ item.comment }}
          </div>
        </ATimelineItem>
      </ATimeline>
      <AEmpty
        v-else
        description="暂无可展示的流程轨迹"
        :image-style="{ height: '48px' }"
      />
      <slot name="timeline" :task="task"></slot>
      <template v-if="task.notifications?.length">
        <ADivider orientation="left">通知</ADivider>
        <AList :data-source="task.notifications" size="small">
          <template #renderItem="{ item }">
            <AListItem>
              <AListItemMeta :description="item.content">
                <template #title>
                  {{ item.title || item.channel }}
                </template>
              </AListItemMeta>
            </AListItem>
          </template>
        </AList>
      </template>
    </ACard>
  </section>
</template>
