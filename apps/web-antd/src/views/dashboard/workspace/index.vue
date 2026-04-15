<script lang="ts" setup>
import type {
  WorkbenchProjectItem,
  WorkbenchQuickNavItem,
  WorkbenchTodoItem,
  WorkbenchTrendItem,
} from '@vben/common-ui';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  AnalysisChartCard,
  WorkbenchHeader,
  WorkbenchProject,
  WorkbenchQuickNav,
  WorkbenchTodo,
  WorkbenchTrends,
} from '@vben/common-ui';
import { preferences } from '@vben/preferences';
import { useUserStore } from '@vben/stores';
import { openWindow } from '@vben/utils';

import AnalyticsVisitsSource from '../analytics/analytics-visits-source.vue';

const userStore = useUserStore();

// 这是一个示例数据，实际项目中需要根据实际情况进行调整
// url 也可以是内部路由，在 navTo 方法中识别处理，进行内部跳转
// 例如：url: /dashboard/workspace
const projectItems: WorkbenchProjectItem[] = [
  {
    color: '#2563eb',
    content: '维护角色编码、权限表达式与继承关系，避免越权分配。',
    date: '基础模块',
    group: '系统管理',
    icon: 'lucide:badge-check',
    title: '角色管理',
    url: '/clob/V1/Role',
  },
  {
    color: '#16a34a',
    content: '配置菜单、路由与页面入口，支持本地页和 AMIS 页面联动。',
    date: '基础模块',
    group: '系统管理',
    icon: 'lucide:menu-square',
    title: '菜单管理',
    url: '/clob/V1/Menu',
  },
  {
    color: '#f59e0b',
    content: '维护组织树和授权组织范围，为用户归属与数据权限提供基础。',
    date: '基础模块',
    group: '组织权限',
    icon: 'lucide:building-2',
    title: '组织管理',
    url: '/clob/V1/Org',
  },
  {
    color: '#dc2626',
    content: '管理登录账号、角色分配和可登录域名约束。',
    date: '基础模块',
    group: '组织权限',
    icon: 'lucide:users',
    title: '用户管理',
    url: '/clob/V1/User',
  },
  {
    color: '#0ea5e9',
    content: '维护平台字典项，支持表单枚举、规则配置和基础数据复用。',
    date: '基础模块',
    group: '平台配置',
    icon: 'lucide:book-copy',
    title: '数据字典',
    url: '/clob/V1/Dict',
  },
  {
    color: '#7c3aed',
    content: '处理租户资料、站点域名、SSL 与后台页面代理入口。',
    date: '基础模块',
    group: '多租户',
    icon: 'lucide:globe',
    title: '租户站点',
    url: '/clob/V1/TenantSite',
  },
  {
    color: '#0891b2',
    content: '查看登录、接口与业务访问记录，便于排查租户与权限链路问题。',
    date: '运维支持',
    group: '审计监控',
    icon: 'lucide:history',
    title: '访问日志',
    url: '/clob/V1/AccessLog',
  },
  {
    color: '#475569',
    content: '维护平台级参数与运行时配置，方便和旧后台页面协同工作。',
    date: '运维支持',
    group: '平台配置',
    icon: 'lucide:settings-2',
    title: '系统设置',
    url: '/clob/V1/Setting',
  },
];

// 同样，这里的 url 也可以使用以 http 开头的外部链接
const quickNavItems: WorkbenchQuickNavItem[] = [
  {
    color: '#2563eb',
    icon: 'lucide:badge-check',
    title: '角色管理',
    url: '/clob/V1/Role',
  },
  {
    color: '#16a34a',
    icon: 'lucide:menu-square',
    title: '菜单管理',
    url: '/clob/V1/Menu',
  },
  {
    color: '#f59e0b',
    icon: 'lucide:building-2',
    title: '组织管理',
    url: '/clob/V1/Org',
  },
  {
    color: '#dc2626',
    icon: 'lucide:users',
    title: '用户管理',
    url: '/clob/V1/User',
  },
  {
    color: '#0ea5e9',
    icon: 'lucide:landmark',
    title: '租户管理',
    url: '/clob/V1/Tenant',
  },
  {
    color: '#7c3aed',
    icon: 'lucide:globe',
    title: '租户站点',
    url: '/clob/V1/TenantSite',
  },
  {
    color: '#4f46e5',
    icon: 'lucide:user',
    title: '个人中心',
    url: '/profile',
  },
  {
    color: '#0891b2',
    icon: 'lucide:monitor',
    title: '后台首页',
    url: '/admin',
  },
  {
    color: '#0f766e',
    icon: 'lucide:history',
    title: '访问日志',
    url: '/clob/V1/AccessLog',
  },
  {
    color: '#475569',
    icon: 'lucide:settings-2',
    title: '系统设置',
    url: '/clob/V1/Setting',
  },
  {
    color: '#7c2d12',
    icon: 'lucide:box',
    title: '服务插件',
    url: '/clob/V1/ServicePlugin',
  },
  {
    color: '#6d28d9',
    icon: 'lucide:wand-sparkles',
    title: '在线代码生成',
    url: '/clob/V1/OnlineCodeGen',
  },
];

