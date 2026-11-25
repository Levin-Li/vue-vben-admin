<script setup lang="ts">
import type { QuickAddTarget } from '../../api/quick-partner-onboarding';
import type { UserOrgSelectorModelValue, UserOrgSelectorRecord } from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import { computed, reactive, ref } from 'vue';
import { useUserStore } from '@vben/runtime/stores';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { isPlatformUser } from '@levin/admin-framework/framework-commons/shared/user-identity';
import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Radio,
  Select,
  Spin,
} from 'ant-design-vue';

import { channelPartnerService } from '../../api/channel-partner-service';
import { customerService } from '../../api/customer-service';
import { legalSubjectService } from '../../api/legal-subject-service';
import { supplierPartnerService } from '../../api/supplier-partner-service';
import SupportScopeSelector from '../support-scope-selector.vue';
import SupportUserSelector from '../support-user-selector.vue';
import { getSubjectIdentityLabel, validateSubjectIdentity } from '../legal-subject/subject-identity';
import LegalSubjectPicker from './legal-subject-picker.vue';
import { canEditSubject } from './subject-edit-access';

const props = defineProps<{
  record: Record<string, any>;
  reload: () => unknown;
  target: QuickAddTarget;
}>();
const userStore = useUserStore();
const { hasPermission } = useRbacAccess();
const service = computed(() =>
  props.target === 'Customer'
    ? customerService
    : props.target === 'SupplierPartner'
      ? supplierPartnerService
      : channelPartnerService,
);
const subjectId = computed(() => props.record.legalSubjectId);
const visible = computed(
  () =>
    Object.hasOwn(props.record, 'legalSubjectId') &&
    (subjectId.value
      ? hasPermission(
          buildApiMethodPermissions(legalSubjectService, 'retrieve'),
        )
      : hasPermission(
          buildApiMethodPermissions(service.value, 'bindLegalSubject'),
        )),
);
const open = ref(false);
const loading = ref(false);
const saving = ref(false);
const relation = ref<Record<string, any>>();
const subject = ref<Record<string, any> | null>(null);
const mode = ref<'existing' | 'new'>('existing');
const mine = ref(false);
const selected = ref<number | string>();
const selectedOrg = ref<undefined | UserOrgSelectorRecord>();
const businessOrg = ref<undefined | UserOrgSelectorRecord>();
const businessUser = ref<UserOrgSelectorModelValue>();
const businessScope = computed(() => {
  const tenantId = relation.value?.tenantId || businessOrg.value?.tenantId;
  return businessOrg.value && tenantId ? { orgId: businessOrg.value.id, tenantId: String(tenantId) } : undefined;
});
function changeBusinessOrg(value?: UserOrgSelectorRecord) {
  businessOrg.value = value;
  businessUser.value = undefined;
}
const form = reactive({
  subjectName: '',
  shortName: '',
  subjectType: 'Legal',
  unifiedCreditNo: '',
});
const canEdit = computed(() =>
  canEditSubject(
    subject.value,
    userStore.userInfo,
    hasPermission(buildApiMethodPermissions(legalSubjectService, 'update')),
  ),
);
const canCreate = computed(() =>
  hasPermission(
    buildApiMethodPermissions(
      legalSubjectService,
      mine.value ? 'createMine' : 'create',
    ),
  ),
);
const statusLabels: Record<string, string> = {
  Draft: '未审核',
  AuditPending: '审核中',
  AuditRejected: '认证拒绝',
  Certified: '已认证',
  Revoked: '认证已撤销',
};
const typeLabels: Record<string, string> = {
  Legal: '法人',
  Person: '自然人',
  Individual: '个体户',
  NotLegal: '非法人',
};
const fields = [
  { key: 'subjectName', label: '主体名称' },
  { key: 'shortName', label: '简称' },
  { key: 'unifiedCreditNo', label: '主体身份标识/统一社会信用代码/身份证' },
] as const;

