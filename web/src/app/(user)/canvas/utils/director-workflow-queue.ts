import type { CanvasAgentTaskQueueItem } from "./canvas-agent-ops";

export type DirectorWorkflowQueueState = "planned" | "running" | "done" | "error";

export type DirectorWorkflowQueueSummary = {
    workflowId: string;
    title: string;
    total: number;
    planned: number;
    running: number;
    done: number;
    error: number;
    state: DirectorWorkflowQueueState;
};

export function buildDirectorWorkflowQueueSummary(queue: CanvasAgentTaskQueueItem[]): DirectorWorkflowQueueSummary[] {
    const byWorkflow = new Map<string, CanvasAgentTaskQueueItem[]>();
    queue.forEach((item) => byWorkflow.set(item.workflowId, [...(byWorkflow.get(item.workflowId) || []), item]));

    return Array.from(byWorkflow.entries()).map(([workflowId, items]) => {
        const title = items.find((item) => item.role === "input")?.title || items[0]?.title || "导演工作流";
        const planned = items.filter((item) => item.runState === "planned" || item.runState === "ready").length;
        const running = items.filter((item) => item.runState === "running").length;
        const done = items.filter((item) => item.runState === "done").length;
        const error = items.filter((item) => item.runState === "error").length;
        return {
            workflowId,
            title,
            total: items.length,
            planned,
            running,
            done,
            error,
            state: error ? "error" : running ? "running" : planned ? "planned" : "done",
        };
    });
}
