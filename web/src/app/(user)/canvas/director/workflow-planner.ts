import { nanoid } from "nanoid";

import { buildDirectorReferencePackPrompt, directorReferencePackToLegacyReferences, shouldAttachReferencePackToStep } from "./reference-pack";
import type { DirectorReferencePackItem, DirectorStepMode, DirectorWorkflow, DirectorWorkflowMaterialization, DirectorWorkflowReference, DirectorWorkflowRunReport, DirectorWorkflowStep } from "./types";

type PlannerInput = {
    prompt: string;
    references: DirectorWorkflowReference[];
    referencePack?: DirectorReferencePackItem[];
    previousWorkflow?: DirectorWorkflow;
    baseWorkflowId?: string;
};

const MAX_STEPS = 12;

export function buildDirectorPlannerPrompt(input: PlannerInput) {
    const packText = buildDirectorReferencePackPrompt(input.referencePack || []);
    const fallbackReferences = input.references.length ? input.references : directorReferencePackToLegacyReferences(input.referencePack || []);
    const referenceText = fallbackReferences.length ? fallbackReferences.map((reference, index) => `${index + 1}. ${reference.title} (${reference.type})${reference.text ? `: ${reference.text.slice(0, 500)}` : ""}`).join("\n") : "无";
    const previousWorkflowText = input.previousWorkflow
        ? JSON.stringify(
              {
                  title: input.previousWorkflow.title,
                  summary: input.previousWorkflow.summary,
                  revisionIndex: input.previousWorkflow.revisionIndex || 0,
                  steps: input.previousWorkflow.steps,
              },
              null,
              2,
          )
        : "无";
    const revisionText = input.baseWorkflowId ? `\n当前是在修订工作流，baseWorkflowId=${input.baseWorkflowId}。请输出完整修订版，不要只输出差异。` : "";

    return `你是 CoGenesis Director，一个 AI 创作导演。请把用户给出的主题、图片参考、剧本、产品或广告需求，拆成可以在无限画布上执行的大型创作工作流。${revisionText}

只输出 JSON，不要输出 Markdown，也不要解释。

JSON 结构：
{
  "title": "工作流标题，中文，18 字以内",
  "summary": "一句话说明这个工作流要完成什么",
  "steps": [
    {
      "id": "step-1",
      "title": "步骤标题，中文，12 字以内",
      "mode": "text | image | video | audio | note",
      "prompt": "这个节点要执行的完整提示词，中文为主，可以包含必要英文镜头/风格词",
      "description": "这个步骤的用途",
      "dependsOn": ["step-1"]
    }
  ]
}

规则：
1. 步骤数量控制在 8 到 12 个，除非用户明确只要极简工作流。
2. mode 只能是 text、image、video、audio、note。
3. text 用于主题拆解、视觉圣经、资产故事板、剪辑方案、缺片检查、审校。
4. image 用于首图主视觉、角色/产品一致性、场景远景、动作关键帧、细节特写、分镜图。
5. video 用于分段镜头动态化，默认输出多个片段。
6. audio 用于旁白、配音、音效或音乐。
7. note 只用于不可执行的说明，尽量少用。
8. dependsOn 只能引用前面已经出现的 step id。
9. 每个可执行步骤的 prompt 必须能直接送进对应模型执行。
10. 每个步骤的 prompt 必须不同，不能只复制用户主题。
11. 工作流必须包含：主题拆解、视觉圣经、首张主视觉、角色或产品一致性锁定、至少 3 个细分图片/场景生成、基于前序所有节点结果重写的资产故事板、至少 2 个视频片段、剪辑/缺片方案、最终审校。
12. 资产故事板必须排在首图、一致性锁、场景远景、动作关键帧、细节特写之后，并在 prompt 中明确“读取前面所有已生成节点结果，不只依赖用户主题”。
13. 后续 image/video 步骤要在 prompt 中明确“以前面生成的首图、主体/产品一致性、场景和细节作为视觉锚点”，保持人物、场景、主体、产品、物品、光线和风格一致。
14. video 步骤要写清镜头运动、动作顺序、首帧/尾帧、时长感和一致性要求，并拆成片段 A/B/C 等，不直接假装已经完成最终合成。
15. 必须有剪辑方案节点，说明多片段如何剪到同一个输出、哪些片段已可用、哪些片段缺失、未完整成片时如何标记。
16. 如果用户需求含产品或品牌，必须加入“产品结构与包装一致性”步骤；否则使用“角色/主体一致性”步骤。

用户需求：
${input.prompt}

已选画布参考：
${referenceText}

${packText}

上一版导演工作流：
${previousWorkflowText}

如果用户是在修改上一版，请输出修订后的完整工作流，而不是只输出差异。`;
}

