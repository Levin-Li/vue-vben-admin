import type {
  AccessModeType,
  AuthPageLayoutType,
  BreadcrumbStyleType,
  BuiltinThemeType,
  ContentCompactType,
  DeepPartial,
  LayoutHeaderMenuAlignType,
  LayoutHeaderModeType,
  LayoutType,
  LoginExpiredModeType,
  NavigationStyleType,
  PageTransitionType,
  PreferencesButtonPositionType,
  TabsStyleType,
  ThemeModeType,
} from '@vben-core/typings';

type SupportedLanguagesType = 'en-US' | 'zh-CN';

interface AppPreferences {
  /** 权限模式 */
  accessMode: AccessModeType;
  /** 登录注册页面布局 */
  authPageLayout: AuthPageLayoutType;
  /** 检查更新轮询时间 */
  checkUpdatesInterval: number;
  /** 是否开启灰色模式 */
  colorGrayMode: boolean;
  /** 是否开启色弱模式 */
  colorWeakMode: boolean;
  /** 是否开启紧凑模式 */
  compact: boolean;
  /** 是否开启内容紧凑模式 */
  contentCompact: ContentCompactType;
  /** 内容紧凑宽度 */
  contentCompactWidth: number;
  /** 内容内边距 */
  contentPadding: number;
  /** 内容底部外边距 */
  contentMarginBottom: number;
  /** 内容左侧外边距 */
  contentMarginLeft: number;
  /** 内容右侧外边距 */
  contentMarginRight: number;
  /** 内容顶部外边距 */
  contentMarginTop: number;
  /** 内容左上圆角 */
  contentRadiusTopLeft: number;
  /** 内容右上圆角 */
  contentRadiusTopRight: number;
  /** 内容右下圆角 */
  contentRadiusBottomRight: number;
  /** 内容左下圆角 */
  contentRadiusBottomLeft: number;
  /** 内容上边框宽度 */
  contentBorderTopWidth: number;
  /** 内容右边框宽度 */
  contentBorderRightWidth: number;
  /** 内容下边框宽度 */
  contentBorderBottomWidth: number;
  /** 内容左边框宽度 */
  contentBorderLeftWidth: number;
  // /** 应用默认头像 */
  defaultAvatar: string;
  /** 默认首页地址 */
  defaultHomePath: string;
  // /** 开启动态标题 */
  dynamicTitle: boolean;
  /** 是否开启检查更新 */
  enableCheckUpdates: boolean;
  /** 是否显示偏好设置 */
  enablePreferences: boolean;
  /**
   * @zh_CN 是否开启refreshToken
   */
  enableRefreshToken: boolean;
  /**
   * @zh_CN 是否开启首选项导航栏吸顶效果
   */
  enableStickyPreferencesNavigationBar: boolean;
  /** 是否移动端 */
  isMobile: boolean;
  /** 布局方式 */
  layout: LayoutType;
  /** 支持的语言 */
  locale: SupportedLanguagesType;
  /** 登录过期模式 */
  loginExpiredMode: LoginExpiredModeType;
  /** 应用名 */
  name: string;
  /** 偏好设置按钮位置 */
  preferencesButtonPosition: PreferencesButtonPositionType;
  /**
   * @zh_CN 是否开启水印
   */
  watermark: boolean;
  /**
   * @zh_CN 水印文案
   */
  watermarkContent: string;
  /** z-index */
  zIndex: number;
}

interface BreadcrumbPreferences {
  /** 面包屑是否启用 */
  enable: boolean;
  /** 面包屑是否只有一个时隐藏 */
  hideOnlyOne: boolean;
  /** 面包屑首页图标是否可见 */
  showHome: boolean;
  /** 面包屑图标是否可见 */
  showIcon: boolean;
  /** 面包屑风格 */
  styleType: BreadcrumbStyleType;
}

