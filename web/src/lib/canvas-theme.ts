export type CanvasColorTheme = "light" | "dark";
export type CanvasBackgroundMode = "dots" | "lines" | "blank";

export const canvasThemes = {
    light: {
        canvas: {
            background: "transparent",
            veil: "rgba(246,243,236,.56)",
            dot: "rgba(139,101,29,.28)",
            line: "rgba(139,101,29,.12)",
            selectionStroke: "#8b651d",
            selectionFill: "rgba(139,101,29,.08)",
        },
        node: {
            label: "#615d54",
            fill: "rgba(255,252,245,.84)",
            panel: "rgba(255,252,245,.94)",
            stroke: "rgba(155,143,120,.48)",
            activeStroke: "#8b651d",
            placeholder: "#8c8170",
            text: "#26231d",
            muted: "#706a5e",
            faint: "#9b8f78",
        },
        toolbar: {
            panel: "rgba(255,252,245,.86)",
            border: "rgba(155,143,120,.42)",
            item: "#615d54",
            itemHover: "rgba(233,193,118,.18)",
            activeBg: "rgba(233,193,118,.28)",
            activeText: "#3a3427",
        },
    },
    dark: {
        canvas: {
            background: "transparent",
            veil: "rgba(18,20,19,.58)",
            dot: "rgba(233,193,118,.22)",
            line: "rgba(233,193,118,.08)",
            selectionStroke: "#e9c176",
            selectionFill: "rgba(233,193,118,.12)",
        },
        node: {
            label: "#c4c7c7",
            fill: "rgba(30,32,31,.78)",
            panel: "rgba(18,20,19,.92)",
            stroke: "rgba(142,145,146,.36)",
            activeStroke: "#e9c176",
            placeholder: "rgba(196,199,199,.66)",
            text: "#e3e2e0",
            muted: "#cac6be",
            faint: "#8e9192",
        },
        toolbar: {
            panel: "rgba(30,32,31,.74)",
            border: "rgba(142,145,146,.32)",
            item: "#c4c7c7",
            itemHover: "rgba(233,193,118,.12)",
            activeBg: "rgba(233,193,118,.18)",
            activeText: "#ffdea5",
        },
    },
} as const;

export type CanvasTheme = (typeof canvasThemes)[CanvasColorTheme];
