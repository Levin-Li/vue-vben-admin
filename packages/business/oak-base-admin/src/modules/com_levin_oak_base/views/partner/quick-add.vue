<script setup lang="ts">
import type { BusinessRegistryCandidate } from '../../api/business-registry-service';
import type {
  QuickAddPayload,
  QuickAddTarget,
} from '../../api/quick-partner-onboarding';

import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';

import { Plus } from '@vben/runtime/icons';

import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { Button, Form, Input, message, Modal, Select } from 'ant-design-vue';

import { businessRegistryService } from '../../api/business-registry-service';
import { channelPartnerService } from '../../api/channel-partner-service';
import { customerService } from '../../api/customer-service';
import { supplierPartnerService } from '../../api/supplier-partner-service';

const props = defineProps<{
  loadList: () => Promise<unknown> | unknown;
  target: QuickAddTarget;
  visible?: boolean;
}>();

const { hasPermission } = useRbacAccess();
const service = computed(() => {
  if (props.target === 'Customer') return customerService;
  if (props.target === 'SupplierPartner') return supplierPartnerService;
  return channelPartnerService;
});
const canCreate = computed(() =>
  hasPermission(buildApiMethodPermissions(service.value, 'quickAdd')),
);
const canSearch = computed(
  () =>
    hasPermission(
      buildApiMethodPermissions(businessRegistryService, 'search'),
    ) &&
    hasPermission(buildApiMethodPermissions(businessRegistryService, 'lookup')),
);

const targetTitle = computed(() => {
  if (props.target === 'Customer') return '客户';
  if (props.target === 'SupplierPartner') return '供应伙伴';
  return '渠道伙伴';
});
const open = ref(false);
const searching = ref(false);
const lookingUp = ref(false);
const saving = ref(false);
const candidates = ref<BusinessRegistryCandidate[]>([]);
const candidateIndex = ref<string>();
const source = ref<'manual' | 'supplier'>('manual');
const form = reactive({
  searchName: '',
  legalSubjectName: '',
  subjectType: 'Legal' as QuickAddPayload['subjectType'],
  creditCode: '',
  shortName: '',
  adminName: '',
  loginAccount: '',
  password: '',
  supplierType: undefined as QuickAddPayload['supplierType'],
  channelType: undefined as QuickAddPayload['channelType'],
});
let requestGeneration = 0;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let lastSearchKeyword = '';

// 三个入口共用表单，关闭与重开时不沿用上一次查询候选或账号资料。
function reset() {
  requestGeneration++;
  clearTimeout(searchTimer);
  lastSearchKeyword = '';
  Object.assign(form, {
    searchName: '',
    legalSubjectName: '',
    subjectType: 'Legal',
    creditCode: '',
    shortName: '',
    adminName: '',
    loginAccount: '',
    password: '',
    supplierType: undefined,
    channelType: undefined,
  });
  candidates.value = [];
  candidateIndex.value = undefined;
  source.value = 'manual';
  searching.value = false;
  lookingUp.value = false;
}

function openForm() {
  reset();
  open.value = true;
}

function closeForm() {
  if (saving.value) return;
  open.value = false;
  reset();
}

// 名称输入停顿后自动搜候选；短输入不发起供应商调用。
watch(
  () => form.searchName,
  (name) => {
    requestGeneration++;
    clearTimeout(searchTimer);
    candidates.value = [];
    candidateIndex.value = undefined;
    searching.value = false;
    lookingUp.value = false;
    if (!open.value || name.trim().length < 2) return;
    if (name.trim() === lastSearchKeyword) return;
    searchTimer = setTimeout(search, 800);
  },
);
onBeforeUnmount(() => clearTimeout(searchTimer));

// 手机号和邮箱可用验证码登录；普通登录名必须提供密码。
const ordinaryLoginName = computed(() => {
  const account = form.loginAccount.trim();
  if (!account) return false;
  const at = account.indexOf('@');
  const domain = account.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const email =
    at > 0 &&
    at === account.lastIndexOf('@') &&
    dot > 0 &&
    dot < domain.length - 1 &&
    !/\s/.test(account);
  return !/^1[3-9]\d{9}$/.test(account) && !email;
});

