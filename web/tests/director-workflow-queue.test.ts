import { describe, expect, it } from "bun:test";

import { buildDirectorWorkflowQueueSummary } from "../src/app/(user)/canvas/utils/director-workflow-queue";
import type { CanvasAgentTaskQueueItem } from "../src/app/(user)/canvas/utils/canvas-agent-ops";

const queue: CanvasAgentTaskQueueItem[] = [
    { id: "wf-a:input", nodeId: "a-input", workflowId: "wf-a", title: "大型导演工作流", role: "input", mode: "text", runState: "done", connectedFrom: [], connectedTo: [] },
    { id: "wf-a:brief", nodeId: "a-brief", workflowId: "wf-a", stepId: "brief", title: "主题拆解", role: "step", mode: "text", runState: "running", plannedOrder: 1, connectedFrom: ["a-input"], connectedTo: ["a-hero"] },
    { id: "wf-b:input", nodeId: "b-input", workflowId: "wf-b", title: "第二个工作流", role: "input", mode: "text", runState: "done", connectedFrom: [], connectedTo: [] },
    { id: "wf-b:brief", nodeId: "b-brief", workflowId: "wf-b", stepId: "brief", title: "主题拆解", role: "step", mode: "text", runState: "planned", plannedOrder: 1, connectedFrom: ["b-input"], connectedTo: ["b-hero"] },
    { id: "wf-c:input", nodeId: "c-input", workflowId: "wf-c", title: "第三个工作流", role: "input", mode: "text", runState: "done", connectedFrom: [], connectedTo: [] },
    { id: "wf-c:brief", nodeId: "c-brief", workflowId: "wf-c", stepId: "brief", title: "主题拆解", role: "step", mode: "text", runState: "error", plannedOrder: 1, connectedFrom: ["c-input"], connectedTo: ["c-hero"] },
];

describe("director workflow queue summary", () => {
    it("groups concurrent workflows by workflow id and surfaces their live states", () => {
        const summaries = buildDirectorWorkflowQueueSummary(queue);

        expect(summaries.map((item) => item.workflowId)).toEqual(["wf-a", "wf-b", "wf-c"]);
        expect(summaries[0]).toMatchObject({ title: "大型导演工作流", total: 2, running: 1, done: 1, state: "running" });
        expect(summaries[1]).toMatchObject({ title: "第二个工作流", total: 2, planned: 1, state: "planned" });
        expect(summaries[2]).toMatchObject({ title: "第三个工作流", total: 2, error: 1, state: "error" });
    });

    it("keeps ready tasks in the planned bucket for publish-next workflow UX", () => {
        const summaries = buildDirectorWorkflowQueueSummary([
            { id: "wf-ready:input", nodeId: "ready-input", workflowId: "wf-ready", title: "可继续发布", role: "input", mode: "text", runState: "done", connectedFrom: [], connectedTo: [] },
            { id: "wf-ready:brief", nodeId: "ready-brief", workflowId: "wf-ready", stepId: "brief", title: "主题拆解", role: "step", mode: "text", runState: "ready", plannedOrder: 1, connectedFrom: ["ready-input"], connectedTo: [] },
        ]);

        expect(summaries).toHaveLength(1);
        expect(summaries[0]).toMatchObject({ workflowId: "wf-ready", total: 2, planned: 1, done: 1, state: "planned" });
    });
});