interface CopyrightPreferences {
  /** 版权公司名 */
  companyName: string;
  /** 版权公司名链接 */
  companySiteLink: string;
  /** 版权日期 */
  date: string;
  /** 版权是否可见 */
  enable: boolean;
  /** 备案号 */
  icp: string;
  /** 备案号链接 */
  icpLink: string;
  /** 设置面板是否显示*/
  settingShow?: boolean;
}

interface FooterPreferences {
  /** 底栏是否可见 */
  enable: boolean;
  /** 底栏是否固定 */
  fixed: boolean;
  /** 底栏高度 */
  height: number;
}

interface HeaderPreferences {
  /** 顶栏是否启用 */
  enable: boolean;
  /** 顶栏高度 */
  height: number;
  /** 顶栏上外边距 */
  marginTop: number;
  /** 顶栏右外边距 */
  marginRight: number;
  /** 顶栏下外边距 */
  marginBottom: number;
  /** 顶栏左外边距 */
  marginLeft: number;
  /** 顶栏左上圆角 */
  radiusTopLeft: number;
  /** 顶栏右上圆角 */
  radiusTopRight: number;
  /** 顶栏右下圆角 */
  radiusBottomRight: number;
  /** 顶栏左下圆角 */
  radiusBottomLeft: number;
  /** 顶栏上边框宽度 */
  borderTopWidth: number;
  /** 顶栏右边框宽度 */
  borderRightWidth: number;
  /** 顶栏下边框宽度 */
  borderBottomWidth: number;
  /** 顶栏左边框宽度 */
  borderLeftWidth: number;
  /** 顶栏是否隐藏,css-隐藏 */
  hidden: boolean;
  /** 顶栏菜单位置 */
  menuAlign: LayoutHeaderMenuAlignType;
  /** header显示模式 */
  mode: LayoutHeaderModeType;
}

interface LogoPreferences {
  /** logo是否可见 */
  enable: boolean;
  /** logo图片适应方式 */
  fit: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  /** logo地址 */
  source: string;
  /** 暗色主题logo地址 (可选，若不设置则使用 source) */
  sourceDark?: string;
}

interface NavigationPreferences {
  /** 导航菜单手风琴模式 */
  accordion: boolean;
  /** 导航菜单是否切割，只在 layout=mixed-nav 生效 */
  split: boolean;
  /** 导航菜单风格 */
  styleType: NavigationStyleType;
}

interface SidebarPreferences {
  /** 点击目录时自动激活子菜单   */
  autoActivateChild: boolean;
  /** 侧边栏是否折叠 */
  collapsed: boolean;
  /** 侧边栏折叠按钮是否可见 */
  collapsedButton: boolean;
  /** 侧边栏折叠时，是否显示title */
  collapsedShowTitle: boolean;
  /** 侧边栏折叠宽度 */
  collapseWidth: number;
  /** 侧边栏是否可见 */
  enable: boolean;
  /** 菜单自动展开状态 */
  expandOnHover: boolean;
  /** 侧边栏扩展区域是否折叠 */
  extraCollapse: boolean;
  /** 侧边栏扩展区域折叠宽度 */
  extraCollapsedWidth: number;
  /** 侧边栏固定按钮是否可见 */
  fixedButton: boolean;
  /** 侧边栏是否隐藏 - css */
  hidden: boolean;
  /** 混合侧边栏宽度 */
  mixedWidth: number;
  /** 双列菜单一级栏与二级菜单面板的间隔 */
  mixedMenuGap: number;
  /** 侧边栏菜单项之间的纵向间隔 */
  menuItemGap: number;
  /** 侧边栏宽度 */
  width: number;
  /** 侧边栏上外边距 */
  marginTop: number;
  /** 侧边栏右外边距 */
  marginRight: number;
  /** 侧边栏下外边距 */
  marginBottom: number;
  /** 侧边栏左外边距 */
  marginLeft: number;
  /** 侧边栏左上圆角 */
  radiusTopLeft: number;
  /** 侧边栏右上圆角 */
  radiusTopRight: number;
  /** 侧边栏右下圆角 */
  radiusBottomRight: number;
  /** 侧边栏左下圆角 */
  radiusBottomLeft: number;
  /** 侧边栏上边框宽度 */
  borderTopWidth: number;
  /** 侧边栏右边框宽度 */
  borderRightWidth: number;
  /** 侧边栏下边框宽度 */
  borderBottomWidth: number;
  /** 侧边栏左边框宽度 */
  borderLeftWidth: number;
}

