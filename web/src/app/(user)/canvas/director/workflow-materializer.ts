import { nanoid } from "nanoid";

import type { AiConfig } from "@/stores/use-config-store";
import { NODE_DEFAULT_SIZE, getNodeSpec } from "../constants";
import { CanvasNodeType, type CanvasConnection, type CanvasGenerationMode, type CanvasNodeData, type CanvasNodeMetadata, type Position } from "../types";
import { getDirectorReferenceNodeIds, shouldAttachReferencePackToStep } from "./reference-pack";
import type { DirectorStepMode, DirectorWorkflow, DirectorWorkflowMaterialization, DirectorWorkflowStep } from "./types";

type MaterializeDirectorWorkflowOptions = {
    workflow: DirectorWorkflow;
    center: Position;
    config: AiConfig;
    referenceNodeIds?: string[];
};

const COLUMN_GAP = 520;
const ROW_GAP = 72;

export function materializeDirectorWorkflow({ workflow, center, config, referenceNodeIds = [] }: MaterializeDirectorWorkflowOptions): { nodes: CanvasNodeData[]; connections: CanvasConnection[]; materialization: DirectorWorkflowMaterialization } {
    const depthByStepId = computeDepths(workflow.steps);
    const columns = groupStepsByDepth(workflow.steps, depthByStepId);
    const inputNode = createDirectorInputNode(workflow, {
        x: center.x - COLUMN_GAP,
        y: center.y,
    });
    const nodes: CanvasNodeData[] = [inputNode];
    const stepNodeIdByStepId = new Map<string, string>();
    const orderByStepId = new Map(workflow.steps.map((step, index) => [step.id, index]));

    columns.forEach((steps, depth) => {
        const totalHeight = steps.reduce((sum, step) => sum + getNodeHeight(step.mode), 0) + Math.max(0, steps.length - 1) * ROW_GAP;
        let y = center.y - totalHeight / 2;
        steps.forEach((step) => {
            const height = getNodeHeight(step.mode);
            const position = {
                x: center.x + depth * COLUMN_GAP,
                y: y + height / 2,
            };
            const node = createDirectorStepNode(workflow, step, position, orderByStepId.get(step.id) || 0, config, stepNodeIdByStepId, inputNode.id, referenceNodeIds);
            nodes.push(node);
            stepNodeIdByStepId.set(step.id, node.id);
            y += height + ROW_GAP;
        });
    });

    const connections = createDirectorConnections(workflow, inputNode.id, stepNodeIdByStepId, referenceNodeIds);
    const executableNodeIds = nodes.filter((node) => node.type === CanvasNodeType.Config).map((node) => node.id);
    return {
        nodes,
        connections,
        materialization: {
            workflowId: workflow.id,
            nodeIds: nodes.map((node) => node.id),
            connectionIds: connections.map((connection) => connection.id),
            executableNodeIds,
            firstNodeId: nodes[0]?.id,
        },
    };
}

function createDirectorInputNode(workflow: DirectorWorkflow, center: Position): CanvasNodeData {
    const spec = getNodeSpec(CanvasNodeType.Text);
    const references = workflow.references.length ? `\n\n参考素材：\n${workflow.references.map((reference, index) => `${index + 1}. ${reference.title}`).join("\n")}` : "";
    const pack = workflow.referencePack?.length ? `\n\n客户素材包：\n${workflow.referencePack.map((item, index) => `${index + 1}. ${item.title} / ${item.role} / ${item.mediaType}`).join("\n")}` : "";
    return {
        id: `director-input-${nanoid(8)}`,
        type: CanvasNodeType.Text,
        title: workflow.title || "Director Brief",
        position: { x: center.x - spec.width / 2, y: center.y - spec.height / 2 },
        width: spec.width,
        height: spec.height,
        metadata: {
            content: `# ${workflow.title}\n\n${workflow.sourcePrompt}${references}${pack}`,
            prompt: workflow.sourcePrompt,
            status: "success",
            fontSize: 14,
            director: {
                workflowId: workflow.id,
                role: "input",
                runState: "done",
            },
        },
    };
}

