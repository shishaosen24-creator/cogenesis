import { type AIChainEvent, type AIChainEventState, type CanvasConnection, type CanvasNodeData } from "../types";

type BuildDirectorWorkflowChainEventsInput = {
    workflowId: string;
    workflowTitle?: string;
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    createdAt?: string;
};

const DEFAULT_CREATED_AT = "1970-01-01T00:00:00.000Z";

export function buildDirectorWorkflowChainEvents({ workflowId, workflowTitle = "导演工作流", nodes, connections, createdAt = DEFAULT_CREATED_AT }: BuildDirectorWorkflowChainEventsInput): AIChainEvent[] {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const directorNodes = nodes
        .filter((node) => node.metadata?.director?.workflowId === workflowId)
        .sort((first, second) => (first.metadata?.director?.plannedOrder ?? -1) - (second.metadata?.director?.plannedOrder ?? -1));
    const events: AIChainEvent[] = [
        {
            id: `${workflowId}:plan`,
            workflowId,
            actor: "director",
            type: "plan",
            state: directorNodes.length ? "done" : "planned",
            title: "规划工作流",
            summary: `导演台已把「${workflowTitle}」拆成 ${Math.max(0, directorNodes.length - 1)} 个可执行节点。`,
            createdAt,
            finishedAt: directorNodes.length ? createdAt : undefined,
        },
    ];

    directorNodes.forEach((node) => {
        const director = node.metadata!.director!;
        const state = mapDirectorState(director.runState);
        events.push({
            id: `${workflowId}:node:${node.id}`,
            workflowId,
            parentId: `${workflowId}:plan`,
            stepId: director.stepId,
            nodeId: node.id,
            actor: "director",
            type: "create_node",
            state: state === "running" || state === "error" ? "done" : state,
            title: `创建节点：${node.title}`,
            summary: `AI 创建了「${node.title}」节点，类型为 ${modeLabel(director.mode || node.metadata?.generationMode || node.type)}。`,
            detail: director.dependencyStepIds?.length ? `依赖步骤：${director.dependencyStepIds.join("、")}` : undefined,
            createdAt,
            finishedAt: state === "planned" ? undefined : createdAt,
        });
        if (director.role === "step" && director.mode) {
            events.push({
                id: `${workflowId}:run:${node.id}`,
                workflowId,
                parentId: `${workflowId}:node:${node.id}`,
                stepId: director.stepId,
                nodeId: node.id,
                actor: "director",
                type: state === "error" ? "error" : "run_generation",
                state,
                title: `${stateLabel(state)}：${node.title}`,
                summary: buildRunSummary(node, state),
                createdAt,
                startedAt: state === "running" || state === "done" || state === "error" ? createdAt : undefined,
                finishedAt: state === "done" || state === "error" ? createdAt : undefined,
            });
        }
    });

    connections
        .filter((connection) => nodeById.get(connection.fromNodeId)?.metadata?.director?.workflowId === workflowId && nodeById.get(connection.toNodeId)?.metadata?.director?.workflowId === workflowId)
        .forEach((connection) => {
            const from = nodeById.get(connection.fromNodeId);
            const to = nodeById.get(connection.toNodeId);
            if (!from || !to) return;
            events.push({
                id: `${workflowId}:connection:${connection.id}`,
                workflowId,
                parentId: `${workflowId}:node:${to.id}`,
                stepId: to.metadata?.director?.stepId,
                nodeId: to.id,
                connectionId: connection.id,
                actor: "director",
                type: "connect_nodes",
                state: "done",
                title: `连接：${from.title} -> ${to.title}`,
                summary: `AI 连线「${from.title}」到「${to.title}」，让下游节点读取上游结果。`,
                createdAt,
                finishedAt: createdAt,
            });
        });

    return events;
}

function mapDirectorState(state?: "planned" | "ready" | "running" | "done" | "error"): AIChainEventState {
    if (state === "running") return "running";
    if (state === "done") return "done";
    if (state === "error") return "error";
    if (state === "ready") return "waiting";
    return "planned";
}

function buildRunSummary(node: CanvasNodeData, state: AIChainEventState) {
    if (state === "running") return `AI 正在执行「${node.title}」，等待生成结果返回。`;
    if (state === "done") return `「${node.title}」已完成，结果可供下游节点继续引用。`;
    if (state === "error") return `「${node.title}」执行失败，请查看节点错误并重试。`;
    if (state === "waiting") return `「${node.title}」已就绪，等待执行。`;
    return `「${node.title}」已进入计划，等待上游链路完成。`;
}

function modeLabel(mode: string) {
    if (mode === "text") return "文本";
    if (mode === "image") return "图像";
    if (mode === "video") return "视频";
    if (mode === "audio") return "音频";
    if (mode === "config") return "生成配置";
    return mode;
}

function stateLabel(state: AIChainEventState) {
    if (state === "running") return "执行中";
    if (state === "done") return "完成";
    if (state === "error") return "失败";
    if (state === "waiting") return "就绪";
    return "计划";
}
