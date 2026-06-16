export type Position = {
    x: number;
    y: number;
};

export type ViewportTransform = {
    x: number;
    y: number;
    k: number;
};

export enum CanvasNodeType {
    Image = "image",
    Text = "text",
    Config = "config",
    Video = "video",
    Audio = "audio",
}

export type CanvasNodeStatus = "idle" | "success" | "loading" | "error";
export type CanvasGenerationMode = "text" | "image" | "video" | "audio";
export type CanvasImageGenerationType = "generation" | "edit";
export type AIChainEventType = "thinking" | "plan" | "create_node" | "update_node" | "connect_nodes" | "run_generation" | "read_result" | "verify" | "handoff" | "error";
export type AIChainEventState = "planned" | "running" | "done" | "error" | "waiting";
export type AIChainEventActor = "director" | "local-agent" | "system" | "user";

export type AIChainEvent = {
    id: string;
    workflowId: string;
    parentId?: string;
    stepId?: string;
    nodeId?: string;
    connectionId?: string;
    actor: AIChainEventActor;
    type: AIChainEventType;
    state: AIChainEventState;
    title: string;
    summary: string;
    detail?: string;
    createdAt: string;
    startedAt?: string;
    finishedAt?: string;
};

export type CanvasNodeMetadata = {
    content?: string;
    composerContent?: string;
    prompt?: string;
    status?: CanvasNodeStatus;
    errorDetails?: string;
    fontSize?: number;
    generationMode?: CanvasGenerationMode;
    generationType?: CanvasImageGenerationType;
    model?: string;
    size?: string;
    quality?: string;
    count?: number;
    seconds?: string;
    vquality?: string;
    generateAudio?: string;
    watermark?: string;
    audioVoice?: string;
    audioFormat?: string;
    audioSpeed?: string;
    audioInstructions?: string;
    references?: string[];
    naturalWidth?: number;
    naturalHeight?: number;
    freeResize?: boolean;
    isBatchRoot?: boolean;
    batchRootId?: string;
    batchChildIds?: string[];
    batchUsesReferenceImages?: boolean;
    primaryImageId?: string;
    imageBatchExpanded?: boolean;
    storageKey?: string;
    mimeType?: string;
    bytes?: number;
    durationMs?: number;
    director?: {
        workflowId: string;
        stepId?: string;
        role: "input" | "step" | "output" | "note";
        mode?: CanvasGenerationMode;
        dependencyStepIds?: string[];
        plannedOrder?: number;
        runState?: "planned" | "ready" | "running" | "done" | "error";
    };
};

export type CanvasNodeData = {
    id: string;
    type: CanvasNodeType;
    title: string;
    position: Position;
    width: number;
    height: number;
    metadata?: CanvasNodeMetadata;
};

export type CanvasConnection = {
    id: string;
    fromNodeId: string;
    toNodeId: string;
};

export type CanvasAssistantReference = {
    id: string;
    type: CanvasNodeType;
    title: string;
    dataUrl?: string;
    storageKey?: string;
    text?: string;
};

export type CanvasAssistantImage = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    prompt: string;
};

export type CanvasAssistantMessage = {
    id: string;
    role: "user" | "assistant";
    mode: "ask" | "image" | "director";
    text: string;
    isLoading?: boolean;
    isExecuting?: boolean;
    references?: CanvasAssistantReference[];
    referencePack?: import("./director/types").DirectorReferencePackItem[];
    images?: CanvasAssistantImage[];
    directorWorkflow?: import("./director/types").DirectorWorkflow;
    directorMaterialization?: import("./director/types").DirectorWorkflowMaterialization;
    directorRunReport?: import("./director/types").DirectorWorkflowRunReport;
};

export type CanvasAssistantSession = {
    id: string;
    title: string;
    messages: CanvasAssistantMessage[];
    createdAt: string;
    updatedAt: string;
};

export type ConnectionHandle = {
    nodeId: string;
    handleType: "source" | "target";
};

export type SelectionBox = {
    startWorldX: number;
    startWorldY: number;
    currentWorldX: number;
    currentWorldY: number;
    additive: boolean;
    initialSelectedNodeIds: string[];
};

export type ContextMenuState =
    | {
          type: "node";
          x: number;
          y: number;
          nodeId: string;
      }
    | {
          type: "connection";
          x: number;
          y: number;
          connectionId: string;
      };
