<script setup lang="ts">
import type {
  CreateRecommendationLinkRequest,
  InvitationTarget,
  RecommendationLinkInfo,
} from '../../api/recommendation-link-service';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Table,
  Tag,
} from 'ant-design-vue';

import { recommendationLinkService } from '../../api/recommendation-link-service';
import ChannelPartnerPicker from '../customer/channel-partner-picker.vue';

type CreateMethod =
  | 'createChannelPartner'
  | 'createCustomer'
  | 'createInternal'
  | 'createMember'
  | 'createSupplierPartner';
const createMethodByTarget: Record<InvitationTarget, CreateMethod> = {
  Internal: 'createInternal',
  Member: 'createMember',
  Customer: 'createCustomer',
  SupplierPartner: 'createSupplierPartner',
  ChannelPartner: 'createChannelPartner',
};
const targetOptions: { label: string; value: InvitationTarget }[] = [
  { label: '内部用户', value: 'Internal' },
  { label: '会员用户', value: 'Member' },
  { label: '客户', value: 'Customer' },
  { label: '供应伙伴', value: 'SupplierPartner' },
  { label: '渠道伙伴', value: 'ChannelPartner' },
];
const targetLabel = Object.fromEntries(
  targetOptions.map(({ label, value }) => [value, label]),
);
const { hasPermission } = useRbacAccess();
const allowed = (method: string) =>
  hasPermission(buildApiMethodPermissions(recommendationLinkService, method));
const canInviteChildAdmin = computed(() => allowed('canInviteChildAdmin'));
const userTypeOptions = computed(() => [
  { label: '普通用户', value: 'Employee' },
  ...(canInviteChildAdmin.value
    ? [{ label: '子组织管理员', value: 'Administrator' }]
    : []),
]);
const rows = ref<RecommendationLinkInfo[]>([]);
const pageIndex = ref(0);
const total = ref(0);
const pageSize = 20;
const hasMore = computed(() => rows.value.length < total.value);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const createOpen = ref(false);
const revokeId = ref('');
const revokeReason = ref('');
const createdUrl = ref('');
const draft = reactive<
  CreateRecommendationLinkRequest & { targetType: InvitationTarget }
>({
  targetType: 'Internal',
  userType: 'Employee',
  organizationMode: 'JoinInviterOrg',
  registrationChannel: 'Either',
  expiresAt: '',
  usageMode: 'Single',
});
const isExternal = computed(() =>
  ['ChannelPartner', 'Customer', 'SupplierPartner'].includes(draft.targetType),
);
const isNewOrg = computed(
  () => isExternal.value || draft.organizationMode === 'CreateChildOrg',
);
watch(
  () => draft.userType,
  (value) => {
    if (value === 'Administrator') draft.organizationMode = 'CreateChildOrg';
  },
);
watch(canInviteChildAdmin, (canInvite) => {
  if (!canInvite && draft.userType === 'Administrator')
    draft.userType = 'Employee';
});
const columns = [
  { title: '邀请目标', key: 'targetType' },
  { title: '用户类型', key: 'userType' },
  { title: '注册方式', key: 'registrationChannel' },
  { title: '到期时间', dataIndex: 'expiresAt' },
  { title: '成功人数', dataIndex: 'successCount' },
  { title: '状态', key: 'status' },
  { title: '操作', key: 'actions' },
];

function openCreate() {
  const firstAllowed = targetOptions.find((item) =>
    allowed(createMethodByTarget[item.value]),
  );
  if (!firstAllowed) return;
  selectTarget(firstAllowed.value);
  createdUrl.value = '';
  createOpen.value = true;
}

