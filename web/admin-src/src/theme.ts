import { theme } from 'antd'
import type { ThemeConfig } from 'antd'
import type { ResolvedTheme } from './context/ThemeContext'

// Blackrail Mint：纯黑导航 + 柔和薄荷强调 + 干净企业后台。
// AntD Token 与 styles/admin.css 的 CSS 变量保持一一对应，页面不自行定义品牌色。

interface Palette {
  primary: string
  primaryHover: string
  primaryActive: string
  primarySoft: string
  primaryBorder: string
  primaryRing: string
  info: string
  success: string
  warning: string
  error: string
  text: string
  textSecondary: string
  textMuted: string
  textDisabled: string
  bg: string
  surface: string
  elevated: string
  surfaceMuted: string
  border: string
  borderSecondary: string
  fill: string
  tableHeadBg: string
  tableHeadText: string
  tableHover: string
  shadow: string
  shadowSecondary: string
  shadowTertiary: string
}

const LIGHT: Palette = {
  primary: '#111418',
  primaryHover: '#000000',
  primaryActive: '#000000',
  primarySoft: '#EEF0F3',
  primaryBorder: '#C9CDD3',
  primaryRing: 'rgba(0, 0, 0, 0.10)',
  info: '#4E8BEE',
  success: '#52525B',
  warning: '#E6A13B',
  error: '#D4615F',
  text: '#101614',
  textSecondary: '#586661',
  textMuted: '#86958F',
  textDisabled: '#B3BEB9',
  bg: '#F4F6F5',
  surface: '#FFFFFF',
  elevated: '#FFFFFF',
  surfaceMuted: '#EEF3F1',
  border: '#E4E9E6',
  borderSecondary: '#EDF2EF',
  fill: '#EEF3F1',
  tableHeadBg: '#F8FAF9',
  tableHeadText: '#72807A',
  tableHover: '#EFF8F4',
  shadow: '0 12px 32px rgba(16, 24, 20, 0.14)',
  shadowSecondary: '0 8px 24px -14px rgba(16, 24, 20, 0.16)',
  shadowTertiary: '0 1px 2px rgba(16, 24, 20, 0.04)',
}

const DARK: Palette = {
  primary: '#ECF0F2',
  primaryHover: '#FFFFFF',
  primaryActive: '#C9CDD3',
  primarySoft: 'rgba(255, 255, 255, 0.12)',
  primaryBorder: 'rgba(255, 255, 255, 0.26)',
  primaryRing: 'rgba(255, 255, 255, 0.14)',
  info: '#8AB4FF',
  success: '#A1A9B0',
  warning: '#F3BD6A',
  error: '#FF8F92',
  text: '#ECF3F0',
  textSecondary: '#A7B5AF',
  textMuted: '#7C8B85',
  textDisabled: '#55615C',
  bg: '#0B0E0D',
  surface: '#141817',
  elevated: '#191E1C',
  surfaceMuted: '#1B211F',
  border: '#262D2A',
  borderSecondary: '#1F2623',
  fill: '#1C2421',
  tableHeadBg: '#171C1A',
  tableHeadText: '#8D9B95',
  tableHover: '#1A211E',
  shadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
  shadowSecondary: '0 10px 28px rgba(0, 0, 0, 0.42)',
  shadowTertiary: '0 1px 2px rgba(0, 0, 0, 0.35)',
}

