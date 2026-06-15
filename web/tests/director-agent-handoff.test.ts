import { describe, expect, it } from "bun:test";

import { buildDirectorAgentHandoffPrompt } from "../src/app/(user)/canvas/director/agent-handoff";
import type { CanvasAgentAssetPackItem, CanvasAgentSnapshot } from "../src/app/(user)/canvas/utils/canvas-agent-ops";
import { CanvasNodeType } from "../src/app/(user)/canvas/types";
import type { DirectorWorkflow } from "../src/app/(user)/canvas/director/types";

const workflow: DirectorWorkflow = {
    id: "director-bridge-test",
    title: "修护液整片",
    summary: "把主题拆成可执行导演工作流",
    sourcePrompt: "修护液广告",
    references: [{ id: "product", type: "image", title: "产品主图" }],
    createdAt: "2026-06-16T00:00:00.000Z",
    steps: [
        { id: "brief", title: "主题拆解", mode: "text", prompt: "拆解主题" },
        { id: "hero-image", title: "首图主视觉", mode: "image", prompt: "生成首图" },
        { id: "asset-storyboard", title: "资产故事板", mode: "text", prompt: "读取前面所有已生成节点结果" },
        { id: "video-segment-a", title: "视频片段A", mode: "video", prompt: "生成视频片段A" },
    ],
};

const materialization: CanvasAgentSnapshot["taskQueue"] extends never ? never : {
    workflowId: string;
    nodeIds: string[];
    connectionIds: string[];
    executableNodeIds: string[];
    firstNodeId?: string;
} = {
    workflowId: "director-bridge-test",
    nodeIds: ["input-node", "hero-node", "storyboard-node"],
    connectionIds: ["c1", "c2"],
    executableNodeIds: ["hero-node"],
    firstNodeId: "input-node",
};

const assetPack: CanvasAgentAssetPackItem[] = [
    {
        id: "asset-1",
        nodeId: "asset-node-1",
        source: "director-reference",
        role: "product",
        mediaType: "image",
        title: "修护液主图",
        type: CanvasNodeType.Image,
        summary: "产品瓶身和 Logo",
    },
];

const snapshot = {
    projectId: "canvas-1",
    title: "CoGenesis",
    nodes: [],
    connections: [],
    selectedNodeIds: [],
    viewport: { x: 0, y: 0, k: 1 },
    assetPack,
    taskQueue: [
        {
            id: "director-bridge-test:hero-image",
            nodeId: "hero-node",
            workflowId: "director-bridge-test",
            title: "首图主视觉",
            role: "step",
            mode: "image",
            prompt: "生成首图",
            plannedOrder: 2,
            runState: "ready",
            connectedFrom: ["brief"],
            connectedTo: ["asset-storyboard"],
        },
    ],
} satisfies CanvasAgentSnapshot;

describe("director agent handoff", () => {
    it("packages the director workflow into a local-agent execution brief", () => {
        const prompt = buildDirectorAgentHandoffPrompt({ workflow, materialization, assetPack, taskQueue: snapshot.taskQueue });

        expect(prompt).toContain("导演台管创作逻辑，本地 Agent 管画布执行");
        expect(prompt).toContain("修护液整片");
        expect(prompt).toContain("已搭建到画布：3 个节点，2 条连线");
        expect(prompt).toContain("修护液主图");
        expect(prompt).toContain("首图主视觉");
        expect(prompt).toContain("当前任务队列");
        expect(prompt.indexOf("主题拆解")).toBeLessThan(prompt.indexOf("首图主视觉"));
        expect(prompt).toContain("读取前面所有已生成节点结果");
    });
});