const todoItems = ref<WorkbenchTodoItem[]>([
  {
    completed: false,
    content: `梳理超级管理员可见的角色与权限范围，确认前台创建和编辑动作不越权。`,
    date: '今日',
    title: '复核角色授权边界',
  },
  {
    completed: true,
    content: `确认 Spring Boot 4 与 Hibernate 7 的 dev 环境已经稳定启动。`,
    date: '今日',
    title: '后端启动验证',
  },
  {
    completed: false,
    content: `补充租户站点域名申请与 DNS 自动提示，降低站点初始化成本。`,
    date: '今日',
    title: '完善租户站点流程',
  },
  {
    completed: false,
    content: `继续扩大 Playwright 覆盖，把基础管理模块页面纳入浏览器回归。`,
    date: '今日',
    title: '补齐前端自动化',
  },
  {
    completed: false,
    content: `根据实际业务再补租户、租户站点、用户管理的表单细节。`,
    date: '本周',
    title: '收口核心后台页面',
  },
]);
const trendItems: WorkbenchTrendItem[] = [
  {
    avatar: 'svg:avatar-1',
    content: `已经接通 <a>角色管理</a>、<a>菜单管理</a>、<a>组织管理</a> 等核心后台页面。`,
    date: '刚刚',
    title: '联调进展',
  },
  {
    avatar: 'svg:avatar-2',
    content: `前端代理链已可访问 <a>/admin</a>，AMIS 页面和本地页现在可以在同一套导航里并存。`,
    date: '10分钟前',
    title: '管理后台',
  },
  {
    avatar: 'svg:avatar-3',
    content: `租户站点页已接入 <a>可选域名后缀</a> 和 <a>公网IP</a> 辅助信息。`,
    date: '20分钟前',
    title: '租户站点',
  },
  {
    avatar: 'svg:avatar-4',
    content: `浏览器端 <a>Playwright</a> 冒烟测试已开始覆盖核心后台页面和 iframe 回退页面。`,
    date: '30分钟前',
    title: '自动化验证',
  },
];

const router = useRouter();

// 这是一个示例方法，实际项目中需要根据实际情况进行调整
// This is a sample method, adjust according to the actual project requirements
function navTo(nav: WorkbenchProjectItem | WorkbenchQuickNavItem) {
  if (nav.url?.startsWith('http')) {
    openWindow(nav.url);
    return;
  }
  if (nav.url?.startsWith('/')) {
    router.push(nav.url).catch((error) => {
      console.error('Navigation failed:', error);
    });
  } else {
    console.warn(`Unknown URL for navigation item: ${nav.title} -> ${nav.url}`);
  }
}
</script>

<template>
  <div class="p-5">
    <WorkbenchHeader
      :avatar="userStore.userInfo?.avatar || preferences.app.defaultAvatar"
    >
      <template #title>
        早安, {{ userStore.userInfo?.realName }}, 开始您一天的工作吧！
      </template>
      <template #description> 今日晴，20℃ - 32℃！ </template>
    </WorkbenchHeader>

    <div class="mt-5 flex flex-col lg:flex-row">
      <div class="mr-4 w-full lg:w-3/5">
        <WorkbenchProject :items="projectItems" title="项目" @click="navTo" />
        <WorkbenchTrends :items="trendItems" class="mt-5" title="最新动态" />
      </div>
      <div class="w-full lg:w-2/5">
        <WorkbenchQuickNav
          :items="quickNavItems"
          class="mt-5 lg:mt-0"
          title="快捷导航"
          @click="navTo"
        />
        <WorkbenchTodo :items="todoItems" class="mt-5" title="待办事项" />
        <AnalysisChartCard class="mt-5" title="访问来源">
          <AnalyticsVisitsSource />
        </AnalysisChartCard>
      </div>
    </div>
  </div>
</template>
