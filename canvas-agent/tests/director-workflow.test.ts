import { describe, expect, it } from "bun:test";

import { CanvasSession } from "../src/canvas-session";
import { toolDescriptions, toolInputSchemas, toolNames } from "../src/schemas";

describe("director workflow tool", () => {
    it("lets the local agent create a director workflow on the connected canvas", async () => {
        expect(toolNames).toContain("canvas_create_director_workflow");
        expect(toolDescriptions.canvas_create_director_workflow).toContain("导演");
        expect(toolInputSchemas.canvas_create_director_workflow.parse({ prompt: "金色修护液广告" })).toEqual({ prompt: "金色修护液广告" });

        const session = new CanvasSession();
        session.updateState({ nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } }, "test-client");
        const sentEvents: Array<{ type: string; payload: unknown }> = [];
        const client = {
            write(value: string) {
                const type = value.match(/^event: (.+)$/m)?.[1] || "";
                const raw = value.match(/^data: (.+)$/m)?.[1] || "{}";
                sentEvents.push({ type, payload: JSON.parse(raw) });
            },
        };
        (session as unknown as { clients: Map<string, unknown> }).clients.set("test-client", client);

        const pending = session.callTool("canvas_create_director_workflow", { prompt: "金色修护液广告", x: 100, y: 200 });
        const event = sentEvents.find((item) => item.type === "tool_call");
        expect(event).toBeTruthy();
        const payload = event!.payload as { requestId: string; name: string; input: { ops: Array<Record<string, unknown>> } };
        expect(payload.name).toBe("canvas_apply_ops");
        expect(payload.input.ops.some((op) => op.type === "add_node" && JSON.stringify(op).includes('"workflowId"'))).toBe(true);
        expect(payload.input.ops.some((op) => op.type === "add_node" && JSON.stringify(op).includes('"plannedOrder":7'))).toBe(true);
        expect(payload.input.ops.some((op) => op.type === "add_node" && JSON.stringify(op).includes('"asset-storyboard"'))).toBe(true);
        expect(payload.input.ops.filter((op) => op.type === "add_node" && op.nodeType === "config")).toHaveLength(12);
        expect(payload.input.ops.some((op) => op.type === "connect_nodes")).toBe(true);
        expect(payload.input.ops.some((op) => op.type === "select_nodes")).toBe(true);

        session.resolveResult({ requestId: payload.requestId, result: { ok: true } });
        await expect(pending).resolves.toEqual({ ok: true });
    });

    it("groups director workflows from the connected canvas for concurrent local-agent control", async () => {
        expect(toolNames).toContain("canvas_get_director_workflows");
        expect(toolDescriptions.canvas_get_director_workflows).toContain("导演工作流");
        expect(toolInputSchemas.canvas_get_director_workflows.parse({})).toEqual({});

        const session = new CanvasSession();
        session.updateState({
            nodes: [
                { id: "a-input", type: "text", title: "修护液广告", position: { x: 0, y: 0 }, width: 320, height: 180, metadata: { director: { workflowId: "wf-a", role: "input", runState: "done" } } },
                { id: "a-brief", type: "config", title: "主题拆解", position: { x: 420, y: 0 }, width: 360, height: 240, metadata: { generationMode: "text", composerContent: "拆解", director: { workflowId: "wf-a", stepId: "brief", role: "step", mode: "text", plannedOrder: 1, runState: "running" } } },
                { id: "b-input", type: "text", title: "珠宝短片", position: { x: 0, y: 320 }, width: 320, height: 180, metadata: { director: { workflowId: "wf-b", role: "input", runState: "done" } } },
                { id: "b-brief", type: "config", title: "主题拆解", position: { x: 420, y: 320 }, width: 360, height: 240, metadata: { generationMode: "text", composerContent: "拆解", director: { workflowId: "wf-b", stepId: "brief", role: "step", mode: "text", plannedOrder: 1, runState: "ready" } } },
            ],
            connections: [
                { id: "c1", fromNodeId: "a-input", toNodeId: "a-brief" },
                { id: "c2", fromNodeId: "b-input", toNodeId: "b-brief" },
            ],
            taskQueue: [
                { id: "wf-a:a-input", nodeId: "a-input", workflowId: "wf-a", title: "修护液广告", role: "input", runState: "done", connectedFrom: [], connectedTo: ["a-brief"] },
                { id: "wf-a:brief", nodeId: "a-brief", workflowId: "wf-a", stepId: "brief", title: "主题拆解", role: "step", mode: "text", runState: "running", plannedOrder: 1, connectedFrom: ["a-input"], connectedTo: [] },
                { id: "wf-b:b-input", nodeId: "b-input", workflowId: "wf-b", title: "珠宝短片", role: "input", runState: "done", connectedFrom: [], connectedTo: ["b-brief"] },
                { id: "wf-b:brief", nodeId: "b-brief", workflowId: "wf-b", stepId: "brief", title: "主题拆解", role: "step", mode: "text", runState: "ready", plannedOrder: 1, connectedFrom: ["b-input"], connectedTo: [] },
            ],
            chainEvents: [
                { id: "wf-a:run:a-brief", workflowId: "wf-a", nodeId: "a-brief", actor: "director", type: "run_generation", state: "running", title: "执行中：主题拆解", summary: "AI 正在执行主题拆解", createdAt: "2026-06-16T00:00:00.000Z" },
                { id: "wf-b:node:b-brief", workflowId: "wf-b", nodeId: "b-brief", actor: "director", type: "create_node", state: "waiting", title: "创建节点：主题拆解", summary: "AI 创建了主题拆解节点", createdAt: "2026-06-16T00:01:00.000Z" },
            ],
        });
        (session as unknown as { clients: Map<string, unknown> }).clients.set("test-client", {});

        const result = await session.callTool("canvas_get_director_workflows", {});

        expect(result).toEqual({
            workflows: [
                expect.objectContaining({ workflowId: "wf-a", title: "修护液广告", total: 2, running: 1, state: "running", latestEventSummary: "AI 正在执行主题拆解" }),
                expect.objectContaining({ workflowId: "wf-b", title: "珠宝短片", total: 2, planned: 1, state: "planned", latestEventSummary: "AI 创建了主题拆解节点" }),
            ],
        });
    });
});