async function show() {
  open.value = true;
  loading.value = true;
  subject.value = null;
  relation.value = undefined;
  selected.value = undefined;
  selectedOrg.value = undefined;
  businessOrg.value = undefined;
  businessUser.value = undefined;
  mode.value = 'existing';
  mine.value = false;
  Object.assign(form, {
    subjectName: '',
    shortName: '',
    subjectType: 'Legal',
    unifiedCreditNo: '',
  });
  try {
    const result = await service.value.retrieve({
      id: props.record.id,
      tenantId: props.record.tenantId,
    });
    if (
      !result ||
      typeof result !== 'object' ||
      !Object.hasOwn(result, 'legalSubjectId')
    )
      throw new Error('无法读取主体关联状态');
    const detail = result as Record<string, any>;
    if (!detail.legalSubjectId && !Object.hasOwn(detail, 'subjectOrgId'))
      throw new Error('无法读取主体方组织状态');
    relation.value = detail;
    const user = userStore.userInfo;
    if (user?.orgId && user?.id && (!detail.tenantId || detail.tenantId === user.tenantId)) {
      businessOrg.value = { id: String(user.orgId), kind: 'org', name: String(user.orgName || user.orgId), tenantId: user.tenantId ? String(user.tenantId) : undefined };
      businessUser.value = String(user.id);
    }
    if (detail.legalSubjectId) {
      const result = await legalSubjectService.retrieve({
        id: detail.legalSubjectId,
        tenantId: detail.tenantId,
      });
      if (!result || typeof result !== 'object')
        throw new Error('无法读取主体信息');
      subject.value = result as Record<string, any>;
      for (const field of fields)
        form[field.key] = String(subject.value[field.key] ?? '');
      form.subjectType = String(subject.value.subjectType || 'Legal');
    }
  } catch (error) {
    open.value = false;
    message.error(error instanceof Error ? error.message : '读取主体信息失败');
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (!relation.value) return;
  saving.value = true;
  try {
    if (subject.value) {
      if (!canEdit.value) return;
      if (Object.hasOwn(subject.value, 'subjectName') && !form.subjectName.trim()) throw new Error('请填写主体名称');
      if (Object.hasOwn(subject.value, 'unifiedCreditNo')
          && form.unifiedCreditNo !== String(subject.value.unifiedCreditNo ?? '')) {
        if (!subject.value.subjectType) throw new Error('主体类型不可见，不能修改身份标识');
        const identityError = validateSubjectIdentity(form.unifiedCreditNo, form);
        if (identityError) throw new Error(identityError);
      }
      const payload: Record<string, unknown> = {
        id: subject.value.id,
        tenantId: subject.value.tenantId,
        optimisticLock: subject.value.optimisticLock,
      };
      for (const field of fields) {
        if (!Object.hasOwn(subject.value, field.key)) continue;
        const original = subject.value[field.key];
        if (String(original ?? '') !== form[field.key])
          payload[field.key] = form[field.key];
      }
      await legalSubjectService.update(payload);
    } else {
      const selectedOrgId = relation.value.subjectOrgId || selectedOrg.value?.id;
      if (!selectedOrgId) throw new Error('请选择主体方组织');
      if (selectedOrg.value?.tenantId && relation.value.tenantId && selectedOrg.value.tenantId !== relation.value.tenantId)
        throw new Error('所选组织不属于当前租户');
      const partner = {
        id: relation.value.id,
        tenantId: relation.value.tenantId,
        optimisticLock: relation.value.optimisticLock,
        subjectOrgId: selectedOrgId,
      };
      if (mode.value === 'existing') {
        if (!selected.value) throw new Error('请选择已有主体');
        await service.value.bindLegalSubject({
          ...partner,
          legalSubjectId: selected.value,
        });
      } else {
        if (!canCreate.value) throw new Error('没有新增主体权限');
        if (!form.subjectName.trim()) throw new Error('请填写主体名称');
        const identityError = validateSubjectIdentity(form.unifiedCreditNo, form);
        if (identityError) throw new Error(identityError);
        const chosenBusinessUser = typeof businessUser.value === 'string'
          ? businessUser.value
          : !Array.isArray(businessUser.value) ? businessUser.value?.id : undefined;
        const details = {
          ...form,
          subjectName: form.subjectName.trim(),
          shortName: form.shortName.trim() || undefined,
          unifiedCreditNo: form.unifiedCreditNo.trim() || undefined,
          ...(!mine.value
            ? { businessOrgId: businessOrg.value?.id, businessUserId: chosenBusinessUser }
            : {}),
        };
        if (!mine.value && (!details.businessOrgId || !details.businessUserId))
          throw new Error('请选择商务部门和对接人');
        if (!mine.value && businessOrg.value?.tenantId && partner.tenantId
            && businessOrg.value.tenantId !== partner.tenantId) throw new Error('商务部门不属于当前租户');
        await service.value.createAndBindLegalSubject({
          partner,
          subject: details,
          mine: mine.value,
        });
      }
    }
    open.value = false;
    message.success('主体信息已保存');
    await props.reload();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存主体信息失败');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Button v-if="visible" type="link" size="small" @click="show">{{
    subjectId ? '查看主体信息' : '绑定主体'
  }}</Button>
  <Modal
    v-model:open="open"
    :title="subject ? '主体信息' : '绑定主体'"
    :mask-closable="false"
  >
    <Spin :spinning="loading">
      <!-- 主体信息使用稳定表单标识，宽屏分列、窄屏单列。 -->
      <Form v-if="relation" :id="`partner-subject-info-${record.id}`" :name="`partner-subject-info-${record.id}`"
        data-form-id="partner-subject-info" data-form-name="伙伴主体信息"
        class="grid grid-cols-1 gap-x-4 sm:grid-cols-2" layout="vertical">
        <template v-if="subject">
          <p class="sm:col-span-2">证照、开票、联系人等完整资料请在法律主体页面维护。</p>
          <Form.Item label="认证状态">{{
            statusLabels[subject.certificationStatus] || '状态不可见'
          }}</Form.Item>
          <Form.Item label="主体类型">{{
            typeLabels[subject.subjectType] || '—'
          }}</Form.Item>
          <Form.Item
            v-for="field in fields.filter((item) =>
              Object.hasOwn(subject || {}, item.key),
            )"
            :key="field.key"
            :label="field.label"
          >
            <Input v-model:value="form[field.key]" :disabled="!canEdit || (field.key === 'unifiedCreditNo' && !subject.subjectType)" />
          </Form.Item>
        </template>
        <template v-else>
          <Form.Item label="主体方组织" required>
            <Input v-if="relation.subjectOrgId" :value="relation.subjectOrg?.name || record.subjectOrg?.name || relation.subjectOrgId" disabled />
            <SupportScopeSelector v-else :model-value="selectedOrg" placeholder="选择有权访问的主体方组织" @change="(value) => selectedOrg = value" />
          </Form.Item>
          <Form.Item label="绑定方式">
            <Radio.Group
              v-model:value="mode"
              :options="[
                { label: '选择已有主体', value: 'existing' },
                { label: '填写新主体', value: 'new' },
              ]"
            />
          </Form.Item>
          <Form.Item v-if="mode === 'existing'" label="已有主体" required>
            <LegalSubjectPicker
              v-model="selected"
              :tenant-id="relation.tenantId"
              :require-tenant="isPlatformUser(userStore.userInfo)"
            />
          </Form.Item>
          <template v-else>
            <Form.Item label="创建身份"
              ><Radio.Group
                v-model:value="mine"
                :options="[
                  { label: '商务方', value: false },
                  { label: '我的主体', value: true },
                ]"
            /></Form.Item>
            <template v-if="!mine">
              <Form.Item label="商务组织" required>
                <SupportScopeSelector :model-value="businessOrg" placeholder="选择商务组织" @change="changeBusinessOrg" />
              </Form.Item>
              <Form.Item label="商务人员" required>
                <SupportUserSelector v-model="businessUser" :scope="businessScope" />
              </Form.Item>
            </template>
            <Form.Item label="主体名称" required
              ><Input v-model:value="form.subjectName"
            /></Form.Item>
            <Form.Item label="主体类型" required
              ><Select
                v-model:value="form.subjectType"
                :options="[
                  { label: '法人', value: 'Legal' },
                  { label: '自然人', value: 'Person' },
                  { label: '个体户', value: 'Individual' },
                  { label: '非法人', value: 'NotLegal' },
                ]"
            /></Form.Item>
            <Form.Item label="简称"
              ><Input v-model:value="form.shortName"
            /></Form.Item>
            <Form.Item :label="getSubjectIdentityLabel(form)"
              ><Input v-model:value="form.unifiedCreditNo"
            /></Form.Item>
          </template>
        </template>
      </Form>
    </Spin>
    <template #footer>
      <Button :disabled="saving" @click="open = false">取消</Button>
      <Button
        v-if="relation && (!subject || canEdit)"
        type="primary"
        :loading="saving"
        @click="submit"
        >提交</Button
      >
    </template>
  </Modal>
</template>