export function parseDirectorWorkflow(raw: string, input: PlannerInput): DirectorWorkflow {
    const parsed = parseJsonObject(raw);
    if (!parsed) return createFallbackDirectorWorkflow(input);
    const source = parsed as { title?: unknown; summary?: unknown; steps?: unknown };
    const rawSteps = Array.isArray(source.steps) ? source.steps : [];
    const steps = applyReferencePackGuard(normalizeSteps(rawSteps), input.referencePack);
    if (!isCompleteDirectorWorkflow(steps)) return createFallbackDirectorWorkflow(input);

    return {
        id: `director-${nanoid(8)}`,
        title: cleanText(source.title, "导演工作流").slice(0, 24),
        summary: cleanText(source.summary, "已根据你的创意搭建可执行的大型画布工作流。"),
        sourcePrompt: input.prompt,
        revisionOf: input.previousWorkflow ? { workflowId: input.previousWorkflow.id, workflowTitle: input.previousWorkflow.title, summary: input.previousWorkflow.summary } : undefined,
        revisionIndex: input.previousWorkflow ? (input.previousWorkflow.revisionIndex || 0) + 1 : 0,
        references: input.references.length ? input.references : directorReferencePackToLegacyReferences(input.referencePack || []),
        referencePack: input.referencePack,
        steps,
        createdAt: new Date().toISOString(),
    };
}

