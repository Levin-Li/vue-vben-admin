<script setup lang="ts">
import type { SelectOption } from '@levin/admin-framework';

import type { BusinessRegistryCandidate } from '../../api/business-registry-service';
import type {
  QuickAddPayload,
  QuickAddResult,
  QuickAddTarget,
} from '../../api/quick-partner-onboarding';

import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';

import { IconifyIcon, Plus } from '@vben/runtime/icons';
import { useUserStore } from '@vben/runtime/stores';

import { UserOrgSelector } from '@levin/admin-framework';
import { notifyApiErrorOnce } from '@levin/admin-framework/framework-commons/app/api';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { isPlatformUser } from '@levin/admin-framework/framework-commons/shared/user-identity';
import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Select,
  Tooltip,
} from 'ant-design-vue';

import { businessRegistryService } from '../../api/business-registry-service';
import { channelPartnerService } from '../../api/channel-partner-service';
import { customerService } from '../../api/customer-service';
import { orgService } from '../../api/org-service';
import { supplierPartnerService } from '../../api/supplier-partner-service';
import { tenantService } from '../../api/tenant-service';
import { tenantOptionsLoader } from '../api-module';
import {
  subjectTypeOptionsLoader,
  toQuickAddSubjectTypeOptions,
} from '../legal-subject/subject-type-options';
import { buildOrgAssignmentOptionsLoader } from '../org-assignment-options';
import { changeQuickAddTenant, matchesQuickAddOrg } from './quick-add-scope';

const props = defineProps<{
  loadList: () => Promise<unknown> | unknown;
  target: QuickAddTarget;
  visible?: boolean;
  buttonLabel?: string;
  titleOverride?: string;
  fixedSupplierType?: QuickAddPayload['supplierType'];
  submitOverride?: (payload: QuickAddPayload) => Promise<QuickAddResult>;
}>();
const emit = defineEmits<{ open: [] }>();

const NOT_LEGAL_SUBJECT_HELP =
  '“非法人”指没有法人资格，不是“非法经营”。个人独资企业、合伙企业（含有限合伙）属于非法人组织，可以依法经营；GP/LP 是合伙人身份，不是主体类型。普通个人不属于非法人组织；个体工商户请选择“个体户”。此快捷新增暂不支持自然人。';

const { hasPermission } = useRbacAccess();
const userStore = useUserStore();
const platformUser = computed(() => isPlatformUser(userStore.userInfo));
const adminUser = computed(() => {
  const user = (userStore.userInfo || {}) as Record<string, unknown>;
  return user.admin === true || user.isAdmin === true;
});
const service = computed(() => {
  if (props.target === 'Customer') return customerService;
  if (props.target === 'SupplierPartner') return supplierPartnerService;
  return channelPartnerService;
});
// 平台用户还需读取租户与内部组织候选；缺少候选权限时入口无法完成归属选择。
const canCreate = computed(
  () =>
    hasPermission(
      buildApiMethodPermissions(
        service.value,
        adminUser.value ? 'quickAdd' : 'quickAddMine',
      ),
    ) &&
    hasPermission(buildApiMethodPermissions(orgService, 'list')) &&
    (!platformUser.value ||
      hasPermission(buildApiMethodPermissions(tenantService, 'list'))),
);
const canSearch = computed(
  () =>
    hasPermission(
      buildApiMethodPermissions(businessRegistryService, 'search'),
    ) &&
    hasPermission(buildApiMethodPermissions(businessRegistryService, 'lookup')),
);

const targetTitle = computed(() => {
  if (props.titleOverride) return props.titleOverride;
  if (props.target === 'Customer') return '客户';
  if (props.target === 'SupplierPartner') return '供应伙伴';
  return '渠道伙伴';
});
interface ScopeOption {
  label: string;
  tenantId?: string;
  value: string;
}

