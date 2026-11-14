<script setup lang="ts">
import type { RobotNotifyGroupRecord } from '../../api/robot-notify-group-service';

import { computed, ref } from 'vue';

import { useUserStore } from '@vben/runtime/stores';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { Form, Input, message, Modal } from 'ant-design-vue';

import { robotNotifyGroupService } from '../../api/robot-notify-group-service';
import CrudPage from '../crud-page.vue';
import {
  canManageRobotWebhook,
  canTestSendRobotNotifyGroup,
  robotNotifyGroupPageCrudConfig,
} from './config';

const userStore = useUserStore();
const canManageCredential = computed(() =>
  canManageRobotWebhook(userStore.userInfo),
);

// 行操作只在当前列表记录包含非空地址时出现，真正发送前仍由服务端重新校验。
const testTarget = ref<null | RobotNotifyGroupRecord>(null);
const testContent = ref('这是一条机器人通知群测试消息。');
const testSending = ref(false);

async function submitTestSend() {
  const target = testTarget.value;
  const content = testContent.value.trim();
  if (!target) return;
  if (!content) {
    message.error('请输入测试发送内容');
    return;
  }
  testSending.value = true;
  try {
    await robotNotifyGroupService.sendTest({
      content,
      id: target.id,
      orgId: target.orgId,
      tenantId: target.tenantId,
    });
    message.success('测试消息发送成功');
    testTarget.value = null;
  } catch {
    // 请求层显示服务端的安全错误消息，失败时保留内容供修改重试。
  } finally {
    testSending.value = false;
  }
}

// 组织共享只扩大配置的可见范围，不把其它组织的 Webhook 凭据交给组织管理员。
const pageConfig = computed(() => ({
  ...robotNotifyGroupPageCrudConfig,
  allowCreate: canManageCredential.value,
  allowDelete: canManageCredential.value,
  allowEdit: canManageCredential.value,
  fields: robotNotifyGroupPageCrudConfig.fields.filter(
    (field) => field.key !== 'webhookUrl' || canManageCredential.value,
  ),
  rowActions: [
    ...(robotNotifyGroupPageCrudConfig.rowActions || []),
    {
      displayKey: 'sendTest',
      handler: async (record: RobotNotifyGroupRecord) => {
        testContent.value = '这是一条机器人通知群测试消息。';
        testTarget.value = record;
      },
      label: '测试发送',
      permission: buildApiMethodPermissions(
        robotNotifyGroupService,
        'sendTest',
      ),
      reloadAfterAction: false,
      successMessage: false as const,
      visible: (record: Record<string, any>) =>
        canTestSendRobotNotifyGroup(record, canManageCredential.value),
    },
  ],
}));
</script>

<template>
  <CrudPage :config="pageConfig" />
  <Modal
    :open="Boolean(testTarget)"
    :confirm-loading="testSending"
    title="测试发送"
    @cancel="testTarget = null"
    @ok="submitTestSend"
  >
    <Form
      id="robot-notify-group-test-send"
      name="robotNotifyGroupTestSend"
      data-form-id="robot-notify-group-test-send"
      data-form-name="机器人通知群测试发送"
      layout="vertical"
    >
      <Form.Item label="发送内容" required>
        <Input.TextArea
          v-model:value="testContent"
          :maxlength="2000"
          :rows="5"
          show-count
          placeholder="请输入要发送到该通知群的文本"
        />
      </Form.Item>
    </Form>
  </Modal>
</template>