export function createFallbackDirectorWorkflow(input: PlannerInput): DirectorWorkflow {
    const lower = input.prompt.toLowerCase();
    const wantsAudio = /音频|旁白|配音|声音|音乐|audio|voice|sound|music/.test(lower);
    const isProduct = /产品|商品|包装|品牌|logo|电商|海报|广告|修护液|瓶|盒|product|brand|packaging/.test(lower);
    const consistencyLabel = isProduct ? "产品一致性" : "主体一致性";
    const subjectLabel = isProduct ? "产品" : "角色/主体";
    const audioRequirement = wantsAudio ? "\n同时给出旁白、音乐、音效或声音氛围建议，但不要牺牲视频片段和画面一致性。" : "";

    const steps: DirectorWorkflowStep[] = applyReferencePackGuard([
        {
            id: "brief",
            title: "主题拆解",
            mode: "text",
            prompt: `请把用户主题拆解成一份可执行创意简报。必须输出：核心故事、主体/产品、场景、情绪关键词、目标观众、视觉风格、镜头节奏、禁忌项和交付物清单。\n\n用户主题：\n${input.prompt}`,
            description: "把用户主题拆成创意简报、主体、场景和交付目标。",
        },
        {
            id: "visual-bible",
            title: "视觉圣经",
            mode: "text",
            prompt: `基于上一步创意简报，为该项目建立“视觉圣经”。必须输出：主体/产品的固定描述、颜色与材质、服装/包装细节、场景规则、镜头语言、光线规则、负面约束、所有后续图片和视频都必须遵守的一致性锁定词。\n\n用户主题：\n${input.prompt}`,
            description: "建立贯穿后续图片和视频的主体、产品、场景与风格规则。",
            dependsOn: ["brief"],
        },
        {
            id: "hero-image",
            title: "首图主视觉",
            mode: "image",
            prompt: `生成项目第一张主视觉图。请严格依据“视觉圣经”，画面必须同时交代主体/产品、核心场景和最终风格。要求：主体清晰，构图有电影感，暗色 Sacred Technology 舞台氛围，金色高光，细节可作为后续所有图片、故事板和视频片段的视觉锚点。主题：\n${input.prompt}`,
            description: "生成第一张主视觉，作为后续一致性的视觉锚点。",
            dependsOn: ["visual-bible"],
        },
        {
            id: "consistency-lock",
            title: consistencyLabel,
            mode: "image",
            prompt: `以上一步“首图主视觉”作为视觉锚点，生成${subjectLabel}一致性设定图。要求保留同一主体/产品外观、比例、颜色、材质、关键标识和风格；输出适合后续场景图继续引用的清晰正面/侧面/细节组合图。禁止改变主体身份、产品结构或核心场景逻辑。主题：\n${input.prompt}`,
            description: `锁定${subjectLabel}细节，防止后续图片和视频跑偏。`,
            dependsOn: ["hero-image"],
        },
        {
            id: "scene-wide",
            title: "场景远景",
            mode: "image",
            prompt: `以上一步“${consistencyLabel}”和“首图主视觉”作为参考，生成场景远景图。要求保持同一主体/产品与同一世界观，补全环境空间、背景层次、光线方向、道具位置和整体氛围；画面用于视频第 1-2 镜头。主题：\n${input.prompt}`,
            description: "扩展世界观和场景空间，保持主体与风格一致。",
            dependsOn: ["consistency-lock"],
        },
        {
            id: "scene-action",
            title: "动作关键帧",
            mode: "image",
            prompt: `以上一步“场景远景”和“${consistencyLabel}”作为参考，生成动作关键帧。要求主体/产品保持一致，动作更明确，画面聚焦关键事件和情绪峰值，适合作为视频中段的参考图。不要改变主体身份、产品结构、色彩体系和光线方向。主题：\n${input.prompt}`,
            description: "生成中段动作或产品展示关键帧。",
            dependsOn: ["scene-wide"],
        },
        {
            id: "detail-shots",
            title: "细节特写",
            mode: "image",
            prompt: `以上一步“动作关键帧”和“${consistencyLabel}”作为参考，生成 3 张细节特写方向的画面：主体/产品关键细节、环境互动细节、情绪/材质细节。保持同一主体、同一场景、同一光线与同一 Sacred Technology 风格。主题：\n${input.prompt}`,
            description: "补齐可用于剪辑、转场和主体强化的细节图。",
            dependsOn: ["scene-action"],
        },
        {
            id: "asset-storyboard",
            title: "资产故事板",
            mode: "text",
            prompt: `请读取前面所有已生成节点结果：创意简报、视觉圣经、首图主视觉、${consistencyLabel}、场景远景、动作关键帧、细节特写。基于这些真实结果重新创作资产故事板，不能只复述用户主题。必须输出：6-8 个镜头、每镜头引用的上游资产、人物/主体/产品/物品一致性锁、场景连续性、首帧、尾帧、镜头运动、视频片段归属、缺失资产清单和需要返工的图片节点。${audioRequirement}\n\n原始主题：\n${input.prompt}`,
            description: "读取前面所有节点结果后重新生成故事板，统一主体、场景、产品和镜头。",
            dependsOn: ["brief", "visual-bible", "hero-image", "consistency-lock", "scene-wide", "scene-action", "detail-shots"],
        },
        {
            id: "video-segment-a",
            title: "视频片段A",
            mode: "video",
            prompt: `根据资产故事板生成视频片段 A，时长 3-5 秒，只负责开场到核心动作建立。必须以前面生成的首图主视觉、场景远景和动作关键帧作为视觉锚点：主体/产品身份、外观、物品位置、场景光线、镜头色彩全部保持一致。写清首帧承接哪张图、尾帧停在什么动作，不要直接声称已完成整片合成。主题：\n${input.prompt}`,
            description: "生成开场到核心动作建立的第一段视频。",
            dependsOn: ["asset-storyboard", "hero-image", "scene-wide", "scene-action"],
        },
        {
            id: "video-segment-b",
            title: "视频片段B",
            mode: "video",
            prompt: `根据资产故事板生成视频片段 B，时长 3-5 秒，只负责动作推进、细节展示和转场余韵。必须以前面生成的${consistencyLabel}、动作关键帧和细节特写作为视觉锚点：人物/主体/产品、场景、物品、色彩、金色高光和暗色舞台氛围保持一致。片段 B 要能接在片段 A 后面，输出首帧、尾帧和剪辑衔接说明。主题：\n${input.prompt}`,
            description: "生成动作推进和细节展示的第二段视频。",
            dependsOn: ["asset-storyboard", "consistency-lock", "scene-action", "detail-shots"],
        },
        {
            id: "edit-plan",
            title: "剪辑缺片",
            mode: "text",
            prompt: `请读取资产故事板、视频片段 A、视频片段 B 和所有上游图片资产，生成剪辑方案与缺片检查。必须输出：时间线顺序、每个片段的入点/出点、转场、字幕/声音建议、可剪成一条输出的部分、缺失片段清单、未完整成片标记、下一步需要补生成的图片或视频提示词。禁止假装已经完成最终合成。${audioRequirement}\n\n原始主题：\n${input.prompt}`,
            description: "把多个视频片段组织成剪辑方案，并明确未完整成片和缺失内容。",
            dependsOn: ["asset-storyboard", "video-segment-a", "video-segment-b", "detail-shots"],
        },
        {
            id: "final-review",
            title: "导演审校",
            mode: "text",
            prompt: `请对整个工作流做最终导演审校。重点检查：主题是否被完整表达、人物/主体/产品是否始终一致、场景和物品是否连贯、首图到细分图再到视频片段是否有因果关系、剪辑方案是否明确标记未完整成片、哪些节点需要重生成。请输出“通过/需返工”、不一致风险列表和可直接复制的返工提示词。原始主题：\n${input.prompt}`,
            description: "检查主题、主体、场景、产品、片段和剪辑一致性，给出返工建议。",
            dependsOn: ["edit-plan"],
        },
    ], input.referencePack);

    return {
        id: `director-${nanoid(8)}`,
        title: "大型导演工作流",
        summary: "已用本地导演策略把主题拆成前序资产、基于真实节点结果的故事板、多段视频、剪辑缺片方案和审校流程。",
        sourcePrompt: input.prompt,
        revisionOf: input.previousWorkflow ? { workflowId: input.previousWorkflow.id, workflowTitle: input.previousWorkflow.title, summary: input.previousWorkflow.summary } : undefined,
        revisionIndex: input.previousWorkflow ? (input.previousWorkflow.revisionIndex || 0) + 1 : 0,
        references: input.references.length ? input.references : directorReferencePackToLegacyReferences(input.referencePack || []),
        referencePack: input.referencePack,
        steps,
        createdAt: new Date().toISOString(),
    };
}

