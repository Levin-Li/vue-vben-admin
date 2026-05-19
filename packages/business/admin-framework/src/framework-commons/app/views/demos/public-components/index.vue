<script lang="ts" setup>
import type {
  UserOrgSelectorLoadOrgTree,
  UserOrgSelectorLoadUsers,
  UserOrgSelectorModelValue,
  UserOrgSelectorRecord,
} from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Card,
  Divider,
  TypographyText,
} from 'ant-design-vue';

import UserOrgSelector from '@levin/admin-framework/framework-commons/shared/user-org-selector.vue';

const mockOrgTree = [
  {
    id: 'org-hq',
    name: '集团总部',
    type: 'Company',
    children: [
      {
        id: 'org-finance',
        name: '财务中心',
        type: 'Dept',
      },
      {
        id: 'org-product',
        name: '产品中心',
        type: 'Dept',
      },
    ],
  },
  {
    id: 'org-branch',
    name: '华东分部',
    type: 'Branch',
    children: [
      {
        id: 'org-shanghai',
        name: '上海办公室',
        type: 'Dept',
      },
    ],
  },
];

const mockUsersByOrg: Record<string, Record<string, any>[]> = {
  'org-branch': [
    {
      id: 'user-chen',
      loginName: 'chenyi',
      name: '陈一',
      orgId: 'org-branch',
      orgName: '华东分部',
      type: 'Employee',
    },
  ],
  'org-finance': [
    {
      id: 'user-zhang',
      loginName: 'zhangsan',
      name: '张三',
      orgId: 'org-finance',
      orgName: '财务中心',
      type: 'Employee',
    },
    {
      id: 'user-li',
      loginName: 'lisi',
      name: '李四',
      orgId: 'org-finance',
      orgName: '财务中心',
      type: 'Manager',
    },
  ],
  'org-hq': [
    {
      id: 'user-admin',
      loginName: 'admin',
      name: '平台管理员',
      orgId: 'org-hq',
      orgName: '集团总部',
      type: 'Admin',
    },
  ],
  'org-product': [
    {
      id: 'user-wang',
      loginName: 'wangwu',
      name: '王五',
      orgId: 'org-product',
      orgName: '产品中心',
      type: 'Employee',
    },
  ],
  'org-shanghai': [
    {
      id: 'user-zhao',
      loginName: 'zhaoliu',
      name: '赵六',
      orgId: 'org-shanghai',
      orgName: '上海办公室',
      type: 'Employee',
    },
  ],
};

const lazyOrgChildrenByParent: Record<string, Record<string, any>[]> = {
  'lazy-dept': [
    {
      id: 'lazy-team',
      name: '懒加载研发小组',
      type: 'Team',
    },
  ],
  'lazy-empty': [],
  'lazy-root': [
    {
      id: 'lazy-dept',
      name: '懒加载研发部',
      type: 'Dept',
    },
    {
      id: 'lazy-empty',
      name: '尝试后无下级',
      type: 'Dept',
    },
  ],
};

const singleValue = ref<UserOrgSelectorModelValue>();
const singleRecords = ref<UserOrgSelectorRecord[]>([]);
const multiValue = ref<UserOrgSelectorModelValue>([]);
const multiRecords = ref<UserOrgSelectorRecord[]>([]);
const orgOnlyValue = ref<UserOrgSelectorModelValue>();
const orgOnlyRecords = ref<UserOrgSelectorRecord[]>([]);
const userOnlyValue = ref<UserOrgSelectorModelValue>();
const userOnlyRecords = ref<UserOrgSelectorRecord[]>([]);
const recordValue = ref<UserOrgSelectorModelValue>([]);
const recordRecords = ref<UserOrgSelectorRecord[]>([]);
const advancedValue = ref<UserOrgSelectorModelValue>([]);
const advancedRecords = ref<UserOrgSelectorRecord[]>([]);
const lazyValue = ref<UserOrgSelectorModelValue>([]);
const lazyRecords = ref<UserOrgSelectorRecord[]>([]);
const lazyLoadLog = ref<Record<string, any>[]>([]);
const lastSelectorChange = ref<Record<string, any>>({});

const loadMockOrgTree: UserOrgSelectorLoadOrgTree = async () => mockOrgTree;

const loadLazyMockOrgTree: UserOrgSelectorLoadOrgTree = async (context) => {
  lazyLoadLog.value = [
    ...lazyLoadLog.value,
    {
      depth: context.depth,
      parentOrgId: context.parentOrgId || null,
    },
  ];

  if (!context.parentOrgId) {
    return [
      {
        id: 'lazy-root',
        name: '懒加载根组织',
        type: 'Company',
      },
    ];
  }

  return lazyOrgChildrenByParent[context.parentOrgId] || [];
};

const loadMockUsers: UserOrgSelectorLoadUsers = async ({ orgId, userTypes }) => {
  const users = mockUsersByOrg[orgId] || [];

  if (userTypes.length === 0) {
    return users;
  }

  return users.filter((item) => userTypes.includes(String(item.type || '')));
};

function captureSelectorChange(
  scene: string,
  selected: null | UserOrgSelectorRecord | UserOrgSelectorRecord[],
  value: UserOrgSelectorModelValue,
) {
  lastSelectorChange.value = {
    scene,
    selected,
    value,
  };
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}
</script>

