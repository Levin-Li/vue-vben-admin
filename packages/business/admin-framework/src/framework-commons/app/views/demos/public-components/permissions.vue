<script lang="ts" setup>
import type {
  DataPermissionPreviewPayload,
  DataPermissionSubjectType,
  PermissionTreeNode,
  RbacMenuNode,
  RbacModuleNode,
} from '@levin/admin-framework/framework-commons/shared/data-permission-types';

import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';

import DataPermissionDialog from '@levin/admin-framework/framework-commons/shared/data-permission-dialog.vue';
import ResourcePermissionTreeEditor from '@levin/admin-framework/framework-commons/shared/resource-permission-tree-editor.vue';
import { Button, Card, Radio, Space, Tag } from 'ant-design-vue';

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
];

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
                permissionExpr: 'com.levin.oak.base:系统数据-用户::新增',
              },
              {
                action: '修改',
                id: 'menu-user-update',
                permissionExpr: 'com.levin.oak.base:系统数据-用户::修改',
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
                permissionExpr: 'com.levin.oak.base:系统数据-角色::查询列表',
              },
              {
                action: '分配权限',
                id: 'role-permission',
                permissionExpr: 'com.levin.oak.base:系统数据-角色::分配权限',
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
                permissionExpr: 'com.levin.oak.base:系统数据-用户::查询列表',
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

const permissionTree: PermissionTreeNode[] = [
  {
    id: 'system',
    name: '系统管理',
    nodeType: 'Group',
    remark: '仅用于组织系统管理相关权限',
    children: [
      {
        id: 'role',
        name: '角色',
        nodeType: 'Resource',
        remark: '角色资源下的操作权限',
        children: [
          {
            id: 'role-list',
            name: '查询列表',
            nodeType: 'Action',
            permissionExpr: 'com.levin.oak.base:系统数据-角色::查询列表',
            remark: '允许查看角色列表',
          },
          {
            id: 'role-permission',
            name: '分配权限',
            nodeType: 'Action',
            permissionExpr: 'com.levin.oak.base:系统数据-角色::分配权限',
            remark: '允许打开角色权限分配弹窗',
          },
        ],
      },
      {
        id: 'user',
        name: '用户',
        nodeType: 'Resource',
        remark: '用户资源下的操作权限',
        children: [
          {
            id: 'user-list',
            name: '查询列表',
            nodeType: 'Action',
            permissionExpr: 'com.levin.oak.base:系统数据-用户::查询列表',
            remark: '允许查看用户列表',
            dataAttrs: [
              {
                attribute: 'category',
                entityClass: 'com.example.User',
                name: '用户类别',
                sourceKind: 'enum',
                sourceKey: 'com.example.UserCategory',
                values: [
                  {
                    name: 'Customer',
                    label: '客户',
                    permissionExpr: 'demo:enum:customer',
                  },
                  {
                    name: 'Supplier',
                    label: '供应商',
                    permissionExpr: 'demo:enum:supplier',
                  },
                ],
              },
              {
                attribute: 'level',
                entityClass: 'com.example.User',
                name: '客户等级',
                sourceKind: 'dict',
                sourceKey: 'demo.customer.level',
                values: [
                  {
                    name: 'VIP',
                    label: '重要客户',
                    permissionExpr: 'demo:dict:vip',
                  },
                  {
                    name: 'NORMAL',
                    label: '普通客户',
                    permissionExpr: 'demo:dict:normal',
                  },
                ],
              },
            ],
          },
          {
            id: 'user-data-permission',
            name: '数据权限分配',
            nodeType: 'Action',
            permissionExpr: 'com.levin.oak.base:系统数据-用户::数据权限分配',
            remark: '允许维护用户数据权限',
          },
        ],
      },
    ],
  },
  {
    id: 'content',
    name: '内容管理',
    nodeType: 'Group',
    children: [
      {
        id: 'article',
        name: '文章发布',
        nodeType: 'Action',
        permissionExpr: 'com.demo.content:内容数据-文章::发布',
        remark: '允许发布内容文章',
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
        orgScopeMatchingMode: 'All',
        orgScopeExpressionType: 'IdPath',
        tenantMatchingExpression: '_DEFAULT_TENANT_',
      },
      {
        isAllow: false,
        orgId: 'org-branch',
        orgScopeExpression: "org.type == 'Branch'",
        orgScopeMatchingMode: 'Custom',
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
        orgScopeMatchingMode: 'All',
        orgScopeExpressionType: 'IdPath',
        tenantMatchingExpression: '_DEFAULT_TENANT_',
      },
    ],
  },
  expressionTypes: rolePreviewPayload.expressionTypes,
  orgTree: mockOrgTree,
};

const selectedPermissions = ref<string[]>([
  'com.levin.oak.base:系统数据-角色::查询列表',
  'com.levin.oak.base:系统数据-用户::查询列表',
]);
const dataPermissionOpen = ref(false);
const dataPermissionSubjectType = ref<DataPermissionSubjectType>('role');

const dataPermissionPreviewPayload = computed(() =>
  dataPermissionSubjectType.value === 'role'
    ? rolePreviewPayload
    : userPreviewPayload,
);

const selectedPermissionCount = computed(
  () => selectedPermissions.value.length,
);

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}
</script>

<template>
  <Page description="按权限分配业务拆分的公共组件演示页面。" title="权限分配">
    <div class="space-y-5">
      <Card class="border-border border" title="资源权限分配">
        <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <ResourcePermissionTreeEditor
            v-model:value="selectedPermissions"
            :menu-tree="permissionMenuTree"
            :modules="permissionModules"
            :permission-tree="permissionTree"
          />

          <div class="border-border space-y-3 rounded-lg border p-4">
            <div class="flex items-center justify-between gap-3">
              <div class="text-foreground font-medium">已选权限表达式</div>
              <Tag>{{ selectedPermissionCount }}</Tag>
            </div>
            <pre
              class="bg-muted text-foreground max-h-[420px] overflow-auto rounded-lg p-3 text-xs"
              v-text="formatJson(selectedPermissions)"
            ></pre>
          </div>
        </div>
      </Card>

      <Card class="border-border border" title="数据权限分配">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="text-foreground font-medium">
              {{
                dataPermissionSubjectType === 'role'
                  ? '角色数据权限分配预览'
                  : '用户数据权限分配预览'
              }}
            </div>
            <div class="text-muted-foreground text-sm">
              使用静态 previewPayload 打开共享弹窗，保存时只模拟预览模式。
            </div>
          </div>

          <Space wrap>
            <Radio.Group
              v-model:value="dataPermissionSubjectType"
              button-style="solid"
            >
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
