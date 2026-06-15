import type { CSSProperties } from "react";
import type { ThemeConfig } from "antd";
import { theme as antdTheme } from "antd";

const sacred = {
    light: {
        primary: "#8b651d",
        primaryHover: "#6f5016",
        primaryText: "#fffaf0",
        bgLayout: "#f6f3ec",
        bgContainer: "#fffcf5",
        bgElevated: "#fffcf5",
        text: "#26231d",
        textSecondary: "#615d54",
        border: "#d1c5ad",
        menuBg: "rgba(255, 252, 245, 0.82)",
        menuText: "#26231d",
        selectActiveBg: "rgba(233, 193, 118, 0.14)",
        selectSelectedBg: "rgba(233, 193, 118, 0.22)",
        selectText: "#26231d",
        tableSelectedBg: "rgba(139, 101, 29, 0.08)",
        tableSelectedHoverBg: "rgba(139, 101, 29, 0.12)",
    },
    dark: {
        primary: "#e9c176",
        primaryHover: "#ffdea5",
        primaryText: "#261900",
        bgLayout: "#121413",
        bgContainer: "#1e201f",
        bgElevated: "#292a29",
        text: "#e3e2e0",
        textSecondary: "#c4c7c7",
        border: "rgba(142, 145, 146, 0.32)",
        menuBg: "rgba(233, 193, 118, 0.12)",
        menuText: "#ffdea5",
        selectActiveBg: "rgba(233, 193, 118, 0.12)",
        selectSelectedBg: "rgba(233, 193, 118, 0.18)",
        selectText: "#e3e2e0",
        tableSelectedBg: "rgba(233, 193, 118, 0.1)",
        tableSelectedHoverBg: "rgba(233, 193, 118, 0.14)",
    },
};

export const adminLayoutStyle = {
    siderWidth: 232,
    headerHeight: 56,
    brandHeight: 64,
    menu: { borderInlineEnd: 0, padding: "18px 12px", fontSize: 15 } satisfies CSSProperties,
    menuItem: { height: 44, lineHeight: "44px", marginBlock: 4, borderRadius: 8 } satisfies CSSProperties,
};

export function getAntThemeConfig(dark: boolean): ThemeConfig {
    const color = dark ? sacred.dark : sacred.light;

    return {
        algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        cssVar: { key: dark ? "infinite-canvas-dark" : "infinite-canvas-light" },
        token: {
            colorPrimary: color.primary,
            colorInfo: color.primary,
            colorLink: color.primary,
            colorLinkHover: color.primaryHover,
            colorLinkActive: color.primary,
            colorTextLightSolid: color.primaryText,
            colorBgLayout: color.bgLayout,
            colorBgContainer: color.bgContainer,
            colorBgElevated: color.bgElevated,
            colorText: color.text,
            colorTextSecondary: color.textSecondary,
            colorBorder: color.border,
            colorBorderSecondary: color.border,
            borderRadius: 8,
            borderRadiusLG: 8,
            borderRadiusSM: 4,
        },
        components: {
            Button: {
                primaryShadow: "none",
                borderRadius: 8,
            },
            Drawer: {
                colorBgElevated: color.bgElevated,
            },
            Modal: {
                contentBg: color.bgElevated,
                headerBg: color.bgElevated,
            },
            Menu: {
                itemActiveBg: color.menuBg,
                itemHoverBg: color.menuBg,
                itemSelectedBg: color.menuBg,
                itemSelectedColor: color.menuText,
                darkItemHoverBg: sacred.dark.menuBg,
                darkItemSelectedBg: sacred.dark.menuBg,
                darkItemSelectedColor: sacred.dark.menuText,
            },
            Select: {
                optionActiveBg: color.selectActiveBg,
                optionSelectedBg: color.selectSelectedBg,
                optionSelectedColor: color.selectText,
            },
            Segmented: {
                itemSelectedBg: color.selectSelectedBg,
                itemSelectedColor: color.selectText,
            },
            Input: {
                activeBorderColor: color.primary,
                hoverBorderColor: color.primary,
            },
            Table: {
                rowSelectedBg: color.tableSelectedBg,
                rowSelectedHoverBg: color.tableSelectedHoverBg,
            },
        },
    };
}
