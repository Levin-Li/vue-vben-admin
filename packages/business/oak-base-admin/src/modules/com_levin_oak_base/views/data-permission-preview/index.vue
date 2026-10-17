<script lang="ts" setup>
import type {
  DataPermissionPreviewPayload,
  DataPermissionSubjectType,
  PermissionTreeNode,
} from '@levin/admin-framework/framework-commons/shared/data-permission-types';

import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';

import DataPermissionDialog from '@levin/admin-framework/framework-commons/shared/data-permission-dialog.vue';
import ResourcePermissionTreeEditor from '@levin/admin-framework/framework-commons/shared/resource-permission-tree-editor.vue';
import { Button, Card, Radio, Space } from 'ant-design-vue';

const attrGroupPermissions = ref<string[]>(['preview:合同::试算']);
// 仅用于界面演示，实际属性组及权限表达式由后端提供。
const attrGroupTree: PermissionTreeNode[] = [
  {
    id: 'attr-demo',
    name: '属性组示例',
    nodeType: 'Module',
    children: [
      {
        id: 'attr-contract',
        name: '合同',
        nodeType: 'Resource',
        children: [
          {
            id: 'attr-calculate',
            name: '试算',
            nodeType: 'Action',
            permissionExpr: 'preview:合同::试算',
            attrGroups: [
              {
                name: '财务信息',
                permissionExpr: 'preview:属性组:合同财务:试算',
                attributes: ['合同金额', '税率', '结算账号'],
              },
            ],
          },
          {
            id: 'attr-normal',
            name: '普通查询（无属性组）',
            nodeType: 'Action',
            permissionExpr: 'preview:合同::查询',
          },
        ],
      },
    ],
  },
];
const open = ref(false);
const subjectType = ref<DataPermissionSubjectType>('role');

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
        orgId: 'org-temp',
        orgScopeExpression: "org.type == 'TempOrg'",
        orgScopeMatchingMode: 'Custom',
        orgScopeExpressionType: 'Groovy',
        tenantMatchingExpression: '_DEFAULT_TENANT_',
      },
    ],
    permissionList: [
      'com.levin.oak.base:系统数据-角色::查看详情',
      'legacy:permission:*:audit',
    ],
  },
  orgTree: [
    {
      id: 'org-hq',
      name: '集团总部',
      children: [
        {
          id: 'org-finance',
          name: '财务中心',
        },
        {
          id: 'org-temp',
          name: '临时项目组',
        },
      ],
    },
  ],
  modules: [
    {
      id: 'module-rbac',
      name: 'RBAC 管理',
      typeList: [
        {
          id: 'type-system',
          name: '系统数据',
          resList: [
            {
              id: 'res-role',
              name: '角色',
              actionList: [
                {
                  action: '查看详情',
                  id: 'action-role-view',
                  permissionExpr: 'com.levin.oak.base:系统数据-角色::查看详情',
                },
                {
                  action: '修改',
                  id: 'action-role-update',
                  permissionExpr: 'com.levin.oak.base:系统数据-角色::修改',
                },
              ],
            },
            {
              id: 'res-user',
              name: '用户',
              actionList: [
                {
                  action: '查询列表',
                  id: 'action-user-list',
                  permissionExpr: 'com.levin.oak.base:系统数据-用户::查询列表',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'module-content',
      name: '内容管理',
      typeList: [
        {
          id: 'type-business',
          name: '业务数据',
          resList: [
            {
              id: 'res-article',
              name: '文章',
              actionList: [
                {
                  action: '发布',
                  id: 'action-article-publish',
                  permissionExpr: 'com.levin.oak.base:业务数据-文章::发布',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const userPreviewPayload: DataPermissionPreviewPayload = {
  detail: {
    id: 'user-zhangsan',
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
  orgTree: rolePreviewPayload.orgTree,
};

const previewPayload = computed(() =>
  subjectType.value === 'role' ? rolePreviewPayload : userPreviewPayload,
);

const cardTitle = computed(() =>
  subjectType.value === 'role'
    ? '角色数据权限分配预览'
    : '用户数据权限分配预览',
);
</script>

<template>
  <Page
    description="这个页面不依赖后端接口，专门用于本地预览和手动检查数据权限分配界面。"
    title="数据权限分配预览"
  >
    <Card>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="space-y-2">
          <div class="text-lg font-semibold">{{ cardTitle }}</div>
          <div class="text-sm text-slate-500">
            可在这里切换角色/用户预览，并直接打开共享数据权限弹窗。
          </div>
        </div>

        <Space wrap>
          <Radio.Group v-model:value="subjectType" button-style="solid">
            <Radio.Button value="role">角色预览</Radio.Button>
            <Radio.Button value="user">用户预览</Radio.Button>
          </Radio.Group>
          <Button type="primary" @click="open = true">打开预览弹窗</Button>
        </Space>
      </div>
    </Card>

    <Card class="mt-4" title="属性组授权示例">
      <ResourcePermissionTreeEditor
        v-model:value="attrGroupPermissions"
        :permission-tree="attrGroupTree"
      />
    </Card>

    <DataPermissionDialog
      v-model:open="open"
      :preview-payload="previewPayload"
      :record="previewPayload.detail"
      :subject-type="subjectType"
    />
  </Page>
</template>