// 列表只展示摘要；完整链接由单独授权接口取得，不存储在列表记录中。
async function load(reset = true) {
  if (!allowed('list') || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const nextPage = reset ? 1 : pageIndex.value + 1;
    const result = await recommendationLinkService.list({
      pageIndex: nextPage,
      pageSize,
    });
    rows.value = reset ? result.items : [...rows.value, ...result.items];
    pageIndex.value = result.pageIndex;
    total.value = result.total;
  } catch (error_) {
    error.value = error_ instanceof Error ? error_.message : '链接列表加载失败';
  } finally {
    loading.value = false;
  }
}
onMounted(() => load());

function selectTarget(selectedValue: unknown) {
  const value = selectedValue as InvitationTarget;
  draft.targetType = value;
  draft.userType = value === 'Member' ? undefined : 'Employee';
  draft.organizationMode = [
    'ChannelPartner',
    'Customer',
    'SupplierPartner',
  ].includes(value)
    ? 'CreateChildOrg'
    : 'JoinInviterOrg';
  draft.childOrgType = undefined;
  if (value === 'Customer') draft.childOrgType = 'Customer';
  if (value === 'SupplierPartner') draft.childOrgType = 'SupplierPartner';
  if (value === 'ChannelPartner') draft.childOrgType = 'ChannelPartner';
  draft.customerType = undefined;
  draft.channelPartnerId = undefined;
  draft.supplierPartnerType = undefined;
  draft.channelPartnerType = undefined;
}

function validate() {
  if (!draft.expiresAt || new Date(draft.expiresAt).getTime() <= Date.now())
    return '请选择未来的过期时间';
  if (
    draft.usageMode === 'Limited' &&
    (!Number.isInteger(draft.maxRegistrations) ||
      Number(draft.maxRegistrations) < 1)
  )
    return '限定人数必须是正整数';
  if (isNewOrg.value && !isExternal.value && !draft.childOrgType)
    return '请选择新子组织类型';
  if (
    draft.userType === 'Administrator' &&
    draft.organizationMode !== 'CreateChildOrg'
  )
    return '子组织管理员必须创建新子组织';
  if (draft.userType === 'Administrator' && !canInviteChildAdmin.value)
    return '当前账号无权邀请子组织管理员';
  if (draft.targetType === 'Customer' && !draft.customerType)
    return '请选择客户类型';
  if (draft.customerType === 'ChannelCustomer' && !draft.channelPartnerId)
    return '请选择渠道伙伴';
  if (draft.targetType === 'SupplierPartner' && !draft.supplierPartnerType)
    return '请选择供应伙伴类型';
  if (draft.targetType === 'ChannelPartner' && !draft.channelPartnerType)
    return '请选择渠道伙伴类型';
  return '';
}

// 每个目标使用独立后端方法和权限；表单只发送该目标允许的字段。
async function create() {
  const problem = validate();
  if (problem) {
    message.error(problem);
    return;
  }
  const method = createMethodByTarget[draft.targetType];
  if (!allowed(method) || saving.value) return;
  const data: CreateRecommendationLinkRequest = {
    registrationChannel: draft.registrationChannel,
    expiresAt: draft.expiresAt,
    usageMode: draft.usageMode,
    ...(draft.usageMode === 'Limited'
      ? { maxRegistrations: draft.maxRegistrations }
      : {}),
    userType: draft.targetType === 'Member' ? 'Employee' : draft.userType,
    organizationMode: isExternal.value
      ? 'CreateChildOrg'
      : draft.organizationMode,
    ...(isNewOrg.value ? { childOrgType: draft.childOrgType } : {}),
    ...(draft.targetType === 'Customer'
      ? {
          customerType: draft.customerType,
          channelPartnerId: draft.channelPartnerId,
        }
      : {}),
    ...(draft.targetType === 'SupplierPartner'
      ? { supplierPartnerType: draft.supplierPartnerType }
      : {}),
    ...(draft.targetType === 'ChannelPartner'
      ? { channelPartnerType: draft.channelPartnerType }
      : {}),
  };
  saving.value = true;
  try {
    const result = await recommendationLinkService[method](data);
    createdUrl.value = result.url;
    createOpen.value = false;
    await load();
    message.success('邀请链接已创建');
  } catch (error_) {
    message.error(error_ instanceof Error ? error_.message : '创建失败');
  } finally {
    saving.value = false;
  }
}

