import { describe, expect, it } from "bun:test";

import { CanvasNodeType } from "../src/app/(user)/canvas/types";
import { buildDirectorReferencePackPrompt, directorReferencePackToLegacyReferences, shouldAttachReferencePackToStep } from "../src/app/(user)/canvas/director/reference-pack";
import { materializeDirectorWorkflow } from "../src/app/(user)/canvas/director/workflow-materializer";
import { createFallbackDirectorWorkflow } from "../src/app/(user)/canvas/director/workflow-planner";
import type { DirectorReferencePackItem, DirectorWorkflowStep } from "../src/app/(user)/canvas/director/types";

const pack: DirectorReferencePackItem[] = [
    {
        id: "product-node",
        nodeId: "product-node",
        role: "product",
        mediaType: "image",
        title: "repair-serum.png",
        type: CanvasNodeType.Image,
        dataUrl: "data:image/png;base64,AAA",
    },
    {
        id: "logo-node",
        nodeId: "logo-node",
        role: "logo",
        mediaType: "image",
        title: "brand-logo.png",
        type: CanvasNodeType.Image,
        dataUrl: "data:image/png;base64,BBB",
    },
    {
        id: "reference-video-node",
        nodeId: "reference-video-node",
        role: "reference-video",
        mediaType: "video",
        title: "reference-motion.mp4",
        type: CanvasNodeType.Video,
        url: "blob:reference-motion",
        durationMs: 4800,
    },
];

describe("director reference pack", () => {
    it("serializes customer asset roles into the planner prompt", () => {
        const prompt = buildDirectorReferencePackPrompt(pack);

        expect(prompt).toContain("客户素材包");
        expect(prompt).toContain("产品主图");
        expect(prompt).toContain("repair-serum.png");
        expect(prompt).toContain("Logo");
        expect(prompt).toContain("brand-logo.png");
        expect(prompt).toContain("参考视频");
        expect(prompt).toContain("4.8s");
        expect(prompt).toContain("后续生成必须保持");
    });

    it("keeps legacy references compatible with existing workflow materialization", () => {
        const references = directorReferencePackToLegacyReferences(pack);

        expect(references).toEqual([
            { id: "product-node", type: CanvasNodeType.Image, title: "产品主图：repair-serum.png" },
            { id: "logo-node", type: CanvasNodeType.Image, title: "Logo：brand-logo.png" },
            { id: "reference-video-node", type: CanvasNodeType.Video, title: "参考视频：reference-motion.mp4" },
        ]);
    });

    it("attaches the customer asset pack to all key workflow stages", () => {
        const keySteps: DirectorWorkflowStep[] = [
            { id: "hero", title: "首图主视觉", mode: "image", prompt: "生成首图" },
            { id: "lock", title: "产品一致性", mode: "image", prompt: "锁定产品" },
            { id: "storyboard", title: "资产故事板", mode: "text", prompt: "读取前面所有节点结果" },
            { id: "segment", title: "视频片段A", mode: "video", prompt: "生成视频片段" },
            { id: "edit", title: "剪辑缺片", mode: "text", prompt: "未完整成片检查" },
            { id: "review", title: "导演审校", mode: "text", prompt: "一致性审校" },
        ];

        expect(keySteps.every((step) => shouldAttachReferencePackToStep(step))).toBe(true);
        expect(shouldAttachReferencePackToStep({ id: "brief", title: "主题拆解", mode: "text", prompt: "创意简报" })).toBe(false);
    });

    it("writes reference pack node tokens into materialized key-step composer content", () => {
        const workflow = {
            id: "director-pack-test",
            title: "素材包测试",
            summary: "测试素材包引用",
            sourcePrompt: "修护液广告",
            references: directorReferencePackToLegacyReferences(pack),
            referencePack: pack,
            createdAt: "2026-06-15T00:00:00.000Z",
            steps: [
                { id: "brief", title: "主题拆解", mode: "text", prompt: "创意简报" },
                { id: "hero", title: "首图主视觉", mode: "image", prompt: "生成首图", dependsOn: ["brief"] },
                { id: "storyboard", title: "资产故事板", mode: "text", prompt: "读取前面所有节点结果", dependsOn: ["hero"] },
            ] satisfies DirectorWorkflowStep[],
        };

        const result = materializeDirectorWorkflow({
            workflow,
            center: { x: 0, y: 0 },
            config: { imageModel: "image-model", textModel: "text-model", videoModel: "video-model", audioModel: "audio-model", model: "fallback", quality: "auto", size: "auto", count: "1", canvasImageCount: "1" } as any,
            referenceNodeIds: pack.map((item) => item.nodeId),
        });
        const heroNode = result.nodes.find((node) => node.title === "首图主视觉");
        const storyboardNode = result.nodes.find((node) => node.title === "资产故事板");

        expect(heroNode?.metadata?.composerContent).toContain("@[node:product-node]");
        expect(heroNode?.metadata?.composerContent).toContain("@[node:reference-video-node]");
        expect(storyboardNode?.metadata?.composerContent).toContain("@[node:product-node]");
        expect(result.connections.some((connection) => connection.fromNodeId === "product-node" && connection.toNodeId === heroNode?.id)).toBe(true);
    });

    it("injects consistency guardrails into every key fallback workflow prompt", () => {
        const workflow = createFallbackDirectorWorkflow({ prompt: "修护液产品广告", references: directorReferencePackToLegacyReferences(pack), referencePack: pack });
        const keySteps = workflow.steps.filter(shouldAttachReferencePackToStep);

        expect(keySteps.length).toBeGreaterThan(0);
        expect(keySteps.every((step) => step.prompt.includes("客户素材包一致性硬性约束"))).toBe(true);
        expect(keySteps.every((step) => step.prompt.includes("产品主图锁定产品比例"))).toBe(true);
    });
});