interface ShortcutKeyPreferences {
  /** 是否启用快捷键-全局 */
  enable: boolean;
  /** 是否启用全局锁屏快捷键 */
  globalLockScreen: boolean;
  /** 是否启用全局注销快捷键 */
  globalLogout: boolean;
  /** 是否启用全局偏好设置快捷键 */
  globalPreferences: boolean;
  /** 是否启用全局搜索快捷键 */
  globalSearch: boolean;
}

interface TabbarPreferences {
  /** 标签栏背景色 */
  backgroundColor: string;
  /** 是否自定义标签栏背景色 */
  backgroundColorCustom: boolean;
  /** 标签栏背景透明度（0-100，0 为不透明） */
  backgroundTransparency: number;
  /** 标签栏上外边距 */
  marginTop: number;
  /** 标签栏右外边距 */
  marginRight: number;
  /** 标签栏下外边距 */
  marginBottom: number;
  /** 标签栏左外边距 */
  marginLeft: number;
  /** 标签栏左上圆角 */
  radiusTopLeft: number;
  /** 标签栏右上圆角 */
  radiusTopRight: number;
  /** 标签栏右下圆角 */
  radiusBottomRight: number;
  /** 标签栏左下圆角 */
  radiusBottomLeft: number;
  /** 标签栏上边框宽度 */
  borderTopWidth: number;
  /** 标签栏右边框宽度 */
  borderRightWidth: number;
  /** 标签栏下边框宽度 */
  borderBottomWidth: number;
  /** 标签栏左边框宽度 */
  borderLeftWidth: number;
  /** 是否开启多标签页拖拽 */
  draggable: boolean;
  /** 是否开启多标签页 */
  enable: boolean;
  /** 标签页高度 */
  height: number;
  /** 开启标签页缓存功能 */
  keepAlive: boolean;
  /** 限制最大数量 */
  maxCount: number;
  /** 是否点击中键时关闭标签 */
  middleClickToClose: boolean;
  /** 是否持久化标签 */
  persist: boolean;
  /** 是否开启多标签页图标 */
  showIcon: boolean;
  /** 显示最大化按钮 */
  showMaximize: boolean;
  /** 显示更多按钮 */
  showMore: boolean;
  /** 显示刷新按钮 */
  showRefresh: boolean;
  /** 标签页风格 */
  styleType: TabsStyleType;
  /** 是否开启访问历史记录 */
  visitHistory: boolean;
  /** 是否开启鼠标滚轮响应 */
  wheelable: boolean;
}

