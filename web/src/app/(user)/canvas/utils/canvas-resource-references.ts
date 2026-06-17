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

export type CanvasResourceIndex = {
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    nodeById: Map<string, CanvasNodeData>;
    incomingByNodeId: Map<string, CanvasConnection[]>;
    outgoingByNodeId: Map<string, CanvasConnection[]>;
    resourceNodes: CanvasNodeData[];
};

export function createCanvasResourceIndex(nodes: CanvasNodeData[], connections: CanvasConnection[]): CanvasResourceIndex {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const incomingByNodeId = new Map<string, CanvasConnection[]>();
    const outgoingByNodeId = new Map<string, CanvasConnection[]>();
    connections.forEach((connection) => {
        const incoming = incomingByNodeId.get(connection.toNodeId) || [];
        incoming.push(connection);
        incomingByNodeId.set(connection.toNodeId, incoming);

        const outgoing = outgoingByNodeId.get(connection.fromNodeId) || [];
        outgoing.push(connection);
        outgoingByNodeId.set(connection.fromNodeId, outgoing);
    });
    return { nodes, connections, nodeById, incomingByNodeId, outgoingByNodeId, resourceNodes: nodes.filter(isResourceNode) };
}

export function buildCanvasResourceReferences(nodes: CanvasNodeData[], connections: CanvasConnection[], contextNodeId?: string | null, index = createCanvasResourceIndex(nodes, connections)) {
    const contextNodes = contextNodeId ? getMentionResourceNodes(contextNodeId, nodes, connections, index) : [];
    const globalReferences = labelResourceNodes(index.resourceNodes, false);
    const activeByNodeId = new Map(labelResourceNodes(contextNodes, true).map((reference) => [reference.nodeId, reference]));
    return globalReferences.map((reference) => activeByNodeId.get(reference.nodeId) || reference);
}

export function buildNodeMentionReferences(node: CanvasNodeData, nodes: CanvasNodeData[], connections: CanvasConnection[], index = createCanvasResourceIndex(nodes, connections)) {
    return labelResourceNodes(getMentionResourceNodes(node.id, nodes, connections, index), true);
}

export function getMentionResourceNodes(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[], index = createCanvasResourceIndex(nodes, connections)) {
    const configInputs = getConnectedConfigResourceNodes(nodeId, nodes, connections, index);
    if (configInputs.length) return configInputs;
    const ownInputs = getContextResourceNodes(nodeId, nodes, connections, index);
    if (ownInputs.length) return ownInputs;
    const node = index.nodeById.get(nodeId);
    return node && isResourceNode(node) ? [node] : [];
}

export function getGenerationResourceNodes(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    return getGenerationResourceEntries(nodeId, nodes, connections).map((entry) => entry.node);
}

export function getGenerationResourceEntries(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[], index = createCanvasResourceIndex(nodes, connections)): CanvasGenerationResourceEntry[] {
    const configInputs = getConnectedConfigResourceNodes(nodeId, nodes, connections, index);
    if (configInputs.length) return configInputs.map((node) => ({ node }));
    const ownInputs = getContextResourceEntries(nodeId, nodes, connections, index);
    if (ownInputs.length) return ownInputs;
    return [];
}

function getContextResourceNodes(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[], index: CanvasResourceIndex) {
    return getContextResourceEntries(nodeId, nodes, connections, index).map((entry) => entry.node);
}

function getContextResourceEntries(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[], index: CanvasResourceIndex): CanvasGenerationResourceEntry[] {
    return uniqueResourceEntries(
        (index.incomingByNodeId.get(nodeId) || [])
            .flatMap((connection) => {
                const source = index.nodeById.get(connection.fromNodeId);
                if (!source) return [];
                if (isResourceNode(source)) return [{ node: source, sourceNodeId: source.id }];
                if (source.type === CanvasNodeType.Config) return getGeneratedResourceNodes(source.id, nodes, connections, index).map((node) => ({ node, sourceNodeId: source.id }));
                return [];
            }),
    );
}

function getDirectContextResourceNodes(nodeId: string, index: CanvasResourceIndex) {
    return (index.incomingByNodeId.get(nodeId) || [])
        .map((connection) => index.nodeById.get(connection.fromNodeId))
        .filter((node): node is CanvasNodeData => Boolean(node && isResourceNode(node)));
}

function getConnectedConfigResourceNodes(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[], index: CanvasResourceIndex) {
    const configConnection = (index.outgoingByNodeId.get(nodeId) || []).find((connection) => index.nodeById.get(connection.toNodeId)?.type === CanvasNodeType.Config);
    if (!configConnection) return [];
    return getDirectContextResourceNodes(configConnection.toNodeId, index).filter((node) => node.id !== nodeId);
}

function getGeneratedResourceNodes(sourceNodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[], index: CanvasResourceIndex) {
    const directOutputs = (index.outgoingByNodeId.get(sourceNodeId) || [])
        .map((connection) => index.nodeById.get(connection.toNodeId))
        .filter((node): node is CanvasNodeData => Boolean(node && isResourceNode(node)));

    return uniqueNodes(
        directOutputs.flatMap((node) => {
            const batchChildren = (node.metadata?.batchChildIds || []).map((childId) => index.nodeById.get(childId)).filter((child): child is CanvasNodeData => Boolean(child && isResourceNode(child)));
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
