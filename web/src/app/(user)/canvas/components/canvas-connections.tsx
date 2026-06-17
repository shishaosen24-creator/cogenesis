import React from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasConnection, CanvasNodeData, ConnectionHandle, Position } from "../types";

export const ConnectionPath = React.memo(function ConnectionPath({
    connection,
    from,
    to,
    active,
    onSelect,
    onContextMenu,
}: ConnectionPathProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const startX = from.position.x + from.width;
    const startY = from.position.y + from.height / 2;
    const endX = to.position.x;
    const endY = to.position.y + to.height / 2;
    const dx = Math.abs(endX - startX);
    const curvature = Math.max(dx * 0.5, 50);
    const pathD = `M ${startX} ${startY} C ${startX + curvature} ${startY}, ${endX - curvature} ${endY}, ${endX} ${endY}`;

    return (
        <g>
            <path
                data-connection-id={connection.id}
                d={pathD}
                stroke="transparent"
                strokeWidth="16"
                fill="none"
                style={{ cursor: "pointer", pointerEvents: "stroke" }}
                onClick={(event) => {
                    event.stopPropagation();
                    onSelect(connection.id);
                }}
                onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onContextMenu?.(event, connection.id);
                }}
            />
            <path
                d={pathD}
                stroke={active ? theme.node.activeStroke : theme.node.muted}
                strokeWidth={active ? 3 : 2}
                strokeOpacity={active ? 1 : 0.82}
                fill="none"
                style={{ filter: active ? `drop-shadow(0 0 8px ${theme.node.activeStroke}66)` : undefined, pointerEvents: "none" }}
            />
        </g>
    );
}, areConnectionPathPropsEqual);

export type ConnectionLayerItem = {
    id: string;
    d: string;
};

type ConnectionLayerProps = {
    items: ConnectionLayerItem[];
};

export const ConnectionLayer = React.memo(function ConnectionLayer({ items }: ConnectionLayerProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    if (!items.length) return null;

    return (
        <g aria-hidden>
            <path
                d={items.map((item) => item.d).join(" ")}
                stroke={theme.node.muted}
                strokeWidth={2}
                strokeOpacity={0.82}
                fill="none"
                style={{ pointerEvents: "none" }}
            />
        </g>
    );
}, areConnectionLayerPropsEqual);

function areConnectionLayerPropsEqual(prev: ConnectionLayerProps, next: ConnectionLayerProps) {
    return prev.items === next.items;
}

function areConnectionPathPropsEqual(prev: ConnectionPathProps, next: ConnectionPathProps) {
    return prev.connection === next.connection && prev.from === next.from && prev.to === next.to && prev.active === next.active && prev.onSelect === next.onSelect && prev.onContextMenu === next.onContextMenu;
}

type ConnectionPathProps = {
    connection: CanvasConnection;
    from: CanvasNodeData;
    to: CanvasNodeData;
    active: boolean;
    onSelect: (connectionId: string) => void;
    onContextMenu?: (event: ReactMouseEvent<SVGPathElement>, connectionId: string) => void;
};

export function ActiveConnectionPath({ node, handle, mouseWorld, target }: { node?: CanvasNodeData; handle: ConnectionHandle; mouseWorld: Position; target?: CanvasNodeData }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    if (!node) return null;

    const startX = handle.handleType === "source" ? node.position.x + node.width : mouseWorld.x;
    const startY = handle.handleType === "source" ? node.position.y + node.height / 2 : mouseWorld.y;
    const endX = handle.handleType === "source" ? mouseWorld.x : node.position.x;
    const endY = handle.handleType === "source" ? mouseWorld.y : node.position.y + node.height / 2;
    const snappedStartX = handle.handleType === "target" && target ? target.position.x + target.width : startX;
    const snappedStartY = handle.handleType === "target" && target ? target.position.y + target.height / 2 : startY;
    const snappedEndX = handle.handleType === "source" && target ? target.position.x : endX;
    const snappedEndY = handle.handleType === "source" && target ? target.position.y + target.height / 2 : endY;
    const distance = Math.abs(snappedEndX - snappedStartX);
    const pathD = `M ${snappedStartX} ${snappedStartY} C ${snappedStartX + distance * 0.5} ${snappedStartY}, ${snappedEndX - distance * 0.5} ${snappedEndY}, ${snappedEndX} ${snappedEndY}`;

    return <path d={pathD} stroke={theme.node.activeStroke} strokeWidth="2" fill="none" strokeDasharray="5,5" />;
}