function createDirectorStepNode(workflow: DirectorWorkflow, step: DirectorWorkflowStep, center: Position, order: number, config: AiConfig, stepNodeIdByStepId: Map<string, string>, inputNodeId: string, referenceNodeIds: string[]): CanvasNodeData {
    const type = step.mode === "note" ? CanvasNodeType.Text : CanvasNodeType.Config;
    const spec = getNodeSpec(type);
    const metadata = step.mode === "note" ? createNoteMetadata(workflow, step, order) : createConfigMetadata(workflow, step, order, config, stepNodeIdByStepId, inputNodeId, referenceNodeIds);
    return {
        id: `director-${step.mode}-${nanoid(8)}`,
        type,
        title: step.title,
        position: { x: center.x - spec.width / 2, y: center.y - spec.height / 2 },
        width: spec.width,
        height: spec.height,
        metadata,
    };
}

function createNoteMetadata(workflow: DirectorWorkflow, step: DirectorWorkflowStep, order: number): CanvasNodeMetadata {
    return {
        content: `# ${step.title}\n\n${step.description ? `${step.description}\n\n` : ""}${step.prompt}`,
        prompt: step.prompt,
        status: "success",
        fontSize: 14,
        director: {
            workflowId: workflow.id,
            stepId: step.id,
            role: "note",
            dependencyStepIds: step.dependsOn || [],
            plannedOrder: order,
            runState: "done",
        },
    };
}

function createConfigMetadata(workflow: DirectorWorkflow, step: DirectorWorkflowStep, order: number, config: AiConfig, stepNodeIdByStepId: Map<string, string>, inputNodeId: string, referenceNodeIds: string[]): CanvasNodeMetadata {
    const mode = step.mode as CanvasGenerationMode;
    const composerContent = buildComposerContent(workflow, step, stepNodeIdByStepId, inputNodeId, referenceNodeIds);
    return {
        content: "",
        prompt: step.prompt,
        composerContent,
        status: "idle",
        generationMode: mode,
        model: modelForMode(config, mode),
        quality: config.quality,
        size: config.size,
        count: mode === "image" ? Math.max(1, Math.min(15, Math.floor(Math.abs(Number(config.canvasImageCount || config.count)) || 1))) : Math.max(1, Math.min(15, Math.floor(Math.abs(Number(config.count)) || 1))),
        seconds: config.videoSeconds,
        vquality: config.vquality,
        generateAudio: config.videoGenerateAudio,
        watermark: config.videoWatermark,
        audioVoice: config.audioVoice,
        audioFormat: config.audioFormat,
        audioSpeed: config.audioSpeed,
        audioInstructions: config.audioInstructions,
        director: {
            workflowId: workflow.id,
            stepId: step.id,
            role: "step",
            mode,
            dependencyStepIds: step.dependsOn || [],
            plannedOrder: order,
            runState: "ready",
        },
    };
}

function buildComposerContent(workflow: DirectorWorkflow, step: DirectorWorkflowStep, stepNodeIdByStepId: Map<string, string>, inputNodeId: string, referenceNodeIds: string[]) {
    const tokenNodeIds = collectComposerTokenNodeIds(workflow, step, stepNodeIdByStepId, inputNodeId, referenceNodeIds);
    const tokens = tokenNodeIds.map((nodeId) => `@[node:${nodeId}]`);
    return `${tokens.join(" ")}\n\n${step.prompt}`;
}

function collectComposerTokenNodeIds(workflow: DirectorWorkflow, step: DirectorWorkflowStep, stepNodeIdByStepId: Map<string, string>, inputNodeId: string, referenceNodeIds: string[]) {
    const stepIndex = workflow.steps.findIndex((item) => item.id === step.id);
    const dependencyIds = (step.dependsOn || []).flatMap((stepId) => {
        const nodeId = stepNodeIdByStepId.get(stepId);
        return nodeId ? [nodeId] : [];
    });
    const priorStepIds = workflow.steps.slice(0, Math.max(0, stepIndex)).map((item) => item.id);
    const needsCumulativeContext = shouldUseCumulativeContext(step);
    const priorIds = needsCumulativeContext
        ? priorStepIds.flatMap((stepId) => {
              const nodeId = stepNodeIdByStepId.get(stepId);
              return nodeId ? [nodeId] : [];
          })
        : collectKeyPriorStepIds(workflow, priorStepIds).flatMap((stepId) => {
              const nodeId = stepNodeIdByStepId.get(stepId);
              return nodeId ? [nodeId] : [];
          });

    const packNodeIds = shouldAttachReferencePackToStep(step) ? Array.from(new Set([...getDirectorReferenceNodeIds(workflow.referencePack || []), ...referenceNodeIds])) : [];
    const ordered = [...packNodeIds, ...(dependencyIds.length ? dependencyIds : [inputNodeId]), ...priorIds];
    const seen = new Set<string>();
    return ordered.filter((nodeId) => {
        if (seen.has(nodeId)) return false;
        seen.add(nodeId);
        return true;
    });
}