// 根据明暗模式生成完整 AntD 主题，页面只消费实际生效的主题配置。
export function buildThemeConfig(mode: ResolvedTheme): ThemeConfig {
  const p = mode === 'dark' ? DARK : LIGHT

  return {
    algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: p.primary,
      colorPrimaryHover: p.primaryHover,
      colorPrimaryActive: p.primaryActive,
      // 主色为近黑/近白时，antd 调色板会派生出深灰"浅色底"（如 #515557），
      // 导致下拉选中+悬停项等场景深底配深字，必须显式给出正确的浅色/深色 tint
      colorPrimaryBg: mode === 'dark' ? '#26292E' : '#EEF0F3',
      colorPrimaryBgHover: mode === 'dark' ? '#30353A' : '#E2E5EA',
      controlItemBgActive: mode === 'dark' ? '#26292E' : '#EEF0F3',
      controlItemBgActiveHover: mode === 'dark' ? '#30353A' : '#E2E5EA',
      colorInfo: p.info,
      colorSuccess: p.success,
      colorWarning: p.warning,
      colorError: p.error,
      colorTextBase: p.text,
      colorText: p.text,
      colorTextHeading: p.text,
      colorTextDescription: p.textSecondary,
      colorTextLabel: p.textSecondary,
      colorTextPlaceholder: p.textMuted,
      colorTextDisabled: p.textDisabled,
      colorTextLightSolid: mode === 'dark' ? '#0B0E0D' : '#FFFFFF',
      colorBgBase: p.bg,
      colorBgLayout: p.bg,
      colorBgContainer: p.surface,
      colorBgElevated: p.elevated,
      colorBorder: p.border,
      colorBorderSecondary: p.borderSecondary,
      colorFill: p.fill,
      colorFillSecondary: p.surfaceMuted,
      colorFillTertiary: p.surfaceMuted,
      colorFillQuaternary: p.tableHeadBg,
      colorLink: p.primary,
      colorLinkHover: p.primaryHover,
      colorLinkActive: p.primaryActive,
      borderRadius: 6,
      borderRadiusXS: 3,
      borderRadiusSM: 5,
      borderRadiusLG: 10,
      fontSize: 13,
      fontFamily:
        "Inter, -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
      fontFamilyCode:
        "ui-monospace, 'SFMono-Regular', 'JetBrains Mono', Menlo, Consolas, 'Liberation Mono', monospace",
      controlHeight: 32,
      controlHeightSM: 26,
      controlHeightLG: 38,
      lineWidth: 1,
      boxShadow: p.shadow,
      boxShadowSecondary: p.shadowSecondary,
      boxShadowTertiary: p.shadowTertiary,
      wireframe: false,
      motionDurationFast: '0.12s',
      motionDurationMid: '0.18s',
      motionDurationSlow: '0.22s',
      motionEaseInOut: 'cubic-bezier(0.2, 0, 0, 1)',
    },
    components: {
      Layout: {
        bodyBg: p.bg,
        headerBg: p.surface,
        headerHeight: 56,
        headerPadding: 0,
        siderBg: '#000000',
      },
      Table: {
        headerBg: p.tableHeadBg,
        headerColor: p.tableHeadText,
        headerSplitColor: 'transparent',
        headerBorderRadius: 0,
        rowHoverBg: p.tableHover,
        borderColor: p.borderSecondary,
        cellPaddingBlock: 8,
        cellPaddingBlockMD: 8,
        cellPaddingBlockSM: 7,
        cellPaddingInline: 14,
        cellPaddingInlineMD: 12,
        footerBg: 'transparent',
        filterDropdownBg: p.elevated,
        fontSize: 13,
      },
      Card: {
        headerBg: 'transparent',
        headerFontSize: 14,
        headerHeight: 46,
        bodyPadding: 16,
        bodyPaddingSM: 12,
        colorBorderSecondary: p.border,
      },
      Button: {
        fontWeight: 500,
        iconGap: 6,
        defaultShadow: 'none',
        primaryShadow: 'none',
        dangerShadow: 'none',
        defaultBorderColor: mode === 'dark' ? '#3A423E' : '#111418',
        defaultColor: p.text,
        primaryColor: mode === 'dark' ? '#0B0E0D' : '#FFFFFF',
        contentFontSize: 13,
        paddingInline: 13,
        borderRadius: 6,
        controlHeight: 32,
      },
      Input: {
        hoverBorderColor: mode === 'dark' ? '#3A4741' : '#9AA1A8',
        activeBorderColor: p.primary,
        activeShadow: `0 0 0 2px ${p.primaryRing}`,
        paddingInline: 10,
        inputFontSize: 13,
        borderRadius: 6,
      },
      InputNumber: {
        hoverBorderColor: mode === 'dark' ? '#3A4741' : '#9AA1A8',
        activeBorderColor: p.primary,
        activeShadow: `0 0 0 2px ${p.primaryRing}`,
        borderRadius: 6,
      },
      Select: {
        optionSelectedBg: p.primarySoft,
        optionSelectedColor: p.text,
        optionActiveBg: p.tableHover,
        optionHeight: 30,
        optionPadding: '6px 12px',
        borderRadius: 6,
      },
      Menu: {
        itemHeight: 34,
        itemBorderRadius: 7,
        itemMarginInline: 10,
        iconSize: 16,
        itemColor: '#9AA5A1',
        itemHoverColor: '#F5FAF8',
        itemHoverBg: 'rgba(255, 255, 255, 0.06)',
        itemSelectedBg: '#E8EAED',
        itemSelectedColor: '#101614',
        activeBarBorderWidth: 0,
        subMenuItemBg: 'transparent',
      },
      Tabs: {
        inkBarColor: p.primary,
        itemColor: p.textSecondary,
        itemHoverColor: p.text,
        itemSelectedColor: p.text,
        titleFontSize: 14,
        horizontalItemGutter: 26,
        horizontalMargin: '0 0 18px 0',
      },
      Form: {
        labelColor: p.textSecondary,
        labelFontSize: 13,
        labelHeight: 20,
        itemMarginBottom: 14,
        verticalLabelPadding: '0 0 5px',
      },
      Modal: {
        titleFontSize: 16,
        contentBg: p.surface,
        headerBg: p.surface,
        borderRadiusLG: 14,
        titleColor: p.text,
        paddingContentHorizontal: 24,
      },
      Drawer: {
        footerPaddingBlock: 14,
        footerPaddingInline: 24,
        colorBgElevated: p.surface,
      },
      Dropdown: {
        borderRadiusLG: 12,
        paddingBlock: 6,
        colorBgElevated: p.elevated,
      },
      Tag: {
        borderRadiusSM: 7,
        defaultBg: p.surfaceMuted,
        defaultColor: p.textSecondary,
      },
      Tooltip: {
        colorBgSpotlight: mode === 'dark' ? '#E9F2EE' : '#101614',
        colorTextLightSolid: mode === 'dark' ? '#0B0E0D' : '#FFFFFF',
        borderRadius: 7,
        fontSize: 12,
      },
      Pagination: {
        itemActiveBg: p.primarySoft,
        borderRadius: 6,
        itemSize: 28,
        fontSize: 12,
      },
      Upload: {
        actionsColor: p.textSecondary,
      },
      Skeleton: {
        gradientFromColor: mode === 'dark' ? '#1C2320' : '#EFF5F2',
        gradientToColor: mode === 'dark' ? '#232B28' : '#F8FBF9',
        titleHeight: 14,
        paragraphMarginTop: 10,
      },
      Empty: {
        colorTextDescription: p.textMuted,
      },
      Segmented: {
        trackBg: p.surfaceMuted,
        itemColor: p.textSecondary,
        itemHoverColor: p.text,
        itemSelectedBg: p.surface,
        itemSelectedColor: p.text,
        itemActiveBg: p.surface,
        trackPadding: 3,
      },
      Alert: {
        defaultPadding: '10px 14px',
        borderRadiusLG: 10,
        fontSize: 13,
      },
      DatePicker: {
        hoverBorderColor: mode === 'dark' ? '#3A4741' : '#9AA1A8',
        activeBorderColor: p.primary,
        activeShadow: `0 0 0 2px ${p.primaryRing}`,
      },
      Message: {
        contentBg: p.elevated,
        borderRadiusLG: 10,
      },
    },
  }
}
