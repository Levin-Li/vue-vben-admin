import type {
  ContentCompactType,
  LayoutHeaderModeType,
  LayoutType,
  ThemeModeType,
} from '@vben-core/typings';

interface VbenLayoutProps {
  /** 最外层基础背景色，用于顶栏承载区等布局留白 */
  baseBackgroundColor?: string;
  /**
   * 内容区域定宽
   * @default 'wide'
   */
  contentCompact?: ContentCompactType;
  /**
   * 定宽布局宽度
   * @default 1200
   */
  contentCompactWidth?: number;
  /** 内容区域背景色；未自定义时传 transparent */
  contentBackgroundColor?: string;
  /**
   * padding
   * @default 16
   */
  contentPadding?: number;
  /**
   * marginBottom
   * @default 16
   */
  contentMarginBottom?: number;
  /**
   * marginLeft
   * @default 16
   */
  contentMarginLeft?: number;
  /**
   * marginRight
   * @default 16
   */
  contentMarginRight?: number;
  /**
   * marginTop
   * @default 16
   */
  contentMarginTop?: number;
  /** 内容左上圆角 */
  contentRadiusTopLeft?: number;
  /** 内容右上圆角 */
  contentRadiusTopRight?: number;
  /** 内容右下圆角 */
  contentRadiusBottomRight?: number;
  /** 内容左下圆角 */
  contentRadiusBottomLeft?: number;
  /** 内容上边框宽度 */
  contentBorderTopWidth?: number;
  /** 内容右边框宽度 */
  contentBorderRightWidth?: number;
  /** 内容下边框宽度 */
  contentBorderBottomWidth?: number;
  /** 内容左边框宽度 */
  contentBorderLeftWidth?: number;
  /**
   * footer 是否可见
   * @default false
   */
  footerEnable?: boolean;
  /**
   * footer 是否固定
   * @default true
   */
  footerFixed?: boolean;
  /**
   * footer 高度
   * @default 32
   */
  footerHeight?: number;
  /** 底栏上边框宽度 */
  footerBorderTopWidth?: number;
  /** 底栏右边框宽度 */
  footerBorderRightWidth?: number;
  /** 底栏下边框宽度 */
  footerBorderBottomWidth?: number;
  /** 底栏左边框宽度 */
  footerBorderLeftWidth?: number;

