import crypto from "node:crypto";
import type { ServerResponse } from "node:http";

import { type ToolName } from "./schemas.js";
import { compactCanvasState, compactNode, isToolName, nextCanvasX, parseToolInput } from "./tools.js";
import type { CanvasDirectorWorkflowSummary, CanvasNode, CanvasNodeType, CanvasSnapshot } from "./types.js";

type PendingRequest = { resolve: (value: unknown) => void; reject: (error: Error) => void };

export class CanvasSession {
    private clients = new Map<string, ServerResponse>();
    private pending = new Map<string, PendingRequest>();
    private canvasState: CanvasSnapshot | null = null;

    health() {
        return { ok: true, hasCanvas: Boolean(this.canvasState), clients: this.clients.size };
    }

    openEvents(url: URL, res: ServerResponse) {
        const clientId = url.searchParams.get("clientId") || crypto.randomUUID();
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
        this.clients.set(clientId, res);
        sendEvent(res, "hello", { ok: true, clientId });
        const timer = setInterval(() => sendEvent(res, "ping", { time: Date.now() }), 15000);
        res.on("close", () => {
            clearInterval(timer);
            this.clients.delete(clientId);
            if (this.canvasState?.clientId === clientId) this.canvasState = null;
        });
    }

    updateState(body: unknown, clientId?: string) {
        this.canvasState = { ...((body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, unknown>), clientId } as CanvasSnapshot;
    }

    resolveResult(body: { requestId?: string; error?: string; result?: unknown }) {
        const item = body.requestId ? this.pending.get(body.requestId) : null;
        if (!item || !body.requestId) return;
        this.pending.delete(body.requestId);
        body.error ? item.reject(new Error(body.error)) : item.resolve(body.result);
    }

    emitAll(type: string, payload: unknown) {
        this.clients.forEach((client) => sendEvent(client, type, payload));
    }

    async callTool(name: unknown, rawInput: unknown) {
        if (!isToolName(name)) throw new Error(`未知工具：${String(name)}`);
        let tool: ToolName = name;
        let input = parseToolInput(tool, rawInput) as Record<string, unknown>;
        const readTool = ["canvas_get_state", "canvas_get_selection", "canvas_get_asset_pack", "canvas_get_task_queue", "canvas_get_chain_events", "canvas_get_director_workflows", "canvas_export_snapshot"].includes(tool);
        if (readTool && (!this.clients.size || !this.canvasState)) throw new Error("当前没有已连接画布");
        if (tool === "canvas_get_state" || tool === "canvas_export_snapshot") return compactCanvasState(this.canvasState);
        if (tool === "canvas_get_selection") {
            const ids = new Set(this.canvasState?.selectedNodeIds || []);
            return { nodes: (this.canvasState?.nodes || []).filter((node) => ids.has(node.id)).map(compactNode) };
        }
        if (tool === "canvas_get_asset_pack") return { assetPack: this.canvasState?.assetPack || [] };
        if (tool === "canvas_get_task_queue") return { taskQueue: this.canvasState?.taskQueue || [] };
        if (tool === "canvas_get_chain_events") return { chainEvents: this.canvasState?.chainEvents || [] };
        if (tool === "canvas_get_director_workflows") return { workflows: summarizeDirectorWorkflows(this.canvasState) };
        if (tool === "canvas_create_node") {
            const data = input as { nodeType: CanvasNodeType; title?: string; x?: number; y?: number; width?: number; height?: number; metadata?: Record<string, unknown> };
            input = { ops: [{ type: "add_node", nodeType: data.nodeType, title: data.title, position: { x: data.x ?? nextCanvasX(this.canvasState), y: data.y ?? 0 }, width: data.width, height: data.height, metadata: data.metadata }] };
            tool = "canvas_apply_ops";
        }
        if (tool === "canvas_create_text_node") {
            const text = input as { text?: string; x?: number; y?: number; title?: string; width?: number; height?: number };
            input = { ops: [textNodeOp(text, text.x ?? nextCanvasX(this.canvasState), text.y ?? 0)] };
            tool = "canvas_apply_ops";
        }
        if (tool === "canvas_create_text_nodes") {
            const data = input as { items: Array<{ text: string; title?: string; x?: number; y?: number; width?: number; height?: number }>; x?: number; y?: number; gap?: number; direction?: "row" | "column" };
            const x = Number(data.x ?? nextCanvasX(this.canvasState));
            const y = Number(data.y ?? 0);
            const gap = Number(data.gap ?? 40);
            input = {
                ops: data.items.map((item, index) => textNodeOp(item, item.x ?? (data.direction === "row" ? x + index * (340 + gap) : x), item.y ?? (data.direction === "row" ? y : y + index * (240 + gap)))),
            };
            tool = "canvas_apply_ops";
        }
        if (tool === "canvas_create_image_prompt_flow") {
            input = { ops: generationFlowOps({ ...(input as Record<string, unknown>), mode: "image" }, this.canvasState) };
            tool = "canvas_apply_ops";
        }
        if (tool === "canvas_create_config_node") {
            const data = input as Record<string, unknown>;
            const x = Number(data.x ?? nextCanvasX(this.canvasState));
            const y = Number(data.y ?? 0);
            const configId = `config-${crypto.randomUUID()}`;
            const mode = generationMode(data.mode);
            const prompt = String(data.prompt || "");
            input = { ops: [configNodeOp(configId, data, x, y), ...(data.autoRun ? [runGenerationOp(configId, mode, prompt)] : [])] };
            tool = "canvas_apply_ops";
        }
        if (tool === "canvas_create_generation_flow") {
            input = { ops: generationFlowOps(input as Record<string, unknown>, this.canvasState) };
            tool = "canvas_apply_ops";
        }
        if (tool === "canvas_create_director_workflow") {
            input = { ops: directorWorkflowOps(input as Record<string, unknown>, this.canvasState) };
            tool = "canvas_apply_ops";
        }
        if (tool === "canvas_generate_text" || tool === "canvas_generate_image" || tool === "canvas_generate_video" || tool === "canvas_generate_audio") {
            input = { ops: generationFlowOps({ ...(input as Record<string, unknown>), mode: tool.replace("canvas_generate_", ""), autoRun: true }, this.canvasState) };
            tool = "canvas_apply_ops";
        }
        if (tool === "canvas_update_node") {
            const data = input as { id: string; patch?: Record<string, unknown>; metadata?: Record<string, unknown> };
            input = { ops: [{ type: "update_node", id: data.id, patch: data.patch, metadata: data.metadata }] };
            tool = "canvas_apply_ops";
        }
        if (tool === "canvas_update_node_text") {
            const data = input as { id: string; text: string; title?: string };
            input = { ops: [{ type: "update_node", id: data.id, patch: { ...(data.title ? { title: data.title } : {}) }, metadata: { content: data.text, status: "success" } }] };
            tool = "canvas_apply_ops";
        }
        if (tool === "canvas_move_nodes") {
            const data = input as { items: Array<{ id: string; x?: number; y?: number; dx?: number; dy?: number }> };
            input = {
                ops: data.items.map((item) => {
                    const current = findNode(this.canvasState, item.id);
                    return { type: "update_node", id: item.id, patch: { position: { x: item.x ?? ((current?.position.x || 0) + (item.dx || 0)), y: item.y ?? ((current?.position.y || 0) + (item.dy || 0)) } } };
                }),
            };
            tool = "canvas_apply_ops";
        }
        if (tool === "canvas_resize_node") {
            const data = input as { id: string; width: number; height: number; freeResize?: boolean };
            input = { ops: [{ type: "update_node", id: data.id, patch: { width: data.width, height: data.height }, metadata: data.freeResize === undefined ? undefined : { freeResize: data.freeResize } }] };
            tool = "canvas_apply_ops";
        }
        if (tool === "canvas_delete_nodes") {
            input = { ops: [{ type: "delete_node", ids: (input as { ids: string[] }).ids }] };
            tool = "canvas_apply_ops";
        }
        if (tool === "canvas_connect_nodes") {
            const data = input as { connections: Array<{ fromNodeId: string; toNodeId: string }> };
            input = { ops: data.connections.map((connection) => ({ type: "connect_nodes", ...connection })) };
            tool = "canvas_apply_ops";
        }
        if (tool === "canvas_select_nodes") {
            input = { ops: [{ type: "select_nodes", ids: (input as { ids: string[] }).ids }] };
            tool = "canvas_apply_ops";
        }
        if (tool === "canvas_set_viewport") {
            input = { ops: [{ type: "set_viewport", viewport: (input as { viewport: unknown }).viewport }] };
            tool = "canvas_apply_ops";
        }
        if (tool === "canvas_run_generation") {
            const data = input as { nodeId: string; mode?: string; prompt?: string };
            input = { ops: [runGenerationOp(data.nodeId, generationMode(data.mode), data.prompt)] };
            tool = "canvas_apply_ops";
        }
        if (tool !== "canvas_apply_ops") throw new Error(`未知工具：${tool}`);
        if (!this.clients.size) throw new Error("当前没有已连接画布");
        return await this.requestCanvasTool(tool, input);
    }

    private async requestCanvasTool(name: ToolName, input: Record<string, unknown>) {
        const requestId = crypto.randomUUID();
        const client = this.clients.get(this.canvasState?.clientId || "") || this.clients.values().next().value;
        if (!client) throw new Error("当前没有已连接画布");
        sendEvent(client, "tool_call", { requestId, name, input });
        return await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(requestId);
                reject(new Error("画布操作超时"));
            }, 30000);
            this.pending.set(requestId, { resolve: (value) => (clearTimeout(timer), resolve(value)), reject: (error) => (clearTimeout(timer), reject(error)) });
        });
    }
}