<template>
  <Page
    description="按组织和用户选择业务拆分的公共组件演示页面。"
    title="组织用户选择器"
  >
    <div class="space-y-5">
      <Card
        class="border-border border"
        title="用户与组织选择"
      >
        <div class="grid gap-4 xl:grid-cols-2">
          <div class="space-y-3 rounded-lg border border-border p-4">
            <div>
              <div class="font-medium text-foreground">单选用户或组织</div>
              <div class="text-sm text-muted-foreground">
                使用静态组织树和用户数据，输出 id 值与已选记录。
              </div>
            </div>
            <UserOrgSelector
              v-model="singleValue"
              v-model:selected-records="singleRecords"
              :load-org-tree="loadMockOrgTree"
              :load-users="loadMockUsers"
              placeholder="选择一个用户或组织"
              @change="(selected, value) => captureSelectorChange('single', selected, value)"
            />
            <pre class="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs text-foreground">{{ formatJson({
              modelValue: singleValue,
              selectedRecords: singleRecords,
            }) }}</pre>
          </div>

          <div class="space-y-3 rounded-lg border border-border p-4">
            <div>
              <div class="font-medium text-foreground">多选用户和组织</div>
              <div class="text-sm text-muted-foreground">
                验证多选数组输出和批量选择回显。
              </div>
            </div>
            <UserOrgSelector
              v-model="multiValue"
              v-model:selected-records="multiRecords"
              :load-org-tree="loadMockOrgTree"
              :load-users="loadMockUsers"
              multiple
              placeholder="选择多个用户或组织"
              @change="(selected, value) => captureSelectorChange('multiple', selected, value)"
            />
            <pre class="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs text-foreground">{{ formatJson({
              modelValue: multiValue,
              selectedRecords: multiRecords,
            }) }}</pre>
          </div>

          <div class="space-y-3 rounded-lg border border-border p-4">
            <div>
              <div class="font-medium text-foreground">仅组织</div>
              <div class="text-sm text-muted-foreground">
                配置 <TypographyText code>mode="org"</TypographyText>，只允许选择组织节点。
              </div>
            </div>
            <UserOrgSelector
              v-model="orgOnlyValue"
              v-model:selected-records="orgOnlyRecords"
              :load-org-tree="loadMockOrgTree"
              mode="org"
              placeholder="只选择组织"
              @change="(selected, value) => captureSelectorChange('org-only', selected, value)"
            />
            <pre class="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs text-foreground">{{ formatJson({
              modelValue: orgOnlyValue,
              selectedRecords: orgOnlyRecords,
            }) }}</pre>
          </div>

          <div class="space-y-3 rounded-lg border border-border p-4">
            <div>
              <div class="font-medium text-foreground">仅用户和 record 值模式</div>
              <div class="text-sm text-muted-foreground">
                分别验证 <TypographyText code>mode="user"</TypographyText> 与
                <TypographyText code>valueMode="record"</TypographyText>。
              </div>
            </div>
            <UserOrgSelector
              v-model="userOnlyValue"
              v-model:selected-records="userOnlyRecords"
              :load-org-tree="loadMockOrgTree"
              :load-users="loadMockUsers"
              mode="user"
              placeholder="只选择用户"
              @change="(selected, value) => captureSelectorChange('user-only', selected, value)"
            />
            <Divider class="my-2" />
            <UserOrgSelector
              v-model="recordValue"
              v-model:selected-records="recordRecords"
              :load-org-tree="loadMockOrgTree"
              :load-users="loadMockUsers"
              multiple
              placeholder="选择后输出完整记录"
              value-mode="record"
              @change="(selected, value) => captureSelectorChange('record-mode', selected, value)"
            />
            <pre class="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs text-foreground">{{ formatJson({
              userOnly: {
                modelValue: userOnlyValue,
                selectedRecords: userOnlyRecords,
              },
              recordMode: {
                modelValue: recordValue,
                selectedRecords: recordRecords,
              },
              lastChange: lastSelectorChange,
            }) }}</pre>
          </div>

          <div class="space-y-3 rounded-lg border border-border p-4">
            <div>
              <div class="font-medium text-foreground">高级组织选择参数</div>
              <div class="text-sm text-muted-foreground">
                限制组织类型、只允许选择叶子组织，并最多选择 2 项。
              </div>
            </div>
            <UserOrgSelector
              v-model="advancedValue"
              v-model:selected-records="advancedRecords"
              :allow-select-user="false"
              :load-org-tree="loadMockOrgTree"
              :max-select-count="2"
              :org-types="['Dept']"
              mode="org"
              multiple
              only-leaf-node
              placeholder="最多选择 2 个部门叶子节点"
              @change="(selected, value) => captureSelectorChange('advanced-org', selected, value)"
            />
            <pre class="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs text-foreground">{{ formatJson({
              modelValue: advancedValue,
              selectedRecords: advancedRecords,
            }) }}</pre>
          </div>

          <div class="space-y-3 rounded-lg border border-border p-4 xl:col-span-2">
            <div>
              <div class="font-medium text-foreground">懒加载组织树</div>
              <div class="text-sm text-muted-foreground">
                展开前不依赖后端子节点数量；展开尝试后再根据返回结果决定是否继续显示展开入口。
              </div>
            </div>
            <UserOrgSelector
              v-model="lazyValue"
              v-model:selected-records="lazyRecords"
              :allow-select-user="false"
              :load-org-tree="loadLazyMockOrgTree"
              mode="org"
              multiple
              org-load-mode="lazy"
              placeholder="展开懒加载根组织后再选择"
              @change="(selected, value) => captureSelectorChange('lazy-org', selected, value)"
            />
            <pre class="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs text-foreground">{{ formatJson({
              modelValue: lazyValue,
              selectedRecords: lazyRecords,
              loadLog: lazyLoadLog,
            }) }}</pre>
          </div>
        </div>
      </Card>
    </div>
  </Page>
</template>