// 搜索只返回候选；选定候选后才执行一次详情调用。
async function search() {
  clearTimeout(searchTimer);
  const keyword = form.searchName.trim();
  if (keyword.length < 2 || !canSearch.value) return;
  lastSearchKeyword = keyword;
  const generation = ++requestGeneration;
  searching.value = true;
  lookingUp.value = false;
  candidates.value = [];
  candidateIndex.value = undefined;
  try {
    const result = await businessRegistryService.search(keyword);
    if (generation !== requestGeneration) return;
    candidates.value = result.items || [];
    if (candidates.value.length === 0)
      message.info('未查到主体，请手工填写主体名称和统一社会信用代码');
  } catch {
    if (generation === requestGeneration)
      message.warning('主体查询暂不可用，请手工填写主体名称和统一社会信用代码');
  } finally {
    if (generation === requestGeneration) searching.value = false;
  }
}

async function selectCandidate(index: string) {
  candidateIndex.value = index;
  const candidate = candidates.value[Number(index)];
  if (!candidate || !canSearch.value) return;
  const generation = ++requestGeneration;
  lookingUp.value = true;
  try {
    const result = await businessRegistryService.lookup(
      candidate.name,
      candidate.creditCode,
    );
    if (generation !== requestGeneration) return;
    form.legalSubjectName = result.info?.name?.trim() || candidate.name;
    form.creditCode =
      result.info?.creditCode?.trim() || candidate.creditCode || '';
    source.value =
      result.matchResult === 'MATCH' &&
      Boolean(result.info?.name && result.info?.creditCode)
        ? 'supplier'
        : 'manual';
    if (source.value === 'manual')
      message.warning(
        '查询资料不完整或不一致，请人工核对主体名称和统一社会信用代码',
      );
  } catch {
    if (generation === requestGeneration) {
      form.legalSubjectName = candidate.name;
      form.creditCode = candidate.creditCode || '';
      source.value = 'manual';
      message.warning('详情查询失败，请人工核对并补齐主体资料');
    }
  } finally {
    if (generation === requestGeneration) lookingUp.value = false;
  }
}

function payload(): QuickAddPayload | undefined {
  const legalSubjectName = form.legalSubjectName.trim();
  const creditCode = form.creditCode.trim().toUpperCase();
  const shortName = form.shortName.trim();
  const loginAccount = form.loginAccount.trim();
  if (!legalSubjectName || !/^[0-9A-Z]{18}$/.test(creditCode)) {
    message.warning('请填写主体名称和18位统一社会信用代码');
    return;
  }
  if (!shortName || !loginAccount) {
    message.warning('请填写简称和登录账号');
    return;
  }
  if (ordinaryLoginName.value && !form.password.trim()) {
    message.warning('普通登录名必须设置密码');
    return;
  }
  if (props.target === 'SupplierPartner' && !form.supplierType) {
    message.warning('请选择供应商类型');
    return;
  }
  if (props.target === 'ChannelPartner' && !form.channelType) {
    message.warning('请选择渠道伙伴类型');
    return;
  }
  return {
    legalSubjectName,
    subjectType: form.subjectType,
    creditCode,
    shortName,
    loginAccount,
    ...(form.adminName.trim() ? { adminName: form.adminName.trim() } : {}),
    ...(form.password ? { password: form.password } : {}),
    ...(props.target === 'SupplierPartner'
      ? { supplierType: form.supplierType }
      : {}),
    ...(props.target === 'ChannelPartner'
      ? { channelType: form.channelType }
      : {}),
  };
}

async function submit() {
  if (!canCreate.value || saving.value || searching.value || lookingUp.value)
    return;
  const data = payload();
  if (!data) return;
  saving.value = true;
  try {
    const result = await service.value.quickAdd(data);
    open.value = false;
    reset();
    message.success(
      `${targetTitle.value}快捷添加成功，登录账号：${result.loginName}`,
    );
  } catch (error) {
    message.error(
      error instanceof Error ? error.message : '快捷添加失败，请检查后重试',
    );
    return;
  } finally {
    saving.value = false;
  }
  try {
    await props.loadList();
  } catch {
    message.warning('快捷添加成功，但列表刷新失败，请手动刷新');
  }
}

const supplierTypes = [
  { label: '货物', value: 'Goods' },
  { label: '原材料', value: 'RawMaterials' },
  { label: '零部件', value: 'Parts' },
  { label: '一般服务', value: 'Service' },
  { label: '物流', value: 'Logistics' },
  { label: '技术服务', value: 'Technology' },
  { label: '运营服务', value: 'Operation' },
  { label: '内容与版权', value: 'ContentAndCopyright' },
  { label: '其他', value: 'Other' },
];
const channelTypes = [
  { label: '经销商', value: 'Dealer' },
  { label: '分销商', value: 'Distributor' },
  { label: '代理商', value: 'Agent' },
  { label: '线上店铺', value: 'OnlineStore' },
  { label: '线下店铺', value: 'OfflineStore' },
];
</script>