function sendEvent(res: ServerResponse, type: string, payload: unknown) {
    res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function textNodeOp(input: { id?: string; text?: string; title?: string; width?: number; height?: number }, x: number, y: number) {
    return { type: "add_node", id: input.id, nodeType: "text", title: input.title, position: { x, y }, width: input.width, height: input.height, metadata: { content: input.text || "", status: "success", fontSize: 14 } };
}

function configNodeOp(id: string, input: Record<string, unknown>, x: number, y: number) {
    const mode = generationMode(input.mode);
    const prompt = String(input.prompt || "");
    return {
        type: "add_node",
        id,
        nodeType: "config",
        title: String(input.title || generationTitle(mode)),
        position: { x, y },
        width: typeof input.width === "number" ? input.width : undefined,
        height: typeof input.height === "number" ? input.height : undefined,
        metadata: cleanRecord({
            generationMode: mode,
            composerContent: prompt,
            prompt,
            status: "idle",
            model: input.model,
            size: input.size,
            quality: input.quality,
            count: input.count,
            seconds: input.seconds,
            vquality: input.vquality,
            generateAudio: input.generateAudio,
            watermark: input.watermark,
            audioVoice: input.audioVoice,
            audioFormat: input.audioFormat,
            audioSpeed: input.audioSpeed,
            audioInstructions: input.audioInstructions,
        }),
    };
}

function generationFlowOps(input: Record<string, unknown>, state: CanvasSnapshot | null) {
    const mode = generationMode(input.mode);
    const prompt = String(input.prompt || "");
    const x = Number(input.x ?? nextCanvasX(state));
    const y = Number(input.y ?? 0);
    const textId = `text-${crypto.randomUUID()}`;
    const configId = `config-${crypto.randomUUID()}`;
    const referenceNodeIds = Array.isArray(input.referenceNodeIds) ? input.referenceNodeIds.filter((id): id is string => typeof id === "string") : [];
    const tokens = [`@[node:${textId}]`, ...referenceNodeIds.map((id) => `@[node:${id}]`)];
    const configInput = { ...input, prompt: tokens.join("\n") };
    return [
        textNodeOp({ id: textId, text: prompt, title: String(input.title || "提示词") }, x, y),
        configNodeOp(configId, configInput, x + 420, y),
        { type: "connect_nodes", fromNodeId: textId, toNodeId: configId },
        ...referenceNodeIds.map((fromNodeId) => ({ type: "connect_nodes", fromNodeId, toNodeId: configId })),
        { type: "select_nodes", ids: [configId] },
        ...(input.autoRun ? [runGenerationOp(configId, mode, tokens.join("\n"))] : []),
    ];
}

function directorWorkflowOps(input: Record<string, unknown>, state: CanvasSnapshot | null) {
    const prompt = String(input.prompt || "");
    const x = Number(input.x ?? nextCanvasX(state));
    const y = Number(input.y ?? 0);
    const title = String(input.title || "大型导演工作流");
    const workflowId = `director-${crypto.randomUUID()}`;
    const steps: Array<{ id: string; title: string; mode: "text" | "image" | "video"; prompt: string; dependsOn: string[] }> = [
        { id: "brief", title: "主题拆解", mode: "text", prompt: `请把用户主题拆解成创意简报。\n\n用户主题：${prompt}`, dependsOn: [] },
        { id: "visual-bible", title: "视觉圣经", mode: "text", prompt: `基于主题拆解，建立视觉圣经。\n\n主题：${prompt}`, dependsOn: ["brief"] },
        { id: "hero-image", title: "首图主视觉", mode: "image", prompt: `生成项目第一张主视觉图。\n\n主题：${prompt}`, dependsOn: ["visual-bible"] },
        { id: "consistency-lock", title: "产品一致性", mode: "image", prompt: `以上一步主视觉作为锚点，锁定主体/产品一致性。\n\n主题：${prompt}`, dependsOn: ["hero-image"] },
        { id: "scene-wide", title: "场景远景", mode: "image", prompt: `基于一致性锁和主视觉扩展场景远景。\n\n主题：${prompt}`, dependsOn: ["consistency-lock"] },
        { id: "scene-action", title: "动作关键帧", mode: "image", prompt: `基于场景远景生成动作关键帧。\n\n主题：${prompt}`, dependsOn: ["scene-wide"] },
        { id: "detail-shots", title: "细节特写", mode: "image", prompt: `基于动作关键帧生成细节特写。\n\n主题：${prompt}`, dependsOn: ["scene-action"] },
        { id: "asset-storyboard", title: "资产故事板", mode: "text", prompt: `读取前面所有节点结果，重写资产故事板，保持人物、主体、产品、物品和场景一致。\n\n主题：${prompt}`, dependsOn: ["brief", "visual-bible", "hero-image", "consistency-lock", "scene-wide", "scene-action", "detail-shots"] },
        { id: "video-segment-a", title: "视频片段A", mode: "video", prompt: `根据故事板生成片段A，写清首帧、尾帧、镜头运动和一致性要求。\n\n主题：${prompt}`, dependsOn: ["asset-storyboard", "hero-image", "scene-wide", "scene-action"] },
        { id: "video-segment-b", title: "视频片段B", mode: "video", prompt: `根据故事板生成片段B，承接片段A并保持同一产品、场景和光线。\n\n主题：${prompt}`, dependsOn: ["asset-storyboard", "consistency-lock", "scene-action", "detail-shots"] },
        { id: "edit-plan", title: "剪辑缺片", mode: "text", prompt: `读取故事板、视频片段和上游图片，输出剪辑方案、缺失片段、未完整成片标记和补生成提示词。\n\n主题：${prompt}`, dependsOn: ["asset-storyboard", "video-segment-a", "video-segment-b", "detail-shots"] },
        { id: "final-review", title: "导演审校", mode: "text", prompt: `对整个工作流做最终审校，列出一致性风险、返工节点和可复制返工提示词。\n\n主题：${prompt}`, dependsOn: ["edit-plan"] },
    ];
    const inputId = `director-input-${crypto.randomUUID()}`;
    const nodeIdByStepId = new Map(steps.map((step) => [step.id, `director-${step.mode}-${crypto.randomUUID()}`]));
    const nodeOps = [
        {
            type: "add_node",
            id: inputId,
            nodeType: "text",
            title,
            position: { x, y },
            metadata: { content: `# ${title}\n\n${prompt}`, prompt, status: "success", fontSize: 14, director: { workflowId, role: "input", runState: "done" } },
        },
        ...steps.map((step, index) => {
            const dependencyNodeIds = step.dependsOn.map((stepId) => nodeIdByStepId.get(stepId)).filter((id): id is string => Boolean(id));
            const tokens = (dependencyNodeIds.length ? dependencyNodeIds : [inputId]).map((nodeId) => `@[node:${nodeId}]`).join(" ");
            return {
                type: "add_node",
                id: nodeIdByStepId.get(step.id),
                nodeType: "config",
                title: step.title,
                position: { x: x + 420 * (index + 1), y },
                metadata: cleanRecord({
                    content: "",
                    prompt: step.prompt,
                    composerContent: `${tokens}\n\n${step.prompt}`,
                    status: "idle",
                    generationMode: step.mode,
                    model: input.model,
                    size: input.size,
                    quality: input.quality,
                    count: input.count,
                    seconds: input.seconds,
                    vquality: input.vquality,
                    generateAudio: input.generateAudio,
                    watermark: input.watermark,
                    audioVoice: input.audioVoice,
                    audioFormat: input.audioFormat,
                    audioSpeed: input.audioSpeed,
                    audioInstructions: input.audioInstructions,
                    director: { workflowId, stepId: step.id, role: "step", mode: step.mode, dependencyStepIds: step.dependsOn, plannedOrder: index + 1, runState: "ready" },
                }),
            };
        }),
    ];
    const connectionOps = steps.flatMap((step) => {
        const toNodeId = nodeIdByStepId.get(step.id);
        if (!toNodeId) return [];
        const parents = step.dependsOn.length ? step.dependsOn.map((stepId) => nodeIdByStepId.get(stepId)).filter((id): id is string => Boolean(id)) : [inputId];
        return parents.map((fromNodeId) => ({ type: "connect_nodes", fromNodeId, toNodeId }));
    });
    const reviewId = nodeIdByStepId.get("final-review") || inputId;
    return [
        ...nodeOps,
        ...connectionOps,
        { type: "select_nodes", ids: [reviewId] },
        ...(input.autoRun ? [{ type: "run_generation", nodeId: reviewId, mode: "text", prompt }] : []),
    ];
}

function runGenerationOp(nodeId: string, mode: "text" | "image" | "video" | "audio", prompt?: string) {
    return { type: "run_generation", nodeId, mode, prompt };
}

function generationMode(value: unknown): "text" | "image" | "video" | "audio" {
    return value === "text" || value === "video" || value === "audio" ? value : "image";
}

function generationTitle(mode: "text" | "image" | "video" | "audio") {
    if (mode === "text") return "文本生成";
    if (mode === "video") return "视频生成";
    if (mode === "audio") return "音频生成";
    return "图片生成";
}

function findNode(state: CanvasSnapshot | null, id: string): CanvasNode | undefined {
    return (state?.nodes || []).find((node) => node.id === id);
}

function summarizeDirectorWorkflows(state: CanvasSnapshot | null): CanvasDirectorWorkflowSummary[] {
    const nodes = state?.nodes || [];
    const taskQueue = state?.taskQueue || [];
    const chainEvents = state?.chainEvents || [];
    const workflowIds = Array.from(new Set(nodes.map((node) => directorMetadata(node)?.workflowId).filter((workflowId): workflowId is string => Boolean(workflowId))));
    return workflowIds.map((workflowId) => {
        const workflowNodes = nodes.filter((node) => directorMetadata(node)?.workflowId === workflowId);
        const workflowQueue = taskQueue.filter((item) => item.workflowId === workflowId);
        const workflowEvents = chainEvents.filter((event) => event.workflowId === workflowId);
        const latestEvent = workflowEvents[workflowEvents.length - 1];
        const planned = workflowQueue.filter((item) => item.runState === "planned" || item.runState === "ready").length;
        const running = workflowQueue.filter((item) => item.runState === "running").length;
        const done = workflowQueue.filter((item) => item.runState === "done").length;
        const error = workflowQueue.filter((item) => item.runState === "error").length;
        return {
            workflowId,
            title: workflowNodes.find((node) => directorMetadata(node)?.role === "input")?.title || workflowNodes[0]?.title || "导演工作流",
            total: workflowQueue.length || workflowNodes.length,
            planned,
            running,
            done,
            error,
            state: error ? "error" : running ? "running" : planned ? "planned" : "done",
            latestEventTitle: latestEvent?.title,
            latestEventSummary: latestEvent?.summary,
            latestEventState: latestEvent?.state,
        };
    });
}

function directorMetadata(node: CanvasNode) {
    const director = node.metadata?.director;
    if (!director || typeof director !== "object" || Array.isArray(director)) return null;
    const value = director as Record<string, unknown>;
    return {
        workflowId: typeof value.workflowId === "string" ? value.workflowId : undefined,
        role: typeof value.role === "string" ? value.role : undefined,
    };
}

function cleanRecord(value: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
}
