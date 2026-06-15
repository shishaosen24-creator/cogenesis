"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { ContextMenuState } from "../types";

export function CanvasNodeContextMenu({ menu, onClose, onDuplicate, onDelete }: { menu: ContextMenuState; onClose: () => void; onDuplicate: () => void; onDelete: () => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [viewport, setViewport] = useState({ width: 1440, height: 900 });

    useEffect(() => {
        const close = (event: PointerEvent) => {
            const target = event.target;
            if (target instanceof Element && target.closest(".ant-popover")) return;
            onClose();
        };
        window.addEventListener("pointerdown", close);
        return () => window.removeEventListener("pointerdown", close);
    }, [onClose]);

    useEffect(() => {
        const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
        updateViewport();
        window.addEventListener("resize", updateViewport);
        return () => window.removeEventListener("resize", updateViewport);
    }, []);

    const menuWidth = 184;
    const menuHeight = menu.type === "node" ? 92 : 52;
    const edgePadding = 8;
    const left = clamp(menu.x, edgePadding, Math.max(edgePadding, viewport.width - menuWidth - edgePadding));
    const top = clamp(menu.y, edgePadding, Math.max(edgePadding, viewport.height - menuHeight - edgePadding));
    const menuStyle = {
        left,
        top,
        background: theme.toolbar.panel,
        borderColor: theme.toolbar.border,
        color: theme.node.text,
    } satisfies CSSProperties;

    return (
        <div
            className="canvas-node-context-menu fixed z-[80] w-[184px] overflow-hidden rounded-xl border py-1 shadow-2xl"
            style={menuStyle}
            onPointerDown={(event) => event.stopPropagation()}
        >
            {menu.type === "node" ? <MenuButton icon={<Plus className="size-4" />} label="复制节点" onClick={onDuplicate} /> : null}
            <MenuButton icon={<Trash2 className="size-4" />} label={menu.type === "node" ? "删除节点" : "删除连线"} onClick={onDelete} danger />
        </div>
    );
}

function MenuButton({ icon, label, onClick, danger = false }: { icon: ReactNode; label: string; onClick?: () => void; danger?: boolean }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    return (
        <button type="button" className="canvas-node-context-menu-item flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors" style={{ color: danger ? "#f87171" : theme.node.text }} onClick={onClick} aria-label={label}>
            {icon}
            <span>{label}</span>
        </button>
    );
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}