const open = ref(false);
const searching = ref(false);
const lookingUp = ref(false);
const saving = ref(false);
const candidates = ref<BusinessRegistryCandidate[]>([]);
const candidateIndex = ref<string>();
const source = ref<'manual' | 'supplier'>('manual');
const tenantOptions = ref<ScopeOption[]>([]);
const orgOptions = ref<ScopeOption[]>([]);
const selectedOrg = ref<ScopeOption>();
const tenantLoading = ref(false);
const subjectTypeOptions = ref<SelectOption[]>([]);
const subjectTypeLoading = ref(false);
let subjectTypeRequest = 0;
const form = reactive({
  tenantId: '',
  parentOrgId: '',
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
let tenantRequestGeneration = 0;
let orgRequestGeneration = 0;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let lastSearchKeyword = '';

// 三个入口共用表单，关闭与重开时不沿用上一次查询候选或账号资料。
function reset() {
  requestGeneration++;
  tenantRequestGeneration++;
  orgRequestGeneration++;
  clearTimeout(searchTimer);
  lastSearchKeyword = '';
  Object.assign(form, {
    tenantId: '',
    parentOrgId: '',
    searchName: '',
    legalSubjectName: '',
    subjectType: 'Legal',
    creditCode: '',
    shortName: '',
    adminName: '',
    loginAccount: '',
    password: '',
    supplierType: props.fixedSupplierType,
    channelType: undefined,
  });
  candidates.value = [];
  candidateIndex.value = undefined;
  source.value = 'manual';
  tenantOptions.value = [];
  orgOptions.value = [];
  selectedOrg.value = undefined;
  tenantLoading.value = false;
  searching.value = false;
  lookingUp.value = false;
}

function openForm() {
  reset();
  emit('open');
  if (!platformUser.value) {
    const user = (userStore.userInfo || {}) as Record<string, unknown>;
    form.tenantId = String(user.tenantId || '');
    if (form.tenantId) void searchOrganizations().catch(() => undefined);
  }
  open.value = true;
  void loadSubjectTypes();
  if (platformUser.value) void searchTenants();
}

// 加载失败时不使用硬编码选项，允许重新打开弹窗重试。
async function loadSubjectTypes() {
  const request = ++subjectTypeRequest;
  subjectTypeOptions.value = [];
  subjectTypeLoading.value = true;
  try {
    const options = await subjectTypeOptionsLoader('');
    if (request !== subjectTypeRequest) return;
    if (!options.length) throw new Error('主体类型枚举为空');
    subjectTypeOptions.value = toQuickAddSubjectTypeOptions(options);
  } catch (error) {
    if (request !== subjectTypeRequest) return;
    notifyApiErrorOnce(error);
    message.warning('主体类型加载失败，请重新打开重试');
  } finally {
    if (request === subjectTypeRequest) subjectTypeLoading.value = false;
  }
}

function closeForm() {
  if (saving.value) return;
  open.value = false;
  reset();
}

// 平台用户只从已有租户选项中选择归属，异步结果不得覆盖较新的搜索。
async function searchTenants(keyword = '') {
  const generation = ++tenantRequestGeneration;
  tenantLoading.value = true;
  try {
    const options = await tenantOptionsLoader(keyword);
    if (generation === tenantRequestGeneration) {
      tenantOptions.value = options
        .filter((option) => option.enable !== false)
        .map((option) => ({
          label: String(option.label).replace(/^内部父组织 · /, ''),
          value: String(option.value),
        }));
    }
  } catch (error_) {
    if (generation === tenantRequestGeneration) {
      tenantOptions.value = [];
      notifyApiErrorOnce(error_);
    }
  } finally {
    if (generation === tenantRequestGeneration) tenantLoading.value = false;
  }
}

// 租户变化时立即清除旧组织，随后只加载目标租户的可访问内部组织。
function changeTenant(tenantId: string) {
  if (!changeQuickAddTenant(form, tenantId)) return;
  selectedOrg.value = undefined;
  orgOptions.value = [];
  orgRequestGeneration++;
  if (tenantId) void searchOrganizations().catch(() => undefined);
}

async function searchOrganizations(keyword = '') {
  const tenantId = form.tenantId;
  if (!tenantId) return;
  const generation = ++orgRequestGeneration;
  try {
    const options = await buildOrgAssignmentOptionsLoader(tenantId)(keyword);
    if (generation === orgRequestGeneration && tenantId === form.tenantId) {
      orgOptions.value = options
        .filter((option) => {
          const record = option as SelectOption;
          return (
            record.enable !== false &&
            (record.state === undefined ||
              record.state === null ||
              record.state === 'Normal')
          );
        })
        .map((option) => ({
          label: String(option.label).replace(/^内部父组织 · /, ''),
          tenantId: String((option as SelectOption).tenantId || ''),
          value: String(option.value),
        }));
    }
  } catch (error_) {
    if (generation === orgRequestGeneration) {
      orgOptions.value = [];
      notifyApiErrorOnce(error_);
      throw error_;
    }
  }
}

// 打开组织树时重新读取当前租户候选，加载失败后仍可重试。
async function loadSelectableOrganizations() {
  const tenantId = form.tenantId;
  await searchOrganizations();
  if (tenantId !== form.tenantId) return [];
  return orgOptions.value.map((org) => ({ id: org.value, name: org.label }));
}

function changeOrganization(orgId: string) {
  selectedOrg.value = orgOptions.value.find(
    (option) => String(option.value) === orgId,
  );
  form.parentOrgId = selectedOrg.value ? orgId : '';
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
  } catch (error_) {
    if (generation === requestGeneration) notifyApiErrorOnce(error_);
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
  } catch (error_) {
    if (generation === requestGeneration) {
      form.legalSubjectName = candidate.name;
      form.creditCode = candidate.creditCode || '';
      source.value = 'manual';
      notifyApiErrorOnce(error_);
    }
  } finally {
    if (generation === requestGeneration) lookingUp.value = false;
  }
}

function payload(): QuickAddPayload | undefined {
  // 所有用户选择商务组织；个人入口的商务人员固定为本人，组织由服务端校验授权。
  if (!form.tenantId || !form.parentOrgId) {
    message.warning('请选择归属租户和商务组织');
    return;
  }
  if (!matchesQuickAddOrg(form, selectedOrg.value)) {
    message.warning('商务组织不属于所选租户，请重新选择');
    return;
  }

  const legalSubjectName = form.legalSubjectName.trim();
  const creditCode = form.creditCode.trim().toUpperCase();
  const shortName = form.shortName.trim();
  const loginAccount = form.loginAccount.trim();
  if (
    !subjectTypeOptions.value.some(
      (option) => option.value === form.subjectType && !option.disabled,
    )
  ) {
    message.warning('请选择可用的主体类型');
    return;
  }
  if (!legalSubjectName || !/^[0-9A-Z]{18}$/.test(creditCode)) {
    message.warning('请填写主体名称和18位统一社会信用代码');
    return;
  }
  if (!shortName || !loginAccount) {
    message.warning('请填写简称和登录账号');
    return;
  }
  if (!form.password.trim()) {
    message.warning('请填写登录密码');
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
    ...(platformUser.value ? { tenantId: form.tenantId } : {}),
    parentOrgId: form.parentOrgId,
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
    const result = props.submitOverride
      ? await props.submitOverride(data)
      : adminUser.value ? await service.value.quickAdd(data) : await service.value.quickAddMine(data);
    open.value = false;
    reset();
    message.success(
      `${targetTitle.value}快捷新增成功，登录账号：${result.loginName}`,
    );
  } catch (error) {
    notifyApiErrorOnce(error);
    return;
  } finally {
    saving.value = false;
  }
  try {
    await props.loadList();
  } catch (error) {
    notifyApiErrorOnce(error);
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
    {{ buttonLabel || '快捷新增' }}
  </Button>

  <!-- 工商资料只辅助录入，人工补录始终可用；提交由服务端重新校验。 -->
  <Modal
    v-model:open="open"
    :closable="!saving"
    :confirm-loading="saving"
    :keyboard="!saving"
    :mask-closable="false"
    :ok-button-props="{ disabled: searching || lookingUp || !canCreate }"
    :title="`快捷新增-${targetTitle}`"
    :width="'min(1080px, calc(100vw - 32px))'"
    ok-text="确认新增"
    @cancel="closeForm"
    @ok="submit"
  >
    <Form
      :id="`quick-onboarding-${target}`"
      :name="`quick-onboarding-${target}`"
      class="quick-onboarding-form mt-4"
      data-form-id="quick-partner-onboarding"
      data-form-name="快捷新增客户与伙伴"
      layout="horizontal"
    >
      <!-- 平台用户选择租户；所有用户选择可访问的商务组织。 -->
      <div class="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Form.Item v-if="platformUser" label="归属租户" required>
          <Select
            :value="form.tenantId"
            :loading="tenantLoading"
            :options="tenantOptions"
            class="w-full"
            data-testid="quick-add-tenant-select"
            placeholder="请选择归属租户"
            show-search
            :filter-option="false"
            @search="searchTenants"
            @update:value="changeTenant(String($event || ''))"
          />
        </Form.Item>
        <Form.Item label="商务组织" required>
          <UserOrgSelector
            :key="form.tenantId"
            :model-value="form.parentOrgId || undefined"
            :disabled="!form.tenantId"
            :org-load-api="loadSelectableOrganizations"
            :selectable-types="['org']"
            :max-select-count="1"
            class="w-full"
            data-testid="quick-add-parent-org-select"
            placeholder="请选择所选租户下的商务组织"
            value-mode="id"
            @update:model-value="
              changeOrganization(typeof $event === 'string' ? $event : '')
            "
          />
        </Form.Item>
      </div>
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
        <Form.Item required>
          <template #label>
            <span class="inline-flex items-center gap-1">
              主体类型
              <Tooltip
                :title="NOT_LEGAL_SUBJECT_HELP"
                :trigger="['hover', 'focus']"
              >
                <button
                  aria-label="主体类型说明"
                  class="inline-flex items-center text-gray-500"
                  type="button"
                >
                  <IconifyIcon icon="lucide:circle-help" />
                </button>
              </Tooltip>
            </span>
          </template>
          <Select
            v-model:value="form.subjectType"
            :options="subjectTypeOptions"
            :loading="subjectTypeLoading"
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
            :disabled="Boolean(fixedSupplierType)"
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
        <!-- 登录凭据在桌面同一行，窄屏按顺序换行。 -->
        <div class="col-span-full grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item label="登录账号" required>
            <Input
              v-model:value="form.loginAccount"
              :maxlength="128"
              placeholder="手机号、邮箱或普通登录名"
            />
          </Form.Item>
          <Form.Item label="密码" required>
            <Input.Password
              v-model:value="form.password"
              autocomplete="new-password"
              placeholder="请输入登录密码"
            />
          </Form.Item>
        </div>
      </div>
      <slot name="extra-fields" />
    </Form>
  </Modal>
</template>

<style scoped>
/* 桌面保留完整标签宽度，输入项占据剩余空间。 */
.quick-onboarding-form :deep(.ant-form-item-row) {
  flex-wrap: nowrap;
}

.quick-onboarding-form :deep(.ant-form-item-label) {
  flex: 0 0 144px;
  max-width: 144px;
  white-space: normal;
}

.quick-onboarding-form :deep(.ant-form-item-control) {
  flex: 1 1 0;
  min-width: 0;
}

/* 窄屏纵向展示标签和控件，避免输入区域被挤压。 */
@media (max-width: 639px) {
  .quick-onboarding-form :deep(.ant-form-item-row) {
    flex-wrap: wrap;
  }

  .quick-onboarding-form :deep(.ant-form-item-label) {
    flex: 0 0 100%;
    max-width: 100%;
    text-align: left;
  }

  .quick-onboarding-form :deep(.ant-form-item-control) {
    flex: 0 0 100%;
  }
}
</style>