<template>
  <Button
    v-if="visible !== false && canCreate"
    type="primary"
    @click="openForm"
  >
    <Plus class="size-4" />
    快捷添加
  </Button>

  <!-- 工商资料只辅助录入，人工补录始终可用；提交由服务端重新校验。 -->
  <Modal
    v-model:open="open"
    :closable="!saving"
    :confirm-loading="saving"
    :keyboard="!saving"
    :mask-closable="false"
    :ok-button-props="{ disabled: searching || lookingUp || !canCreate }"
    :title="`快捷添加${targetTitle}`"
    width="640px"
    ok-text="确认添加"
    @cancel="closeForm"
    @ok="submit"
  >
    <Form
      :id="`quick-onboarding-${target}`"
      :name="`quick-onboarding-${target}`"
      class="mt-4"
      data-form-id="quick-partner-onboarding"
      data-form-name="快捷添加客户与伙伴"
      layout="vertical"
    >
      <Form.Item label="主体名称搜索">
        <div class="flex gap-2">
          <Input
            v-model:value="form.searchName"
            placeholder="输入主体名称"
            @press-enter="search"
          />
          <Button :disabled="!canSearch" :loading="searching" @click="search">
            搜索
          </Button>
        </div>
        <div v-if="canSearch" class="mt-1 text-xs text-gray-500">
          输入停顿后自动调用企查查候选搜索，供应商可能计费。
        </div>
        <div v-if="!canSearch" class="mt-1 text-xs text-gray-500">
          当前无法使用主体查询，可直接人工填写下方资料。
        </div>
      </Form.Item>
      <Form.Item v-if="candidates.length > 0" label="选择查询结果">
        <Select
          :value="candidateIndex"
          :loading="lookingUp"
          :options="
            candidates.map((item, index) => ({
              label: `${item.name}${item.creditCode ? `（${item.creditCode}）` : ''}`,
              value: String(index),
            }))
          "
          placeholder="选择后查询完整工商资料"
          class="w-full"
          @change="(value) => selectCandidate(String(value))"
        />
      </Form.Item>
      <div class="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Form.Item label="主体名称" required>
          <Input
            v-model:value="form.legalSubjectName"
            :maxlength="256"
            placeholder="登记主体的完整名称"
            @update:value="source = 'manual'"
          />
        </Form.Item>
        <Form.Item label="简称" required>
          <Input
            v-model:value="form.shortName"
            :maxlength="32"
            placeholder="主体简称"
          />
        </Form.Item>
        <Form.Item label="统一社会信用代码" required>
          <Input
            v-model:value="form.creditCode"
            :maxlength="18"
            placeholder="18位统一社会信用代码"
            @update:value="source = 'manual'"
          />
          <div class="mt-1 text-xs text-gray-500">
            {{
              source === 'supplier'
                ? '已从工商查询回填，请核对'
                : '人工填写或修改，尚未由工商查询核验'
            }}
          </div>
        </Form.Item>
        <Form.Item label="主体类型" required>
          <Select
            v-model:value="form.subjectType"
            :options="[
              { label: '法人（公司、机关事业单位）', value: 'Legal' },
              { label: '个体户', value: 'Individual' },
              { label: '非法人组织', value: 'NotLegal' },
            ]"
            class="w-full"
          />
        </Form.Item>
        <Form.Item
          v-if="target === 'SupplierPartner'"
          label="供应商类型"
          required
        >
          <Select
            v-model:value="form.supplierType"
            :options="supplierTypes"
            placeholder="请选择"
            class="w-full"
          />
        </Form.Item>
        <Form.Item
          v-if="target === 'ChannelPartner'"
          label="渠道伙伴类型"
          required
        >
          <Select
            v-model:value="form.channelType"
            :options="channelTypes"
            placeholder="请选择"
            class="w-full"
          />
        </Form.Item>
        <Form.Item label="用户名">
          <Input
            v-model:value="form.adminName"
            :maxlength="128"
            placeholder="不填默认为管理员"
          />
        </Form.Item>
        <Form.Item label="登录账号" required>
          <Input
            v-model:value="form.loginAccount"
            :maxlength="128"
            placeholder="手机号、邮箱或普通登录名"
          />
        </Form.Item>
        <Form.Item
          label="密码"
          :required="ordinaryLoginName"
          class="sm:col-span-2"
        >
          <Input.Password
            v-model:value="form.password"
            autocomplete="new-password"
            :placeholder="
              ordinaryLoginName
                ? '普通登录名必须设置密码'
                : '手机号或邮箱可不填，使用验证码登录'
            "
          />
        </Form.Item>
      </div>
    </Form>
  </Modal>
</template>