function shouldUseCumulativeContext(step: DirectorWorkflowStep) {
    const text = `${step.id}\n${step.title}\n${step.description || ""}\n${step.prompt}`.toLowerCase();
    return /storyboard|edit|review|分镜|故事板|剪辑|缺片|审校|复核|返工/.test(text);
}

function collectKeyPriorStepIds(workflow: DirectorWorkflow, priorStepIds: string[]) {
    const keyPattern = /brief|bible|hero|consistency|scene|detail|storyboard|主题|视觉|首图|主视觉|一致性|场景|关键帧|细节|特写|故事板|分镜/;
    return priorStepIds.filter((stepId) => {
        const step = workflow.steps.find((item) => item.id === stepId);
        if (!step) return false;
        return keyPattern.test(`${step.id}\n${step.title}\n${step.description || ""}\n${step.prompt}`.toLowerCase());
    });
}

function createDirectorConnections(workflow: DirectorWorkflow, inputNodeId: string, stepNodeIdByStepId: Map<string, string>, referenceNodeIds: string[]) {
    const connections: CanvasConnection[] = [];
    const packNodeIds = getDirectorReferenceNodeIds(workflow.referencePack || []);
    const allReferenceNodeIds = Array.from(new Set([...referenceNodeIds, ...packNodeIds]));
    const addConnection = (fromNodeId: string, toNodeId: string) => {
        if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) return;
        if (connections.some((connection) => connection.fromNodeId === fromNodeId && connection.toNodeId === toNodeId)) return;
        connections.push({ id: nanoid(), fromNodeId, toNodeId });
    };

    workflow.steps.forEach((step) => {
        const toNodeId = stepNodeIdByStepId.get(step.id);
        if (!toNodeId) return;
        const dependencies = (step.dependsOn || []).map((stepId) => stepNodeIdByStepId.get(stepId)).filter((nodeId): nodeId is string => Boolean(nodeId));
        if (dependencies.length) {
            dependencies.forEach((fromNodeId) => addConnection(fromNodeId, toNodeId));
        } else {
            addConnection(inputNodeId, toNodeId);
        }
        if (shouldAttachReferencePackToStep(step)) allReferenceNodeIds.forEach((referenceNodeId) => addConnection(referenceNodeId, toNodeId));
    });

    return connections;
}

function computeDepths(steps: DirectorWorkflowStep[]) {
    const depthByStepId = new Map<string, number>();
    const stepById = new Map(steps.map((step) => [step.id, step]));
    const resolveDepth = (step: DirectorWorkflowStep): number => {
        const cached = depthByStepId.get(step.id);
        if (typeof cached === "number") return cached;
        const parents = (step.dependsOn || []).map((id) => stepById.get(id)).filter((item): item is DirectorWorkflowStep => Boolean(item));
        const depth = parents.length ? Math.max(...parents.map(resolveDepth)) + 1 : 0;
        depthByStepId.set(step.id, depth);
        return depth;
    };
    steps.forEach(resolveDepth);
    return depthByStepId;
}

function groupStepsByDepth(steps: DirectorWorkflowStep[], depthByStepId: Map<string, number>) {
    const columns: DirectorWorkflowStep[][] = [];
    steps.forEach((step) => {
        const depth = depthByStepId.get(step.id) || 0;
        if (!columns[depth]) columns[depth] = [];
        columns[depth].push(step);
    });
    return columns;
}

function getNodeHeight(mode: DirectorStepMode) {
    return mode === "note" ? NODE_DEFAULT_SIZE[CanvasNodeType.Text].height : NODE_DEFAULT_SIZE[CanvasNodeType.Config].height;
}

function modelForMode(config: AiConfig, mode: CanvasGenerationMode) {
    if (mode === "image") return config.imageModel || config.model;
    if (mode === "video") return config.videoModel || config.model;
    if (mode === "audio") return config.audioModel || config.model;
    return config.textModel || config.model;
}
