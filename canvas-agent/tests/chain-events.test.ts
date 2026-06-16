import { describe, expect, it } from "bun:test";

import { CanvasSession } from "../src/canvas-session";
import { toolDescriptions, toolInputSchemas, toolNames } from "../src/schemas";

describe("canvas chain events tool", () => {
    it("exposes the shared AI chain event stream to the local agent", async () => {
        expect(toolNames).toContain("canvas_get_chain_events");
        expect(toolDescriptions.canvas_get_chain_events).toContain("AI");
        expect(toolInputSchemas.canvas_get_chain_events.parse({})).toEqual({});

        const session = new CanvasSession();
        session.updateState({
            nodes: [],
            connections: [],
            chainEvents: [
                {
                    id: "wf-1:node:n1",
                    workflowId: "wf-1",
                    actor: "director",
                    type: "create_node",
                    state: "done",
                    title: "创建节点：主题拆解",
                    summary: "AI 创建了「主题拆解」节点，类型为文本。",
                    createdAt: "2026-06-16T00:00:00.000Z",
                },
            ],
        });
        (session as unknown as { clients: Map<string, unknown> }).clients.set("test-client", {});

        const result = await session.callTool("canvas_get_chain_events", {});

        expect(result).toEqual({
            chainEvents: [
                {
                    id: "wf-1:node:n1",
                    workflowId: "wf-1",
                    actor: "director",
                    type: "create_node",
                    state: "done",
                    title: "创建节点：主题拆解",
                    summary: "AI 创建了「主题拆解」节点，类型为文本。",
                    createdAt: "2026-06-16T00:00:00.000Z",
                },
            ],
        });
    });
});
