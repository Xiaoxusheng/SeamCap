import type { ThemeConfig } from 'antd'

// Ant Design Premium UI 主题 tokens（SeamCap 品牌：CTA 蓝 #0369A1 + 深海军蓝标题）
export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: '#0369A1',
    colorInfo: '#4384C5',
    colorSuccess: '#14866D',
    colorWarning: '#B7791F',
    colorError: '#D9535D',
    colorTextBase: '#202735',
    colorBgLayout: '#F6F7F9',
    colorBgContainer: '#FFFFFF',
    colorBorder: '#E3E7ED',
    colorBorderSecondary: '#E3E7ED',
    borderRadius: 6,
    fontSize: 14,
  },
  components: {
    Layout: {
      headerBg: '#FFFFFF',
      headerHeight: 56,
      siderBg: '#FFFFFF',
    },
    Menu: {
      itemSelectedBg: '#EDF3FA',
      itemSelectedColor: '#0369A1',
      itemHeight: 40,
    },
    Table: {
      headerBg: '#F1F3F6',
      headerSplitColor: 'transparent',
      rowHoverBg: '#F5F7FA',
      cellPaddingBlock: 11,
    },
    Card: {
      paddingLG: 20,
    },
  },
}
