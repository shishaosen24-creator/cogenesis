import type { CanvasAgentAssetPackItem, CanvasAgentTaskQueueItem } from "../utils/canvas-agent-ops";
import type { DirectorWorkflow, DirectorWorkflowMaterialization } from "./types";

type BuildDirectorAgentHandoffInput = {
    workflow: DirectorWorkflow;
    materialization: DirectorWorkflowMaterialization;
    assetPack: CanvasAgentAssetPackItem[];
    taskQueue: CanvasAgentTaskQueueItem[];
};

export function buildDirectorAgentHandoffPrompt({ workflow, materialization, assetPack, taskQueue }: BuildDirectorAgentHandoffInput) {
    const steps = workflow.steps.map((step, index) => `${index + 1}. ${step.title} [${step.mode}]`);
    const assetLines = assetPack.length ? assetPack.map((item, index) => `${index + 1}. ${item.title} / ${item.source} / ${item.role || "other"} / ${item.mediaType}`).join("\n") : "无";
    const taskLines = taskQueue.length
        ? taskQueue
              .map((item, index) => `${index + 1}. ${item.title} / ${item.role} / ${item.mode || "text"} / ${item.runState}`)
              .join("\n")
        : "无";

    return [
        "你现在接管的是 CoGenesis 的本地 Agent 执行层。",
        "导演台管创作逻辑，本地 Agent 管画布执行。",
        "你的任务不是重新设计创意，而是把导演台已经规划好的工作流，稳定地落到画布上。",
        "",
        `工作流标题：${workflow.title}`,
        `工作流摘要：${workflow.summary}`,
        "",
        "导演台步骤：",
        steps.join("\n"),
        "",
        `已搭建到画布：${materialization.nodeIds.length} 个节点，${materialization.connectionIds.length} 条连线。`,
        `可执行节点：${materialization.executableNodeIds.length}`,
        "",
        "共享素材包：",
        assetLines,
        "",
        "当前任务队列：",
        taskLines,
        "",
        "执行要求：",
        "1. 先读取任务队列，优先处理 ready 或 planned 的导演步骤。",
        "2. 保持人物、主体、产品、场景、Logo、光线和风格一致。",
        "3. 遇到需要生成时，直接使用画布工具改节点或触发生成。",
        "4. 不要重写导演创作逻辑，不要丢掉故事板和一致性约束。",
        "5. 如果发现缺片或不一致，返回需要返工的节点和原因。",
        "",
        "原始工作流内容：",
        workflow.steps.map((step) => `- ${step.title}: ${step.prompt}`).join("\n"),
    ].join("\n");
}