interface ThemePreferences {
  /** 基础布局背景色 */
  baseBackgroundColor: string;
  /** 是否自定义基础布局背景色 */
  baseBackgroundColorCustom: boolean;
  /** 基础布局背景透明度（0-100，0 为不透明） */
  baseBackgroundTransparency: number;
  /** 内容区域背景色 */
  contentBackgroundColor: string;
  /** 是否自定义内容区域背景色 */
  contentBackgroundColorCustom: boolean;
  /** 内容区域背景透明度（0-100，0 为不透明） */
  contentBackgroundTransparency: number;
  /** 内置主题名 */
  builtinType: BuiltinThemeType;
  /** 错误色 */
  colorDestructive: string;
  /** 主题色 */
  colorPrimary: string;
  /** 成功色 */
  colorSuccess: string;
  /** 警告色 */
  colorWarning: string;
  /** 字体大小（单位：px） */
  fontSize: number;
  /** 当前主题 */
  mode: ThemeModeType;
  /** 圆角 */
  radius: string;
  /** 是否开启半深色header（只在theme='light'时生效） */
  semiDarkHeader: boolean;
  /** 半深色header颜色 */
  semiDarkHeaderColor: string;
  /** 顶栏背景透明度（0-100，0 为不透明） */
  semiDarkHeaderColorTransparency: number;
  /** 顶栏菜单主题色 */
  headerMenuThemeColor: string;
  /** 是否自定义顶栏菜单主题色 */
  headerMenuThemeColorCustom: boolean;
  /** 顶栏导航菜单背景色 */
  headerMenuBackgroundColor: string;
  /** 是否自定义顶栏导航菜单背景色 */
  headerMenuBackgroundColorCustom: boolean;
  /** 顶栏导航菜单背景透明度（0-100，0 为不透明） */
  headerMenuBackgroundColorTransparency: number;
  /** 是否开启半深色菜单（只在theme='light'时生效） */
  semiDarkSidebar: boolean;
  /** 半深色菜单颜色 */
  semiDarkSidebarColor: string;
  /** 侧边栏背景透明度（0-100，0 为不透明） */
  semiDarkSidebarColorTransparency: number;
  /** 是否开启半深色子菜单（只在theme='light'时生效） */
  semiDarkSidebarSub: boolean;
  /** 深色侧边栏菜单背景颜色 */
  sidebarMenuBackgroundColor: string;
  /** 是否自定义深色侧边栏菜单背景颜色 */
  sidebarMenuBackgroundColorCustom: boolean;
  /** 侧边栏导航菜单背景透明度（0-100，0 为不透明） */
  sidebarMenuBackgroundColorTransparency: number;
}

interface TransitionPreferences {
  /** 页面切换动画是否启用 */
  enable: boolean;
  // /** 是否开启页面加载loading */
  loading: boolean;
  /** 页面切换动画 */
  name: PageTransitionType | string;
  /** 是否开启页面加载进度动画 */
  progress: boolean;
}

interface WidgetPreferences {
  /** 是否启用全屏部件 */
  fullscreen: boolean;
  /** 是否启用全局搜索部件 */
  globalSearch: boolean;
  /** 是否启用语言切换部件 */
  languageToggle: boolean;
  /** 是否开启锁屏功能 */
  lockScreen: boolean;
  /** 是否显示通知部件 */
  notification: boolean;
  /** 显示刷新按钮 */
  refresh: boolean;
  /** 是否显示侧边栏显示/隐藏部件 */
  sidebarToggle: boolean;
  /** 是否显示主题切换部件 */
  themeToggle: boolean;
  /** 是否显示时区部件 */
  timezone: boolean;
}

interface Preferences {
  /** 全局配置 */
  app: AppPreferences;
  /** 顶栏配置 */
  breadcrumb: BreadcrumbPreferences;
  /** 版权配置 */
  copyright: CopyrightPreferences;
  /** 底栏配置 */
  footer: FooterPreferences;
  /** 面包屑配置 */
  header: HeaderPreferences;
  /** logo配置 */
  logo: LogoPreferences;
  /** 导航配置 */
  navigation: NavigationPreferences;
  /** 快捷键配置 */
  shortcutKeys: ShortcutKeyPreferences;
  /** 侧边栏配置 */
  sidebar: SidebarPreferences;
  /** 标签页配置 */
  tabbar: TabbarPreferences;
  /** 主题配置 */
  theme: ThemePreferences;
  /** 动画配置 */
  transition: TransitionPreferences;
  /** 功能配置 */
  widget: WidgetPreferences;
}

type PreferencesKeys = keyof Preferences;

interface InitialOptions {
  namespace: string;
  overrides?: DeepPartial<Preferences>;
}
export type {
  AppPreferences,
  BreadcrumbPreferences,
  FooterPreferences,
  HeaderPreferences,
  InitialOptions,
  LogoPreferences,
  NavigationPreferences,
  Preferences,
  PreferencesKeys,
  ShortcutKeyPreferences,
  SidebarPreferences,
  SupportedLanguagesType,
  TabbarPreferences,
  ThemePreferences,
  TransitionPreferences,
  WidgetPreferences,
};
