import type { CanvasNodeData } from "../types";

const DEFAULT_CELL_SIZE = 960;

type CanvasNodeSpatialIndex = {
    nodes: CanvasNodeData[];
    cellSize: number;
    cells: Map<string, number[]>;
};

type CanvasRect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};

export function createCanvasNodeSpatialIndex(nodes: CanvasNodeData[], cellSize = DEFAULT_CELL_SIZE): CanvasNodeSpatialIndex {
    const cells = new Map<string, number[]>();
    nodes.forEach((node, index) => {
        const minCellX = Math.floor(node.position.x / cellSize);
        const maxCellX = Math.floor((node.position.x + node.width) / cellSize);
        const minCellY = Math.floor(node.position.y / cellSize);
        const maxCellY = Math.floor((node.position.y + node.height) / cellSize);

        for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
            for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
                const key = `${cellX}:${cellY}`;
                const bucket = cells.get(key);
                if (bucket) bucket.push(index);
                else cells.set(key, [index]);
            }
        }
    });

    return { nodes, cellSize, cells };
}

export function queryCanvasNodeSpatialIndex(index: CanvasNodeSpatialIndex, rect: CanvasRect, hiddenIds?: Set<string>) {
    const minCellX = Math.floor(rect.left / index.cellSize);
    const maxCellX = Math.floor(rect.right / index.cellSize);
    const minCellY = Math.floor(rect.top / index.cellSize);
    const maxCellY = Math.floor(rect.bottom / index.cellSize);
    const candidateIndexes = new Set<number>();

    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
            const bucket = index.cells.get(`${cellX}:${cellY}`);
            if (!bucket) continue;
            bucket.forEach((entry) => candidateIndexes.add(entry));
        }
    }

    return Array.from(candidateIndexes)
        .sort((a, b) => a - b)
        .map((entry) => index.nodes[entry])
        .filter((node) => {
            if (hiddenIds?.has(node.id)) return false;
            return node.position.x + node.width > rect.left && node.position.x < rect.right && node.position.y + node.height > rect.top && node.position.y < rect.bottom;
        });
}
