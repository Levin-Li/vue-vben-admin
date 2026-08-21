export interface MenuIconOption {
  icon: string;
  label: string;
}

export interface MenuIconGroup {
  id: string;
  label: string;
  options: MenuIconOption[];
}

const lucide = (name: string, label: string): MenuIconOption => ({
  icon: `lucide:${name}`,
  label,
});

/**
 * 后台菜单常用的 Lucide 图标。保持该清单小而稳定，避免菜单编辑依赖远程图标集合。
 */
export const MENU_ICON_GROUPS: MenuIconGroup[] = [
  {
    id: 'navigation',
    label: '导航',
    options: [
      lucide('house', '首页'),
      lucide('layout-dashboard', '仪表盘'),
      lucide('panel-left', '侧边栏'),
      lucide('menu', '菜单'),
      lucide('app-window', '应用'),
      lucide('folder-tree', '目录树'),
      lucide('layers-3', '分层'),
      lucide('search', '搜索'),
    ],
  },
  {
    id: 'organization',
    label: '组织与用户',
    options: [
      lucide('building-2', '组织'),
      lucide('briefcase-business', '企业'),
      lucide('users-round', '用户组'),
      lucide('user-round', '用户'),
      lucide('user-cog', '用户设置'),
      lucide('contact', '联系人'),
      lucide('badge-check', '认证用户'),
      lucide('crown', '管理员'),
    ],
  },
  {
    id: 'security',
    label: '权限与安全',
    options: [
      lucide('shield-check', '权限'),
      lucide('key-round', '密钥'),
      lucide('lock-keyhole', '锁定'),
      lucide('fingerprint', '身份验证'),
      lucide('scan-line', '扫码'),
      lucide('eye', '查看'),
      lucide('file-key-2', '凭据文件'),
      lucide('circle-check-big', '安全校验'),
    ],
  },
  {
    id: 'business',
    label: '业务与数据',
    options: [
      lucide('clipboard-list', '任务清单'),
      lucide('file-text', '文档'),
      lucide('notebook-tabs', '知识库'),
      lucide('database', '数据'),
      lucide('table-properties', '数据表'),
      lucide('boxes', '资源包'),
      lucide('package', '包管理'),
      lucide('tags', '标签'),
    ],
  },
  {
    id: 'analytics',
    label: '统计与财务',
    options: [
      lucide('chart-no-axes-combined', '趋势图'),
      lucide('chart-pie', '占比图'),
      lucide('circle-gauge', '指标'),
      lucide('badge-dollar-sign', '金额'),
      lucide('wallet-cards', '钱包'),
      lucide('credit-card', '银行卡'),
      lucide('receipt-text', '账单'),
      lucide('landmark', '银行'),
    ],
  },
  {
    id: 'system',
    label: '系统与运维',
    options: [
      lucide('settings', '系统设置'),
      lucide('settings-2', '配置'),
      lucide('sliders-horizontal', '参数'),
      lucide('wrench', '维护'),
      lucide('monitor-cog', '控制台'),
      lucide('server', '服务器'),
      lucide('cloud', '云服务'),
      lucide('plug-zap', '插件'),
    ],
  },
  {
    id: 'development',
    label: '开发集成',
    options: [
      lucide('workflow', '工作流'),
      lucide('git-branch', '代码分支'),
      lucide('terminal', '终端'),
      lucide('code-2', '代码'),
      lucide('webhook', 'Webhook'),
      lucide('link', '连接'),
      lucide('external-link', '外部链接'),
      lucide('bot', '自动化'),
    ],
  },
  {
    id: 'communication',
    label: '通知与通用',
    options: [
      lucide('bell', '通知'),
      lucide('mail', '邮件'),
      lucide('message-square', '消息'),
      lucide('send', '发送'),
      lucide('calendar-days', '日历'),
      lucide('clock-3', '时间'),
      lucide('map-pin', '位置'),
      lucide('globe-2', '站点'),
    ],
  },
];

export const MENU_ICON_OPTIONS = MENU_ICON_GROUPS.flatMap(
  (group) => group.options,
);
