<script lang="ts" setup>
import type {
  DataPermissionPreviewPayload,
  DataPermissionSubjectType,
  RbacMenuNode,
  RbacModuleNode,
} from '@levin/admin-framework/framework-commons/shared/data-permission-types';
import type {
  UserOrgSelectorLoadOrgTree,
  UserOrgSelectorLoadUsers,
  UserOrgSelectorModelValue,
  UserOrgSelectorRecord,
} from '@levin/admin-framework/framework-commons/shared/user-org-selector-types';

import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Divider,
  Radio,
  Space,
  Tag,
  TypographyText,
} from 'ant-design-vue';

import DataPermissionDialog from '@levin/admin-framework/framework-commons/shared/data-permission-dialog.vue';
import ResourcePermissionTreeEditor from '@levin/admin-framework/framework-commons/shared/resource-permission-tree-editor.vue';
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

const permissionModules: RbacModuleNode[] = [
  {
    id: '__menus__',
    name: '系统菜单',
    typeList: [
      {
        id: 'menu-type',
        name: '菜单访问',
        resList: [
          {
            id: 'menu-system',
            name: '系统管理',
            actionList: [
              {
                action: '展示',
                id: 'menu-system-show',
                permissionExpr: 'default:系统菜单:系统管理:展示',
              },
            ],
          },
          {
            id: 'menu-user',
            name: '用户管理',
            actionList: [
              {
                action: '展示',
                id: 'menu-user-show',
                permissionExpr: 'default:系统菜单:用户管理:展示',
              },
              {
                action: '新增',
                id: 'menu-user-create',
                permissionExpr:
                  'com.levin.oak.base:系统数据-用户::新增',
              },
              {
                action: '修改',
                id: 'menu-user-update',
                permissionExpr:
                  'com.levin.oak.base:系统数据-用户::修改',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'oak-base',
    name: '基础业务模块',
    typeList: [
      {
        id: 'system-data',
        name: '系统数据',
        resList: [
          {
            id: 'role',
            name: '角色',
            actionList: [
              {
                action: '查询列表',
                id: 'role-list',
                permissionExpr:
                  'com.levin.oak.base:系统数据-角色::查询列表',
              },
              {
                action: '分配权限',
                id: 'role-permission',
                permissionExpr:
                  'com.levin.oak.base:系统数据-角色::分配权限',
              },
            ],
          },
          {
            id: 'user',
            name: '用户',
            actionList: [
              {
                action: '查询列表',
                id: 'user-list',
                permissionExpr:
                  'com.levin.oak.base:系统数据-用户::查询列表',
              },
              {
                action: '数据权限分配',
                id: 'user-data-permission',
                permissionExpr:
                  'com.levin.oak.base:系统数据-用户::数据权限分配',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'content-module',
    name: '内容模块',
    typeList: [
      {
        id: 'content-data',
        name: '内容数据',
        resList: [
          {
            id: 'article',
            name: '文章',
            actionList: [
              {
                action: '发布',
                id: 'article-publish',
                permissionExpr: 'com.demo.content:内容数据-文章::发布',
              },
              {
                action: '下架',
                id: 'article-offline',
                permissionExpr: 'com.demo.content:内容数据-文章::下架',
              },
            ],
          },
        ],
      },
    ],
  },
];

const permissionMenuTree: RbacMenuNode[] = [
  {
    id: 'menu-system',
    label: '系统管理',
    moduleId: 'default',
    children: [
      {
        id: 'menu-user',
        label: '用户管理',
        moduleId: 'default',
        opButtonList: [
          {
            label: '新增',
            requireAuthorization: 'com.levin.oak.base:系统数据-用户::新增',
          },
          {
            label: '修改',
            requireAuthorization: 'com.levin.oak.base:系统数据-用户::修改',
          },
        ],
      },
    ],
  },
];

const rolePreviewPayload: DataPermissionPreviewPayload = {
  detail: {
    code: 'ROLE_FINANCE_ADMIN',
    id: 'role-finance-admin',
    name: '财务管理员',
    optimisticLock: 1,
    orgScopeList: [
      {
        isAllow: true,
        orgId: 'org-hq',
        orgScopeExpression: '/**',
        orgScopeExpressionType: 'IdPath',
        tenantMatchingExpression: '_DEFAULT_TENANT_',
      },
      {
        isAllow: false,
        orgId: 'org-branch',
        orgScopeExpression: "org.type == 'Branch'",
        orgScopeExpressionType: 'Groovy',
        tenantMatchingExpression: '_DEFAULT_TENANT_',
      },
    ],
    permissionList: [
      'com.levin.oak.base:系统数据-角色::查询列表',
      'com.levin.oak.base:系统数据-用户::数据权限分配',
    ],
  },
  expressionTypes: ['IdPath', 'NamePath', 'Groovy', 'SpringEL'],
  modules: permissionModules,
  orgTree: mockOrgTree,
};

const userPreviewPayload: DataPermissionPreviewPayload = {
  detail: {
    id: 'user-zhang',
    loginName: 'zhangsan',
    name: '张三',
    optimisticLock: 3,
    orgName: '财务中心',
    orgScopeList: [
      {
        isAllow: true,
        orgId: 'org-finance',
        orgScopeExpression: '/**',
        orgScopeExpressionType: 'IdPath',
        tenantMatchingExpression: '_DEFAULT_TENANT_',
      },
    ],
  },
  expressionTypes: rolePreviewPayload.expressionTypes,
  orgTree: mockOrgTree,
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
const lastSelectorChange = ref<Record<string, any>>({});
const selectedPermissions = ref<string[]>([
  'com.levin.oak.base:系统数据-角色::查询列表',
]);
const dataPermissionOpen = ref(false);
const dataPermissionSubjectType = ref<DataPermissionSubjectType>('role');

const dataPermissionPreviewPayload = computed(() =>
  dataPermissionSubjectType.value === 'role'
    ? rolePreviewPayload
    : userPreviewPayload,
);

const selectedPermissionCount = computed(() => selectedPermissions.value.length);

const loadMockOrgTree: UserOrgSelectorLoadOrgTree = async () => mockOrgTree;

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
    description="用于本地验证公共组件集成方式，不作为业务模块菜单页面上传。"
    title="公共组件测试"
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
        </div>
      </Card>

      <Card
        class="border-border border"
        title="权限分配"
      >
        <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <ResourcePermissionTreeEditor
            v-model:value="selectedPermissions"
            :menu-tree="permissionMenuTree"
            :modules="permissionModules"
          />

          <div class="space-y-3 rounded-lg border border-border p-4">
            <div class="flex items-center justify-between gap-3">
              <div class="font-medium text-foreground">已选权限表达式</div>
              <Tag>{{ selectedPermissionCount }}</Tag>
            </div>
            <pre class="max-h-[420px] overflow-auto rounded-lg bg-muted p-3 text-xs text-foreground">{{ formatJson(selectedPermissions) }}</pre>
          </div>
        </div>
      </Card>

      <Card
        class="border-border border"
        title="数据权限分配"
      >
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="font-medium text-foreground">
              {{ dataPermissionSubjectType === 'role' ? '角色数据权限分配预览' : '用户数据权限分配预览' }}
            </div>
            <div class="text-sm text-muted-foreground">
              使用静态 previewPayload 打开共享弹窗，保存时只模拟预览模式。
            </div>
          </div>

          <Space wrap>
            <Radio.Group v-model:value="dataPermissionSubjectType" button-style="solid">
              <Radio.Button value="role">角色预览</Radio.Button>
              <Radio.Button value="user">用户预览</Radio.Button>
            </Radio.Group>
            <Button type="primary" @click="dataPermissionOpen = true">
              打开数据权限弹窗
            </Button>
          </Space>
        </div>
      </Card>
    </div>

    <DataPermissionDialog
      v-model:open="dataPermissionOpen"
      :preview-payload="dataPermissionPreviewPayload"
      :record="dataPermissionPreviewPayload.detail"
      :subject-type="dataPermissionSubjectType"
    />
  </Page>
</template>
