import { describe, expect, it } from "bun:test";

import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "../src/app/(user)/canvas/types";
import { buildDirectorWorkflowChainEvents } from "../src/app/(user)/canvas/utils/ai-chain-events";

const nodes: CanvasNodeData[] = [
    {
        id: "input-node",
        type: CanvasNodeType.Text,
        title: "用户主题",
        position: { x: 0, y: 0 },
        width: 320,
        height: 180,
        metadata: {
            director: {
                workflowId: "wf-1",
                role: "input",
                runState: "done",
            },
        },
    },
    {
        id: "brief-node",
        type: CanvasNodeType.Config,
        title: "主题拆解",
        position: { x: 420, y: 0 },
        width: 360,
        height: 240,
        metadata: {
            generationMode: "text",
            director: {
                workflowId: "wf-1",
                stepId: "brief",
                role: "step",
                mode: "text",
                plannedOrder: 1,
                runState: "ready",
            },
        },
    },
    {
        id: "hero-node",
        type: CanvasNodeType.Config,
        title: "首图主视觉",
        position: { x: 840, y: 0 },
        width: 360,
        height: 240,
        metadata: {
            generationMode: "image",
            director: {
                workflowId: "wf-1",
                stepId: "hero",
                role: "step",
                mode: "image",
                dependencyStepIds: ["brief"],
                plannedOrder: 2,
                runState: "running",
            },
        },
    },
];

const connections: CanvasConnection[] = [
    { id: "c1", fromNodeId: "input-node", toNodeId: "brief-node" },
    { id: "c2", fromNodeId: "brief-node", toNodeId: "hero-node" },
];

describe("AI chain events", () => {
    it("describes director node creation, connection creation, and step states without hidden reasoning", () => {
        const events = buildDirectorWorkflowChainEvents({
            workflowId: "wf-1",
            workflowTitle: "护肤品广告工作流",
            nodes,
            connections,
        });

        expect(events.map((event) => event.type)).toContain("create_node");
        expect(events.map((event) => event.type)).toContain("connect_nodes");
        expect(events.map((event) => event.type)).toContain("run_generation");
        expect(events.some((event) => event.nodeId === "hero-node" && event.state === "running")).toBe(true);
        expect(events.some((event) => event.connectionId === "c2" && event.summary.includes("主题拆解") && event.summary.includes("首图主视觉"))).toBe(true);
        expect(events.every((event) => !/hidden reasoning|chain of thought|内部推理|思维链/.test(`${event.summary}\n${event.detail || ""}`))).toBe(true);
    });
});