  /**
   * header高度
   * @default 48
   */
  headerHeight?: number;
  /** 顶栏上外边距 */
  headerMarginTop?: number;
  /** 顶栏右外边距 */
  headerMarginRight?: number;
  /** 顶栏下外边距 */
  headerMarginBottom?: number;
  /** 顶栏左外边距 */
  headerMarginLeft?: number;
  /** 顶栏左上圆角 */
  headerRadiusTopLeft?: number;
  /** 顶栏右上圆角 */
  headerRadiusTopRight?: number;
  /** 顶栏右下圆角 */
  headerRadiusBottomRight?: number;
  /** 顶栏左下圆角 */
  headerRadiusBottomLeft?: number;
  /** 顶栏上边框宽度 */
  headerBorderTopWidth?: number;
  /** 顶栏右边框宽度 */
  headerBorderRightWidth?: number;
  /** 顶栏下边框宽度 */
  headerBorderBottomWidth?: number;
  /** 顶栏左边框宽度 */
  headerBorderLeftWidth?: number;
  /**
   * 顶栏是否隐藏
   * @default false
   */
  headerHidden?: boolean;
  /**
   * header 显示模式
   * @default 'fixed'
   */
  headerMode?: LayoutHeaderModeType;
  /**
   * header 顶栏主题
   */
  headerTheme?: ThemeModeType;
  /**
   * header 顶栏主题色
   */
  headerThemeColor?: string;
  /**
   * 是否显示header切换侧边栏按钮
   * @default
   */
  headerToggleSidebarButton?: boolean;
  /**
   * header是否显示
   * @default true
   */
  headerVisible?: boolean;
  /**
   * 是否移动端显示
   * @default false
   */
  isMobile?: boolean;
  /**
   * 布局方式
   * sidebar-nav 侧边菜单布局
   * header-nav 顶部菜单布局
   * mixed-nav 侧边&顶部菜单布局
   * sidebar-mixed-nav 侧边混合菜单布局
   * full-content 全屏内容布局
   * @default sidebar-nav
   */
  layout?: LayoutType;
  /**
   * 侧边菜单折叠状态
   * @default false
   */
  sidebarCollapse?: boolean;
  /**
   * 侧边菜单折叠按钮
   * @default true
   */
  sidebarCollapsedButton?: boolean;
  /**
   * 侧边菜单是否折叠时，是否显示title
   * @default true
   */
  sidebarCollapseShowTitle?: boolean;
  /**
   * 侧边栏是否可见
   * @default true
   */
  sidebarEnable?: boolean;
  /**
   * 侧边菜单折叠额外宽度
   * @default 48
   */
  sidebarExtraCollapsedWidth?: number;
  /** 当前双列菜单是否有可展示的第二列菜单项 */
  sidebarExtraMenuVisible?: boolean;
  /**
   * 侧边菜单折叠按钮是否固定
   * @default true
   */
  sidebarFixedButton?: boolean;
  /**
   * 侧边栏是否隐藏
   * @default false
   */
  sidebarHidden?: boolean;
  /**
   * 混合侧边栏宽度
   * @default 80
   */
  sidebarMixedWidth?: number;
  /**
   * 侧边栏
   * @default dark
   */
  sidebarTheme?: ThemeModeType;
  /**
   * 侧边栏主题色
   */
  sidebarThemeColor?: string;
  /** 侧边栏菜单背景色 */
  sidebarMenuBackgroundColor?: string;
  /** 侧边栏菜单悬停背景色 */
  sidebarMenuHoverBackgroundColor?: string;
  /** 全局浅色主题下，侧边栏菜单选中项使用主题色 */
  sidebarMenuUsePrimaryActiveColor?: boolean;
  /**
   * 侧边栏子栏
   * @default dark
   */
  sidebarThemeSub?: ThemeModeType;
  /**
   * 侧边栏子栏主题色
   */
  sidebarThemeSubColor?: string;
  /**
   * 侧边栏宽度
   * @default 210
   */
  sidebarWidth?: number;
  /** 双列菜单一级栏与二级菜单面板的间隔
   * @default 6
   */
  sidebarMixedMenuGap?: number;
  /** 侧边栏菜单项之间的纵向间隔
   * @default 4
   */
  sidebarMenuItemGap?: number;
  /** 侧边栏上外边距 */
  sidebarMarginTop?: number;
  /** 侧边栏右外边距 */
  sidebarMarginRight?: number;
  /** 侧边栏下外边距 */
  sidebarMarginBottom?: number;
  /** 侧边栏左外边距 */
  sidebarMarginLeft?: number;
  /** 侧边栏左上圆角 */
  sidebarRadiusTopLeft?: number;
  /** 侧边栏右上圆角 */
  sidebarRadiusTopRight?: number;
  /** 侧边栏右下圆角 */
  sidebarRadiusBottomRight?: number;
  /** 侧边栏左下圆角 */
  sidebarRadiusBottomLeft?: number;
  /** 侧边栏上边框宽度 */
  sidebarBorderTopWidth?: number;
  /** 侧边栏右边框宽度 */
  sidebarBorderRightWidth?: number;
  /** 侧边栏下边框宽度 */
  sidebarBorderBottomWidth?: number;
  /** 侧边栏左边框宽度 */
  sidebarBorderLeftWidth?: number;
  /**
   *  侧边菜单折叠宽度
   * @default 48
   */
  sideCollapseWidth?: number;
  /**
   * tab是否可见
   * @default true
   */
  tabbarEnable?: boolean;
  /**
   * tab高度
   * @default 30
   */
  tabbarHeight?: number;
  /** 标签栏背景色 */
  tabbarBackgroundColor?: string;
  /** 标签栏上外边距 */
  tabbarMarginTop?: number;
  /** 标签栏右外边距 */
  tabbarMarginRight?: number;
  /** 标签栏下外边距 */
  tabbarMarginBottom?: number;
  /** 标签栏左外边距 */
  tabbarMarginLeft?: number;
  /** 标签栏左上圆角 */
  tabbarRadiusTopLeft?: number;
  /** 标签栏右上圆角 */
  tabbarRadiusTopRight?: number;
  /** 标签栏右下圆角 */
  tabbarRadiusBottomRight?: number;
  /** 标签栏左下圆角 */
  tabbarRadiusBottomLeft?: number;
  /** 标签栏上边框宽度 */
  tabbarBorderTopWidth?: number;
  /** 标签栏右边框宽度 */
  tabbarBorderRightWidth?: number;
  /** 标签栏下边框宽度 */
  tabbarBorderBottomWidth?: number;
  /** 标签栏左边框宽度 */
  tabbarBorderLeftWidth?: number;
  /**
   * zIndex
   * @default 100
   */
  zIndex?: number;
}
export type { VbenLayoutProps };
