"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, type ViewportTransform } from "../types";

export type MinimapNodeItem = {
    id: string;
    type: CanvasNodeType;
    x: number;
    y: number;
    width: number;
    height: number;
};

type MinimapProps = {
    items: MinimapNodeItem[];
    viewport: ViewportTransform;
    viewportSize: { width: number; height: number };
    onViewportChange: (viewport: ViewportTransform) => void;
};

export const Minimap = React.memo(function Minimap({ items, viewport, viewportSize, onViewportChange }: MinimapProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dragFrameRef = useRef<number | null>(null);
    const pendingPointerRef = useRef<{ x: number; y: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const width = 240;
    const height = 160;

    const { worldBounds, scale, offset } = useMemo(() => {
        if (!items.length) {
            return { worldBounds: { x: -500, y: -500, w: 1000, h: 1000 }, scale: 0.16, offset: { x: 40, y: 0 } };
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        items.forEach((item) => {
            minX = Math.min(minX, item.x);
            minY = Math.min(minY, item.y);
            maxX = Math.max(maxX, item.x + item.width);
            maxY = Math.max(maxY, item.y + item.height);
        });

        minX -= 500;
        minY -= 500;
        maxX += 500;
        maxY += 500;

        const boundsWidth = maxX - minX;
        const boundsHeight = maxY - minY;
        const nextScale = Math.min(width / boundsWidth, height / boundsHeight);
        const mapContentW = boundsWidth * nextScale;
        const mapContentH = boundsHeight * nextScale;

        return {
            worldBounds: { x: minX, y: minY, w: boundsWidth, h: boundsHeight },
            scale: nextScale,
            offset: { x: (width - mapContentW) / 2, y: (height - mapContentH) / 2 },
        };
    }, [items]);

    const toMinimap = useCallback(
        (worldX: number, worldY: number) => {
            return {
                x: (worldX - worldBounds.x) * scale + offset.x,
                y: (worldY - worldBounds.y) * scale + offset.y,
            };
        },
        [offset.x, offset.y, scale, worldBounds.x, worldBounds.y],
    );

    const toWorld = useCallback(
        (minimapX: number, minimapY: number) => {
            return {
                x: (minimapX - offset.x) / scale + worldBounds.x,
                y: (minimapY - offset.y) / scale + worldBounds.y,
            };
        },
        [offset.x, offset.y, scale, worldBounds.x, worldBounds.y],
    );

    const viewportRect = useMemo(() => {
        const vx = -viewport.x / viewport.k;
        const vy = -viewport.y / viewport.k;
        const vw = viewportSize.width / viewport.k;
        const vh = viewportSize.height / viewport.k;
        const p1 = toMinimap(vx, vy);
        const p2 = toMinimap(vx + vw, vy + vh);

        return {
            x: p1.x,
            y: p1.y,
            w: Math.max(p2.x - p1.x, 4),
            h: Math.max(p2.y - p1.y, 4),
        };
    }, [toMinimap, viewport.k, viewport.x, viewport.y, viewportSize.height, viewportSize.width]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = Math.max(window.devicePixelRatio || 1, 1);
        const pixelWidth = Math.max(1, Math.round(width * dpr));
        const pixelHeight = Math.max(1, Math.round(height * dpr));
        if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
        if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.globalAlpha = 0.8;

        items.forEach((item) => {
            const pos = toMinimap(item.x, item.y);
            const color =
                item.type === CanvasNodeType.Image ? "#e9c176" : item.type === CanvasNodeType.Video ? "#cac6be" : item.type === CanvasNodeType.Audio ? "#8e9192" : item.type === CanvasNodeType.Config ? "#ffdea5" : theme.node.muted;
            ctx.fillStyle = color;
            ctx.fillRect(pos.x, pos.y, Math.max(item.width * scale, 2), Math.max(item.height * scale, 2));
        });
    }, [height, items, scale, theme.node.muted, toMinimap, width]);

    const updateViewportFromPoint = useCallback((clientX: number, clientY: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const world = toWorld(clientX - rect.left, clientY - rect.top);
        onViewportChange({
            x: viewportSize.width / 2 - world.x * viewport.k,
            y: viewportSize.height / 2 - world.y * viewport.k,
            k: viewport.k,
        });
    }, [onViewportChange, toWorld, viewport.k, viewportSize.height, viewportSize.width]);

    const scheduleViewportFromEvent = useCallback(
        (event: React.PointerEvent) => {
            pendingPointerRef.current = { x: event.clientX, y: event.clientY };
            if (dragFrameRef.current) return;
            dragFrameRef.current = requestAnimationFrame(() => {
                dragFrameRef.current = null;
                const point = pendingPointerRef.current;
                pendingPointerRef.current = null;
                if (point) updateViewportFromPoint(point.x, point.y);
            });
        },
        [updateViewportFromPoint],
    );

    useEffect(
        () => () => {
            if (dragFrameRef.current) cancelAnimationFrame(dragFrameRef.current);
        },
        [],
    );

    return (
        <div className="absolute bottom-24 left-6 z-50 overflow-hidden rounded-lg border shadow-2xl backdrop-blur-xl" style={{ width, height, background: theme.toolbar.panel, borderColor: theme.toolbar.border, boxShadow: "0 18px 45px rgba(0,0,0,.35), inset 0 1px 0 rgba(233,193,118,.16)" }}>
            <div
                ref={containerRef}
                className="relative h-full w-full cursor-crosshair"
                onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setIsDragging(true);
                    scheduleViewportFromEvent(event);
                }}
                onPointerMove={(event) => {
                    if (isDragging) scheduleViewportFromEvent(event);
                }}
                onPointerUp={() => setIsDragging(false)}
                onPointerLeave={() => setIsDragging(false)}
            >
                <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" aria-hidden />
                <div className="pointer-events-none absolute border" style={{ left: viewportRect.x, top: viewportRect.y, width: viewportRect.w, height: viewportRect.h, borderColor: theme.node.activeStroke, background: `${theme.node.activeStroke}18` }} />
            </div>
        </div>
    );
}, areMinimapPropsEqual);

function areMinimapPropsEqual(prev: MinimapProps, next: MinimapProps) {
    return prev.items === next.items && prev.viewport === next.viewport && prev.viewportSize.width === next.viewportSize.width && prev.viewportSize.height === next.viewportSize.height && prev.onViewportChange === next.onViewportChange;
}