export function formatDirectorWorkflowText(workflow: DirectorWorkflow, materialization?: DirectorWorkflowMaterialization, runReport?: DirectorWorkflowRunReport) {
    const revisionText = workflow.revisionOf ? `\n修订自：${workflow.revisionOf.workflowTitle || workflow.revisionOf.workflowId}${workflow.revisionIndex ? ` · 第 ${workflow.revisionIndex} 版` : ""}` : "";
    const lines = [`已生成导演工作流：${workflow.title}${revisionText}`, "", workflow.summary, "", ...workflow.steps.map((step, index) => `${index + 1}. ${step.title} · ${modeLabel(step.mode)}\n${step.description || step.prompt.slice(0, 80)}`)];
    if (materialization) {
        lines.push("", `已搭建到画布：${materialization.nodeIds.length} 个节点，${materialization.connectionIds.length} 条连线。`);
    }
    if (runReport) {
        lines.push("", `执行结果：完成 ${runReport.executedCount} 个，跳过 ${runReport.skippedCount} 个，失败 ${runReport.failedCount} 个。`);
    }
    return lines.join("\n");
}

function parseJsonObject(raw: string) {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
        return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    } catch {
        return null;
    }
}

function normalizeSteps(rawSteps: unknown[]): DirectorWorkflowStep[] {
    const usedIds = new Set<string>();
    const validIds = new Set<string>();
    return rawSteps.slice(0, MAX_STEPS).flatMap((item, index) => {
        const source = item as { id?: unknown; title?: unknown; mode?: unknown; prompt?: unknown; description?: unknown; dependsOn?: unknown };
        const mode = normalizeMode(source.mode);
        const prompt = cleanText(source.prompt, "");
        if (!mode || !prompt) return [];
        const fallbackId = `step-${index + 1}`;
        let id = cleanId(source.id, fallbackId);
        while (usedIds.has(id)) id = `${fallbackId}-${usedIds.size + 1}`;
        usedIds.add(id);
        const dependsOn = Array.isArray(source.dependsOn) ? source.dependsOn.map((value) => cleanId(value, "")).filter((value) => value && validIds.has(value)) : [];
        validIds.add(id);
        return [
            {
                id,
                title: cleanText(source.title, modeLabel(mode)).slice(0, 18),
                mode,
                prompt,
                description: cleanText(source.description, ""),
                dependsOn,
            },
        ];
    });
}

