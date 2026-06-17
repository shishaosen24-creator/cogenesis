import type { CanvasGenerationMode } from "../types";
import type { CanvasNodeType } from "../types";

export type DirectorStepMode = CanvasGenerationMode | "note";
export type DirectorReferenceRole = "product" | "logo" | "character" | "scene" | "style" | "reference-video" | "reference-audio" | "user-reference" | "other";
export type DirectorReferenceMediaType = "image" | "video" | "audio" | "text";
export type DirectorWorkflowRevisionSource = {
    workflowId: string;
    workflowTitle?: string;
    summary?: string;
};

export type DirectorWorkflowReference = {
    id: string;
    type: string;
    title: string;
    text?: string;
};

export type DirectorReferencePackItem = {
    id: string;
    nodeId: string;
    role: DirectorReferenceRole;
    mediaType: DirectorReferenceMediaType;
    title: string;
    type: CanvasNodeType;
    text?: string;
    dataUrl?: string;
    url?: string;
    storageKey?: string;
    mimeType?: string;
    bytes?: number;
    width?: number;
    height?: number;
    durationMs?: number;
};

export type DirectorWorkflowStep = {
    id: string;
    title: string;
    mode: DirectorStepMode;
    prompt: string;
    description?: string;
    dependsOn?: string[];
};

export type DirectorWorkflow = {
    id: string;
    title: string;
    summary: string;
    sourcePrompt: string;
    revisionOf?: DirectorWorkflowRevisionSource;
    revisionIndex?: number;
    references: DirectorWorkflowReference[];
    referencePack?: DirectorReferencePackItem[];
    steps: DirectorWorkflowStep[];
    createdAt: string;
};

export type DirectorWorkflowMaterialization = {
    workflowId: string;
    nodeIds: string[];
    connectionIds: string[];
    executableNodeIds: string[];
    firstNodeId?: string;
};

export type DirectorWorkflowRunReport = {
    workflowId: string;
    executedCount: number;
    skippedCount: number;
    failedCount: number;
};
