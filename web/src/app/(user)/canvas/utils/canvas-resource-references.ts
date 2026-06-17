import { imageReferenceLabel } from "@/lib/image-reference-prompt";
import { seedanceReferenceLabel } from "@/lib/seedance-video";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "../types";

export type CanvasResourceKind = "image" | "video" | "audio" | "text";

export type CanvasResourceReference = {
    id: string;
    nodeId: string;
    kind: CanvasResourceKind;
    label: string;
    title: string;
    previewUrl?: string;
    text?: string;
    active: boolean;
};

export type CanvasGenerationResourceEntry = {
    node: CanvasNodeData;
    sourceNodeId?: string;
};

export function buildCanvasResourceReferences(nodes: CanvasNodeData[], connections: CanvasConnection[], contextNodeId?: string | null) {
    const contextNodes = contextNodeId ? getMentionResourceNodes(contextNodeId, nodes, connections) : [];
    const globalReferences = labelResourceNodes(nodes.filter(isResourceNode), false);
    const activeByNodeId = new Map(labelResourceNodes(contextNodes, true).map((reference) => [reference.nodeId, reference]));
    return globalReferences.map((reference) => activeByNodeId.get(reference.nodeId) || reference);
}

export function buildNodeMentionReferences(node: CanvasNodeData, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    return labelResourceNodes(getMentionResourceNodes(node.id, nodes, connections), true);
}

export function getMentionResourceNodes(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    const configInputs = getConnectedConfigResourceNodes(nodeId, nodes, connections);
    if (configInputs.length) return configInputs;
    const ownInputs = getContextResourceNodes(nodeId, nodes, connections);
    if (ownInputs.length) return ownInputs;
    const node = nodes.find((item) => item.id === nodeId);
    return node && isResourceNode(node) ? [node] : [];
}

export function getGenerationResourceNodes(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    return getGenerationResourceEntries(nodeId, nodes, connections).map((entry) => entry.node);
}

export function getGenerationResourceEntries(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]): CanvasGenerationResourceEntry[] {
    const configInputs = getConnectedConfigResourceNodes(nodeId, nodes, connections);
    if (configInputs.length) return configInputs.map((node) => ({ node }));
    const ownInputs = getContextResourceEntries(nodeId, nodes, connections);
    if (ownInputs.length) return ownInputs;
    return [];
}

function getContextResourceNodes(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    return getContextResourceEntries(nodeId, nodes, connections).map((entry) => entry.node);
}

function getContextResourceEntries(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]): CanvasGenerationResourceEntry[] {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    return uniqueResourceEntries(
        connections
            .filter((connection) => connection.toNodeId === nodeId)
            .flatMap((connection) => {
                const source = nodeById.get(connection.fromNodeId);
                if (!source) return [];
                if (isResourceNode(source)) return [{ node: source, sourceNodeId: source.id }];
                if (source.type === CanvasNodeType.Config) return getGeneratedResourceNodes(source.id, nodes, connections).map((node) => ({ node, sourceNodeId: source.id }));
                return [];
            }),
    );
}

function getDirectContextResourceNodes(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    return connections
        .filter((connection) => connection.toNodeId === nodeId)
        .map((connection) => nodes.find((node) => node.id === connection.fromNodeId))
        .filter((node): node is CanvasNodeData => Boolean(node && isResourceNode(node)));
}

function getConnectedConfigResourceNodes(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    const configConnection = connections.find((connection) => connection.fromNodeId === nodeId && nodes.find((node) => node.id === connection.toNodeId)?.type === CanvasNodeType.Config);
    if (!configConnection) return [];
    return getDirectContextResourceNodes(configConnection.toNodeId, nodes, connections).filter((node) => node.id !== nodeId);
}

function getGeneratedResourceNodes(sourceNodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const directOutputs = connections
        .filter((connection) => connection.fromNodeId === sourceNodeId)
        .map((connection) => nodeById.get(connection.toNodeId))
        .filter((node): node is CanvasNodeData => Boolean(node && isResourceNode(node)));

    return uniqueNodes(
        directOutputs.flatMap((node) => {
            const batchChildren = (node.metadata?.batchChildIds || []).map((childId) => nodeById.get(childId)).filter((child): child is CanvasNodeData => Boolean(child && isResourceNode(child)));
            return [node, ...batchChildren];
        }),
    );
}

function uniqueNodes(nodes: CanvasNodeData[]) {
    const seen = new Set<string>();
    return nodes.filter((node) => {
        if (seen.has(node.id)) return false;
        seen.add(node.id);
        return true;
    });
}

function uniqueResourceEntries(entries: CanvasGenerationResourceEntry[]) {
    const seen = new Set<string>();
    return entries.filter((entry) => {
        const key = `${entry.sourceNodeId || entry.node.id}:${entry.node.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function labelResourceNodes(nodes: CanvasNodeData[], active: boolean) {
    const counts: Record<CanvasResourceKind, number> = { image: 0, video: 0, audio: 0, text: 0 };
    return nodes.flatMap((node): CanvasResourceReference[] => {
        const kind = resourceKind(node);
        if (!kind) return [];
        const index = counts[kind]++;
        const label = labelForKind(kind, index, node);
        return [
            {
                id: node.id,
                nodeId: node.id,
                kind,
                label,
                title: node.title || label,
                previewUrl: node.metadata?.content,
                text: node.type === CanvasNodeType.Text ? node.metadata?.content || node.metadata?.prompt : undefined,
                active,
            },
        ];
    });
}

function labelForKind(kind: CanvasResourceKind, index: number, node: CanvasNodeData) {
    if (node.metadata?.directorReferenceRole === "user-reference") return "用户素材参考";
    if (kind === "image") return imageReferenceLabel(index);
    if (kind === "video") return seedanceReferenceLabel("video", index);
    if (kind === "audio") return seedanceReferenceLabel("audio", index);
    return `文本${index + 1}`;
}

function isResourceNode(node: CanvasNodeData) {
    return Boolean(resourceKind(node));
}

function resourceKind(node: CanvasNodeData): CanvasResourceKind | null {
    if (node.type === CanvasNodeType.Image && node.metadata?.content) return "image";
    if (node.type === CanvasNodeType.Video && node.metadata?.content) return "video";
    if (node.type === CanvasNodeType.Audio && node.metadata?.content) return "audio";
    if (node.type === CanvasNodeType.Text && (node.metadata?.content || node.metadata?.prompt)) return "text";
    return null;
}