function applyReferencePackGuard(steps: DirectorWorkflowStep[], referencePack?: DirectorReferencePackItem[]) {
    if (!referencePack?.length) return steps;
    const guard = [
        "客户素材包一致性硬性约束：",
        "必须读取并遵守已连接的客户素材包节点；产品主图锁定产品比例、结构、材质和 Logo 位置；Logo 不得变形或替换；主角素材不得换人；场景素材锁定空间、道具和光线；参考视频锁定动作顺序、镜头运动和首尾帧节奏。",
        "生成或审校时必须显式检查人物、产品、场景、主体物品、包装、Logo、光线和风格是否与客户素材一致。",
    ].join("\n");
    return steps.map((step) => (shouldAttachReferencePackToStep(step) && !step.prompt.includes("客户素材包一致性硬性约束") ? { ...step, prompt: `${step.prompt}\n\n${guard}` } : step));
}

function isCompleteDirectorWorkflow(steps: DirectorWorkflowStep[]) {
    if (steps.length < 8 || steps.length > MAX_STEPS) return false;
    const prompts = steps.map((step) => step.prompt.trim().replace(/\s+/g, " "));
    if (new Set(prompts).size !== prompts.length) return false;

    const modeCounts = steps.reduce(
        (counts, step) => {
            counts[step.mode] = (counts[step.mode] || 0) + 1;
            return counts;
        },
        {} as Record<DirectorStepMode, number>,
    );
    if ((modeCounts.text || 0) < 3) return false;
    if ((modeCounts.image || 0) < 4) return false;
    if ((modeCounts.video || 0) < 2) return false;

    const text = steps.map((step) => `${step.title}\n${step.description || ""}\n${step.prompt}`).join("\n").toLowerCase();
    const hasAllRequiredBlocks = [
        ["主题拆解", "创意简报", "brief"],
        ["视觉圣经", "视觉规则", "风格规则", "visual bible"],
        ["分镜", "故事板", "storyboard"],
        ["首图", "主视觉", "视觉锚点"],
        ["一致性", "锁定", "consistency"],
        ["场景", "远景", "关键帧", "细节", "特写"],
        ["视频片段", "片段", "segment"],
        ["剪辑", "缺片", "未完整", "edit"],
        ["审校", "复核", "返工", "review"],
    ].every((keywords) => keywords.some((keyword) => text.includes(keyword)));
    if (!hasAllRequiredBlocks) return false;

    const imageSceneSteps = steps.filter((step) => step.mode === "image" && /场景|远景|关键帧|细节|特写|分镜/.test(`${step.title}\n${step.description || ""}\n${step.prompt}`));
    if (imageSceneSteps.length < 3) return false;

    const storyboardIndex = steps.findIndex((step) => /分镜|故事板|storyboard/i.test(`${step.id}\n${step.title}\n${step.description || ""}`));
    const firstVideoIndex = steps.findIndex((step) => step.mode === "video");
    const firstImageIndex = steps.findIndex((step) => step.mode === "image");
    if (storyboardIndex <= firstImageIndex || storyboardIndex < 0 || firstVideoIndex < 0 || storyboardIndex >= firstVideoIndex) return false;

    const storyboardStep = steps[storyboardIndex];
    const storyboardText = `${storyboardStep.title}\n${storyboardStep.description || ""}\n${storyboardStep.prompt}`;
    if (!/前面所有|所有已生成|上游|真实结果|节点结果/.test(storyboardText)) return false;

    return steps.some((step) => /剪辑|缺片|未完整|edit/i.test(`${step.id}\n${step.title}\n${step.description || ""}\n${step.prompt}`));
}

function normalizeMode(value: unknown): DirectorStepMode | null {
    if (value === "text" || value === "image" || value === "video" || value === "audio" || value === "note") return value;
    return null;
}

function cleanText(value: unknown, fallback: string) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanId(value: unknown, fallback: string) {
    const text = typeof value === "string" ? value : fallback;
    return text
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 32);
}

function modeLabel(mode: DirectorStepMode) {
    return ({ text: "文本", image: "图像", video: "视频", audio: "音频", note: "备注" } as Record<DirectorStepMode, string>)[mode];
}
