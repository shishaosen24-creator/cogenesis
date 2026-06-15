import { CanvasNodeType } from "../types";
import type { DirectorReferencePackItem, DirectorReferenceRole, DirectorWorkflowReference, DirectorWorkflowStep } from "./types";

export const DIRECTOR_REFERENCE_ROLE_OPTIONS: Array<{ value: DirectorReferenceRole; label: string; mediaTypes?: DirectorReferencePackItem["mediaType"][] }> = [
    { value: "product", label: "产品主图", mediaTypes: ["image"] },
    { value: "logo", label: "Logo", mediaTypes: ["image"] },
    { value: "character", label: "主角", mediaTypes: ["image"] },
    { value: "scene", label: "场景", mediaTypes: ["image", "video"] },
    { value: "style", label: "风格参考", mediaTypes: ["image", "video", "audio"] },
    { value: "reference-video", label: "参考视频", mediaTypes: ["video"] },
    { value: "reference-audio", label: "参考音频", mediaTypes: ["audio"] },
    { value: "other", label: "其他参考" },
];

const ROLE_LABELS: Record<DirectorReferenceRole, string> = DIRECTOR_REFERENCE_ROLE_OPTIONS.reduce(
    (labels, option) => ({ ...labels, [option.value]: option.label }),
    {} as Record<DirectorReferenceRole, string>,
);

export function directorReferenceRoleLabel(role: DirectorReferenceRole) {
    return ROLE_LABELS[role] || "其他参考";
}

export function defaultDirectorReferenceRole(mediaType: DirectorReferencePackItem["mediaType"]): DirectorReferenceRole {
    if (mediaType === "video") return "reference-video";
    if (mediaType === "audio") return "reference-audio";
    return "product";
}

export function directorReferencePackToLegacyReferences(pack: DirectorReferencePackItem[]): DirectorWorkflowReference[] {
    return pack.map((item) => ({
        id: item.nodeId,
        type: item.type,
        title: `${directorReferenceRoleLabel(item.role)}：${item.title}`,
        text: item.text,
    }));
}

export function buildDirectorReferencePackPrompt(pack: DirectorReferencePackItem[]) {
    if (!pack.length) return "客户素材包：无";
    const lines = pack.map((item, index) => {
        const details = [
            `角色=${directorReferenceRoleLabel(item.role)}`,
            `类型=${mediaTypeLabel(item.mediaType)}`,
            item.width && item.height ? `尺寸=${item.width}x${item.height}` : "",
            item.durationMs ? `时长=${formatDurationSeconds(item.durationMs)}` : "",
            item.mimeType ? `格式=${item.mimeType}` : "",
            item.text ? `文字内容=${item.text.slice(0, 300)}` : "",
        ].filter(Boolean);
        return `${index + 1}. ${item.title}（${details.join("；")}）`;
    });

    return [
        "客户素材包：",
        ...lines,
        "",
        "素材使用规则：",
        "1. 产品主图用于锁定产品比例、瓶身/包装结构、材质、Logo 位置和关键卖点，不得在后续图像或视频中漂移。",
        "2. Logo 必须保持形状、位置、颜色和可读性，不能被重绘成其他标识。",
        "3. 主角素材用于锁定人物身份、脸部、发型、服装和气质，不能换人。",
        "4. 场景素材用于锁定空间结构、道具位置、光线方向和环境氛围。",
        "5. 风格参考只约束镜头、质感、配色和情绪，不覆盖产品或人物身份。",
        "6. 参考视频用于锁定动作顺序、镜头运动、节奏和首尾帧衔接，后续生成必须保持人物、产品、场景、物品、光线和风格一致。",
        "7. 故事板、剪辑缺片和导演审校必须显式检查这些素材约束是否被遵守。",
    ].join("\n");
}

export function shouldAttachReferencePackToStep(step: DirectorWorkflowStep) {
    if (step.mode === "note") return false;
    const text = `${step.id}\n${step.title}\n${step.description || ""}\n${step.prompt}`.toLowerCase();
    if (step.mode === "image" || step.mode === "video") return true;
    return /storyboard|edit|review|分镜|故事板|剪辑|缺片|审校|复核|返工|视觉圣经|一致性|锁定|bible|consistency/.test(text);
}

export function getDirectorReferenceNodeIds(pack: DirectorReferencePackItem[]) {
    return Array.from(new Set(pack.map((item) => item.nodeId).filter(Boolean)));
}

export function createDirectorReferencePackItemFromNode(node: {
    id: string;
    type: CanvasNodeType;
    title: string;
    metadata?: {
        content?: string;
        storageKey?: string;
        mimeType?: string;
        bytes?: number;
        naturalWidth?: number;
        naturalHeight?: number;
        durationMs?: number;
        prompt?: string;
    };
}): DirectorReferencePackItem | null {
    const mediaType = mediaTypeFromNodeType(node.type);
    if (!mediaType) return null;
    const content = node.metadata?.content;
    if (mediaType !== "text" && !content) return null;
    return {
        id: node.id,
        nodeId: node.id,
        role: defaultDirectorReferenceRole(mediaType),
        mediaType,
        title: node.title || mediaTypeLabel(mediaType),
        type: node.type,
        text: mediaType === "text" ? content || node.metadata?.prompt : undefined,
        dataUrl: mediaType === "image" ? content : undefined,
        url: mediaType === "video" || mediaType === "audio" ? content : undefined,
        storageKey: node.metadata?.storageKey,
        mimeType: node.metadata?.mimeType,
        bytes: node.metadata?.bytes,
        width: node.metadata?.naturalWidth,
        height: node.metadata?.naturalHeight,
        durationMs: node.metadata?.durationMs,
    };
}

function mediaTypeFromNodeType(type: CanvasNodeType): DirectorReferencePackItem["mediaType"] | null {
    if (type === CanvasNodeType.Image) return "image";
    if (type === CanvasNodeType.Video) return "video";
    if (type === CanvasNodeType.Audio) return "audio";
    if (type === CanvasNodeType.Text) return "text";
    return null;
}

function mediaTypeLabel(mediaType: DirectorReferencePackItem["mediaType"]) {
    if (mediaType === "image") return "图片";
    if (mediaType === "video") return "视频";
    if (mediaType === "audio") return "音频";
    return "文本";
}

function formatDurationSeconds(durationMs: number) {
    return `${Number(durationMs / 1000).toFixed(durationMs % 1000 === 0 ? 0 : 1)}s`;
}