async function copy(id: string) {
  if (!allowed('copyLink')) return;
  try {
    const result = await recommendationLinkService.copyLink(id);
    await navigator.clipboard.writeText(result.url);
    message.success('链接已复制');
  } catch (error_) {
    message.error(error_ instanceof Error ? error_.message : '复制失败');
  }
}

async function revoke() {
  if (!revokeId.value || !revokeReason.value.trim() || !allowed('revoke'))
    return;
  saving.value = true;
  try {
    await recommendationLinkService.revoke(
      revokeId.value,
      revokeReason.value.trim(),
    );
    revokeId.value = '';
    revokeReason.value = '';
    await load();
    message.success('链接已作废');
  } catch (error_) {
    message.error(error_ instanceof Error ? error_.message : '作废失败');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Page
    title="邀请注册链接"
    description="链接签发后不可编辑或删除；如需停止使用，请作废并留存原因。"
  >
    <div class="mb-4 flex gap-2">
      <Button
        v-if="
          targetOptions.some((item) =>
            allowed(createMethodByTarget[item.value]),
          )
        "
        type="primary"
        @click="openCreate"
      >
        创建邀请链接
      </Button>
      <Button :loading="loading" @click="load(true)">刷新</Button>
    </div>
    <Alert v-if="error" class="mb-4" type="error" :message="error" />
    <Alert
      v-if="createdUrl"
      class="mb-4"
      type="success"
      message="链接已创建"
      :description="createdUrl"
    />
    <Table
      :data-source="rows"
      :columns="columns"
      :loading="loading"
      :row-key="(row: RecommendationLinkInfo) => row.id"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'targetType'">
          {{ targetLabel[record.targetType] || record.targetType }}
        </template>
        <template v-else-if="column.key === 'userType'">
          {{
            record.userType === 'Administrator' ? '子组织管理员' : '普通用户'
          }}
        </template>
        <template v-else-if="column.key === 'registrationChannel'">
          {{ record.registrationChannel }}
        </template>
        <template v-else-if="column.key === 'status'">
          <Tag>{{ record.status }}</Tag>
        </template>
        <template v-else-if="column.key === 'actions'">
          <Button
            v-if="allowed('copyLink') && record.status === 'Active'"
            type="link"
            @click="copy(record.id)"
          >
            复制链接
          </Button>
          <Button
            v-if="allowed('revoke') && record.status === 'Active'"
            danger
            type="link"
            @click="revokeId = record.id"
          >
            作废
          </Button>
        </template>
      </template>
    </Table>
    <div v-if="hasMore && allowed('list')" class="mt-4 text-center">
      <Button :loading="loading" @click="load(false)">加载更多</Button>
    </div>
    <Modal
      v-model:open="createOpen"
      title="创建邀请注册链接"
      :confirm-loading="saving"
      @ok="create"
    >
      <Form layout="vertical">
        <Form.Item label="邀请目标" required>
          <Select
            :value="draft.targetType"
            :options="
              targetOptions.filter((item) =>
                allowed(createMethodByTarget[item.value]),
              )
            "
            @change="selectTarget"
          />
        </Form.Item>
        <Form.Item
          v-if="draft.targetType !== 'Member'"
          label="受邀用户类型"
          required
        >
          <Select v-model:value="draft.userType" :options="userTypeOptions" />
        </Form.Item>
        <Form.Item v-if="!isExternal" label="组织安排" required>
          <Select
            v-model:value="draft.organizationMode"
            :options="
              draft.userType === 'Administrator'
                ? [{ label: '为每人创建子组织', value: 'CreateChildOrg' }]
                : [
                    { label: '加入推荐人组织', value: 'JoinInviterOrg' },
                    { label: '为每人创建子组织', value: 'CreateChildOrg' },
                  ]
            "
          />
        </Form.Item>
        <Form.Item v-if="isNewOrg && !isExternal" label="新子组织类型" required>
          <Select
            v-model:value="draft.childOrgType"
            :options="[
              { label: '公司', value: 'Company' },
              { label: '分公司', value: 'Branch' },
              { label: '部门', value: 'Department' },
              { label: '团队', value: 'Team' },
              { label: '小组', value: 'Group' },
            ]"
          />
        </Form.Item>
        <Form.Item
          v-if="draft.targetType === 'Customer'"
          label="客户类型"
          required
        >
          <Select
            v-model:value="draft.customerType"
            :options="[
              { label: '直接客户', value: 'DirectCustomer' },
              { label: '渠道客户', value: 'ChannelCustomer' },
            ]"
          />
        </Form.Item>
        <Form.Item
          v-if="draft.customerType === 'ChannelCustomer'"
          label="渠道伙伴"
          required
        >
          <ChannelPartnerPicker v-model="draft.channelPartnerId" />
        </Form.Item>
        <Form.Item
          v-if="draft.targetType === 'SupplierPartner'"
          label="供应伙伴类型"
          required
        >
          <Select
            v-model:value="draft.supplierPartnerType"
            :options="[
              { label: '商品', value: 'Goods' },
              { label: '原材料', value: 'RawMaterials' },
              { label: '零部件', value: 'Parts' },
              { label: '服务', value: 'Service' },
              { label: '物流', value: 'Logistics' },
              { label: '技术', value: 'Technology' },
              { label: '运营', value: 'Operation' },
              { label: '其他', value: 'Other' },
            ]"
          />
        </Form.Item>
        <Form.Item
          v-if="draft.targetType === 'ChannelPartner'"
          label="渠道伙伴类型"
          required
        >
          <Select
            v-model:value="draft.channelPartnerType"
            :options="[
              { label: '经销商', value: 'Dealer' },
              { label: '分销商', value: 'Distributor' },
              { label: '代理商', value: 'Agent' },
              { label: '线上店', value: 'OnlineStore' },
              { label: '线下店', value: 'OfflineStore' },
            ]"
          />
        </Form.Item>
        <Form.Item label="注册方式" required>
          <Select
            v-model:value="draft.registrationChannel"
            :options="[
              { label: '仅手机号', value: 'Phone' },
              { label: '仅邮箱', value: 'Email' },
              { label: '手机号或邮箱', value: 'Either' },
              { label: '仅第三方认证', value: 'ThirdParty' },
              { label: '不限（手机号、邮箱或第三方）', value: 'Unrestricted' },
            ]"
          />
        </Form.Item>
        <Form.Item label="过期时间" required>
          <Input v-model:value="draft.expiresAt" type="datetime-local" />
        </Form.Item>
        <Form.Item label="使用次数" required>
          <Select
            v-model:value="draft.usageMode"
            :options="[
              { label: '仅一次', value: 'Single' },
              { label: '限定人数', value: 'Limited' },
              { label: '不限人数', value: 'Unlimited' },
            ]"
          />
        </Form.Item>
        <Form.Item
          v-if="draft.usageMode === 'Limited'"
          label="人数上限"
          required
        >
          <InputNumber
            v-model:value="draft.maxRegistrations"
            :min="1"
            :precision="0"
            class="w-full"
          />
        </Form.Item>
      </Form>
    </Modal>
    <Modal
      :open="Boolean(revokeId)"
      title="作废邀请链接"
      :confirm-loading="saving"
      @ok="revoke"
      @cancel="revokeId = ''"
    >
      <label for="revoke-reason">作废原因</label>
      <Input id="revoke-reason" v-model:value="revokeReason" :maxlength="200" />
    </Modal>
  </Page>
</template>
