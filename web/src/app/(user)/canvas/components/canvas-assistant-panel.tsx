"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Bot, Film, History, ImageIcon, LoaderCircle, MessageSquare, Mic2, PanelRightClose, Paperclip, Play, Plus, RotateCcw, Settings2, Sparkles, Trash2, Workflow, X } from "lucide-react";
import { Button, Modal, Select, Tooltip } from "antd";
import { motion } from "motion/react";

import { ImageGenerationPending } from "@/components/image-generation-pending";
import { ModelPicker } from "@/components/model-picker";
import { useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { CreditSymbol, requestCreditCost } from "@/constant/credits";
import { canvasThemes } from "@/lib/canvas-theme";
import { nanoid } from "nanoid";
import { cn } from "@/lib/utils";
import { requestEdit, requestGeneration, requestImageQuestion, type ChatCompletionMessage } from "@/services/api/image";
import { imageToDataUrl, uploadImage } from "@/services/image-storage";
import { useAssetStore } from "@/stores/use-asset-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { imageReferenceLabel } from "@/lib/image-reference-prompt";
import type { ReferenceImage } from "@/types/image";
import { DiaTextReveal } from "@/components/ui/dia-text-reveal";
import { CanvasImageSettingsPopover } from "./canvas-image-settings-popover";
import { CanvasPromptLibrary } from "./canvas-prompt-library";
import { CanvasNodeType, type CanvasAssistantImage, type CanvasAssistantMessage, type CanvasAssistantReference, type CanvasAssistantSession, type CanvasNodeData } from "../types";
import { DIRECTOR_REFERENCE_ROLE_OPTIONS, createDirectorReferencePackItemFromNode, directorReferencePackToLegacyReferences } from "../director/reference-pack";
import { buildDirectorPlannerPrompt, createFallbackDirectorWorkflow, formatDirectorWorkflowText, parseDirectorWorkflow } from "../director/workflow-planner";
import type { DirectorReferencePackItem, DirectorReferenceRole, DirectorWorkflow, DirectorWorkflowMaterialization, DirectorWorkflowReference, DirectorWorkflowRunReport } from "../director/types";
import type { CanvasAgentAssetPackItem, CanvasAgentTaskQueueItem } from "../utils/canvas-agent-ops";

type AssistantMode = "ask" | "image" | "director";
type CanvasControlPanelMode = "director" | "local-agent";
const PANEL_MOTION_MS = 500;
const PANEL_MOTION_SECONDS = PANEL_MOTION_MS / 1000;
type AssistantTaskState = Record<string, true>;

type CanvasAssistantPanelProps = {
    nodes: CanvasNodeData[];
    selectedNodeIds: Set<string>;
    sessions: CanvasAssistantSession[];
    activeSessionId: string | null;
    onSelectNodeIds: (ids: Set<string>) => void;
    onSessionsChange: (sessions: CanvasAssistantSession[], activeSessionId: string | null) => void;
    onInsertImage: (image: CanvasAssistantImage) => void;
    onInsertText: (text: string) => void;
    onApplyDirectorWorkflow: (workflow: DirectorWorkflow) => Promise<DirectorWorkflowMaterialization>;
    onExecuteDirectorWorkflow: (materialization: DirectorWorkflowMaterialization) => Promise<DirectorWorkflowRunReport>;
    onHandoffDirectorWorkflowToAgent: (workflow: DirectorWorkflow, materialization: DirectorWorkflowMaterialization) => void;
    onPasteImage: (file: File) => void;
    onAttachReferenceFile: (file: File, role: DirectorReferenceRole) => Promise<DirectorReferencePackItem | null>;
    sharedReferencePack: DirectorReferencePackItem[];
    onSharedReferencePackChange: (pack: DirectorReferencePackItem[]) => void;
    sharedAssetPack: CanvasAgentAssetPackItem[];
    sharedTaskQueue: CanvasAgentTaskQueueItem[];
    panelMode: CanvasControlPanelMode;
    onPanelModeChange: (mode: CanvasControlPanelMode) => void;
    hidden?: boolean;
    onCollapseStart: () => void;
    onCollapse: () => void;
};

export function CanvasAssistantPanel({ nodes, selectedNodeIds, sessions, activeSessionId, onSelectNodeIds, onSessionsChange, onInsertImage, onInsertText, onApplyDirectorWorkflow, onExecuteDirectorWorkflow, onHandoffDirectorWorkflowToAgent, onPasteImage, onAttachReferenceFile, sharedReferencePack, onSharedReferencePackChange, sharedAssetPack, sharedTaskQueue, panelMode, onPanelModeChange, hidden = false, onCollapseStart, onCollapse }: CanvasAssistantPanelProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const effectiveConfig = useEffectiveConfig();
    const modelCosts = useConfigStore((state) => state.publicSettings?.modelChannel.modelCosts);
    const cleanupImages = useAssetStore((state) => state.cleanupImages);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const [width, setWidth] = useState(390);
    const [view, setView] = useState<"chat" | "history">("chat");
    const [mode, setMode] = useState<AssistantMode>("image");
    const [prompt, setPrompt] = useState("");
    const [runningTasks, setRunningTasks] = useState<AssistantTaskState>({});
    const [checkedChatIds, setCheckedChatIds] = useState<string[]>([]);
    const [deleteChatIds, setDeleteChatIds] = useState<string[]>([]);
    const [closing, setClosing] = useState(false);
    const [resizing, setResizing] = useState(false);
    const [removedReferenceIds, setRemovedReferenceIds] = useState<Set<string>>(new Set());
    const [referencePack, setReferencePack] = useState<DirectorReferencePackItem[]>([]);
    const [localSessions, setLocalSessions] = useState<CanvasAssistantSession[]>(() => (sessions.length ? sessions : [createSession()]));
    const [localActiveSessionId, setLocalActiveSessionId] = useState<string | null>(activeSessionId);
    const executingDirectorMessageIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!sessions.length) return;
        setLocalSessions(sessions);
        setLocalActiveSessionId(activeSessionId);
    }, [activeSessionId, sessions]);

    useEffect(() => {
        onSessionsChange(localSessions, localActiveSessionId);
    }, [localActiveSessionId, localSessions, onSessionsChange]);

    useEffect(() => {
        setReferencePack((prev) => (packsEqual(prev, sharedReferencePack) ? prev : sharedReferencePack));
    }, [sharedReferencePack]);

    const updateReferencePack = (updater: (current: DirectorReferencePackItem[]) => DirectorReferencePackItem[]) => {
        setReferencePack((prev) => {
            const next = updater(prev);
            onSharedReferencePackChange(next);
            return next;
        });
    };

    const safeSessions = localSessions.length ? localSessions : [createSession()];
    const activeSession = useMemo(() => safeSessions.find((session) => session.id === localActiveSessionId) || safeSessions[0] || null, [localActiveSessionId, safeSessions]);
    const historySessions = safeSessions.filter((session) => session.messages.length > 0);
    const messages = activeSession?.messages || [];
    const hasMessages = messages.length > 0;
    const selectedNodeKey = useMemo(() => Array.from(selectedNodeIds).sort().join(","), [selectedNodeIds]);
    const allSelectedReferences = useMemo(() => buildAssistantReferences(nodes, selectedNodeIds), [nodes, selectedNodeIds]);
    const selectedReferences = useMemo(() => allSelectedReferences.filter((item) => !removedReferenceIds.has(item.id)), [allSelectedReferences, removedReferenceIds]);
    const selectedReferencePack = useMemo(() => buildSelectedReferencePack(nodes, selectedNodeIds, removedReferenceIds), [nodes, selectedNodeIds, removedReferenceIds]);
    const activeReferencePack = useMemo(() => mergeReferencePackItems([...selectedReferencePack, ...referencePack]), [referencePack, selectedReferencePack]);
    const assistantConfig = useMemo(() => ({ ...effectiveConfig, count: effectiveConfig.canvasImageCount || effectiveConfig.count }), [effectiveConfig]);
    const iconButtonStyle = { color: theme.node.muted };
    const hasRunningTasks = Object.keys(runningTasks).length > 0;
    const sharedSummary = useMemo(
        () => ({
            nodes: nodes.length,
            references: activeReferencePack.length,
            assets: sharedAssetPack.length,
            queue: sharedTaskQueue.length,
            ready: sharedTaskQueue.filter((item) => item.runState === "ready" || item.runState === "planned").length,
            running: sharedTaskQueue.filter((item) => item.runState === "running").length,
        }),
        [activeReferencePack.length, nodes.length, sharedAssetPack.length, sharedTaskQueue],
    );

    useEffect(() => {
        setRemovedReferenceIds(new Set());
    }, [selectedNodeKey]);

    const updateSession = (sessionId: string, updater: (session: CanvasAssistantSession) => CanvasAssistantSession) => {
        setLocalSessions((prev) => prev.map((session) => (session.id === sessionId ? updater(session) : session)));
    };

    const appendMessage = (sessionId: string, message: CanvasAssistantMessage) => {
        updateSession(sessionId, (session) => ({
            ...session,
            title: session.messages.length ? session.title : message.text.slice(0, 18) || "新对话",
            messages: [...session.messages, message],
            updatedAt: new Date().toISOString(),
        }));
    };

    const updateMessage = (sessionId: string, messageId: string, patch: Partial<CanvasAssistantMessage>) => {
        updateSession(sessionId, (session) => ({
            ...session,
            messages: session.messages.map((message) => (message.id === messageId ? { ...message, ...patch } : message)),
            updatedAt: new Date().toISOString(),
        }));
    };

    const markTaskRunning = (taskId: string, running: boolean) => {
        setRunningTasks((current) => {
            if (running) return { ...current, [taskId]: true };
            const { [taskId]: _done, ...rest } = current;
            return rest;
        });
    };

    const startChatSession = () => {
        if (activeSession && activeSession.messages.length === 0) {
            setLocalActiveSessionId(activeSession.id);
            return;
        }
        const session = createSession();
        setLocalSessions((prev) => [session, ...prev]);
        setLocalActiveSessionId(session.id);
    };

    const removeSessions = (ids: string[]) => {
        const next = safeSessions.filter((session) => !ids.includes(session.id));
        if (!next.length) {
            const session = createSession();
            setLocalSessions([session]);
            setLocalActiveSessionId(session.id);
        } else {
            setLocalSessions(next);
            setLocalActiveSessionId(localActiveSessionId && ids.includes(localActiveSessionId) ? next[0].id : localActiveSessionId);
        }
        cleanupImages({ sessions: next });
        setCheckedChatIds((prev) => prev.filter((id) => !ids.includes(id)));
    };

    const clearSessions = () => {
        const session = createSession();
        setLocalSessions([session]);
        setLocalActiveSessionId(session.id);
        setCheckedChatIds([]);
        cleanupImages({ sessions: [session] });
    };

    const sendMessage = async (text: string, nextMode: AssistantMode, history: CanvasAssistantMessage[], savedReferences?: CanvasAssistantReference[], savedReferencePack?: DirectorReferencePackItem[]) => {
        const requestConfig = { ...effectiveConfig, count: nextMode === "image" ? effectiveConfig.canvasImageCount || effectiveConfig.count : effectiveConfig.count, model: nextMode === "image" ? effectiveConfig.imageModel || effectiveConfig.model : effectiveConfig.textModel || effectiveConfig.model };
        const canUseAi = isAiConfigReady(requestConfig, requestConfig.model, nextMode === "image" ? "image" : "text");
        if (!canUseAi && nextMode !== "director") {
            openConfigDialog(true);
            return;
        }

        const session = activeSession || createSession();
        if (!activeSession) {
            setLocalSessions([session]);
            setLocalActiveSessionId(session.id);
        }

        const refs = savedReferences || selectedReferences;
        const pack = savedReferencePack || activeReferencePack;
        const userMessage: CanvasAssistantMessage = { id: nanoid(), role: "user", mode: nextMode, text, references: refs, referencePack: pack };
        const assistantId = nanoid();
        appendMessage(session.id, userMessage);
        appendMessage(session.id, { id: assistantId, role: "assistant", mode: nextMode, text: nextMode === "image" ? "正在生成图片" : nextMode === "director" ? "正在生成导演工作流" : "正在回答", isLoading: true });
        setPrompt("");
        markTaskRunning(assistantId, true);

        try {
            if (nextMode === "director") {
                const directorReferences = pack.length ? directorReferencePackToLegacyReferences(pack) : refs.map(referenceToDirectorReference);
                const previousWorkflow = findLastDirectorWorkflow(history);
                let rawWorkflow = "";
                let plannerError = "";
                if (canUseAi) {
                    try {
                        rawWorkflow = await requestImageQuestion(requestConfig, await buildDirectorPlannerMessages({ prompt: text, references: directorReferences, referencePack: pack, previousWorkflow }), () => {
                            updateMessage(session.id, assistantId, { text: "正在拆解创意、规划节点与依赖关系...", isLoading: true });
                        });
                    } catch (error) {
                        plannerError = error instanceof Error ? error.message : "文本模型规划失败";
                    }
                }
                const workflow = rawWorkflow ? parseDirectorWorkflow(rawWorkflow, { prompt: text, references: directorReferences, referencePack: pack }) : createFallbackDirectorWorkflow({ prompt: text, references: directorReferences, referencePack: pack });
                const materialization = await onApplyDirectorWorkflow(workflow);
                const workflowText = formatDirectorWorkflowText(workflow, materialization);
                updateMessage(session.id, assistantId, {
                    text: plannerError ? `${workflowText}\n\n文本模型规划失败，已自动切换本地导演策略：${plannerError}` : workflowText,
                    directorWorkflow: workflow,
                    directorMaterialization: materialization,
                    isLoading: false,
                });
                return;
            }

            if (nextMode === "image") {
                const referenceImages: ReferenceImage[] = await Promise.all(
                    refs.filter((item) => item.dataUrl).map(async (item) => ({ id: item.id, name: `${item.title}.png`, type: "image/png", dataUrl: await imageToDataUrl(item), storageKey: item.storageKey })),
                );
                const images = referenceImages.length ? await requestEdit(requestConfig, text, referenceImages) : await requestGeneration(requestConfig, text);
                const storedImages = await Promise.all(images.map((image) => uploadImage(image.dataUrl)));
                updateMessage(session.id, assistantId, {
                    text: `生成了 ${storedImages.length} 张图片`,
                    images: storedImages.map((image, index) => ({ id: images[index].id, dataUrl: image.url, storageKey: image.storageKey, prompt: text })),
                    isLoading: false,
                });
                return;
            }

            const answer = await requestImageQuestion(requestConfig, await buildChatMessages([...history, userMessage]), (streamed) => {
                updateMessage(session.id, assistantId, { text: streamed, isLoading: false });
            });
            updateMessage(session.id, assistantId, { text: answer, isLoading: false });
        } catch (error) {
            updateMessage(session.id, assistantId, { text: error instanceof Error ? error.message : "操作失败", isLoading: false });
        } finally {
            markTaskRunning(assistantId, false);
        }
    };

    const submit = async () => {
        const text = prompt.trim();
        if (!text) return;
        void sendMessage(text, mode, messages);
    };

    const retryMessage = (message: CanvasAssistantMessage) => {
        const index = messages.findIndex((item) => item.id === message.id);
        const userIndex = messages.slice(0, index).findLastIndex((item) => item.role === "user");
        const user = messages[userIndex];
        if (user) void sendMessage(user.text, user.mode, messages.slice(0, userIndex), user.references, user.referencePack);
    };

    const executeDirectorMessage = async (message: CanvasAssistantMessage) => {
        if (!message.directorWorkflow) return;
        const sessionId = activeSession?.id;
        if (!sessionId) return;
        if (executingDirectorMessageIdsRef.current.has(message.id)) return;
        executingDirectorMessageIdsRef.current.add(message.id);
        markTaskRunning(message.id, true);
        updateMessage(sessionId, message.id, { isExecuting: true });
        try {
            const materialization = message.directorMaterialization || (await onApplyDirectorWorkflow(message.directorWorkflow));
            updateMessage(sessionId, message.id, { directorMaterialization: materialization });
            const report = await onExecuteDirectorWorkflow(materialization);
            updateMessage(sessionId, message.id, {
                text: formatDirectorWorkflowText(message.directorWorkflow, materialization, report),
                directorRunReport: report,
                isExecuting: false,
            });
        } catch (error) {
            updateMessage(sessionId, message.id, { text: error instanceof Error ? error.message : "工作流执行失败", isExecuting: false });
        } finally {
            executingDirectorMessageIdsRef.current.delete(message.id);
            markTaskRunning(message.id, false);
        }
    };

    const handoffDirectorMessageToAgent = async (message: CanvasAssistantMessage) => {
        if (!message.directorWorkflow) return;
        const sessionId = activeSession?.id;
        if (!sessionId) return;
        try {
            const materialization = message.directorMaterialization || (await onApplyDirectorWorkflow(message.directorWorkflow));
            updateMessage(sessionId, message.id, { directorMaterialization: materialization });
            onHandoffDirectorWorkflowToAgent(message.directorWorkflow, materialization);
        } catch (error) {
            updateMessage(sessionId, message.id, { text: error instanceof Error ? error.message : "交给本地 Agent 失败", isExecuting: false });
        }
    };

    const startResize = () => {
        const move = (event: MouseEvent) => setWidth(Math.min(760, Math.max(320, window.innerWidth - event.clientX)));
        const stop = () => {
            setResizing(false);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseup", stop);
        };
        setResizing(true);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", stop);
    };

    const collapse = () => {
        setClosing(true);
        onCollapseStart();
        window.setTimeout(onCollapse, PANEL_MOTION_MS);
    };

    return (
        <motion.div
            className="flex shrink-0"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: closing || hidden ? 0 : width + 1, opacity: closing || hidden ? 0 : 1 }}
            transition={{ duration: resizing ? 0 : PANEL_MOTION_SECONDS, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: hidden ? "none" : undefined, overflow: "clip", pointerEvents: closing || hidden ? "none" : undefined }}
        >
            <motion.aside
                className="relative flex shrink-0 flex-col border-l"
                initial={{ x: 48 }}
                animate={{ x: closing || hidden ? 28 : 0 }}
                transition={{ duration: resizing ? 0 : PANEL_MOTION_SECONDS, ease: [0.22, 1, 0.36, 1] }}
                style={{ width, background: theme.node.panel, borderColor: theme.node.stroke, color: theme.node.text }}
            >
                <button type="button" className="absolute inset-y-0 left-0 z-40 w-4 -translate-x-1/2 cursor-col-resize" onMouseDown={startResize} aria-label="调整右侧面板宽度" />
                <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: theme.node.stroke }}>
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                            <Sparkles className="size-4 shrink-0" />
                            <span className="truncate">{view === "history" ? "历史记录" : "创作控制台"}</span>
                        </div>
                        <PanelModeSwitch value={panelMode} theme={theme} onChange={onPanelModeChange} />
                    </div>
                    <div className="flex items-center gap-1">
                        {view === "history" ? (
                            <>
                                <Tooltip title="删除选中">
                                    <Button type="text" shape="circle" className="!h-8 !w-8 !min-w-8" style={iconButtonStyle} icon={<Trash2 className="size-4" />} disabled={!checkedChatIds.length} onClick={() => setDeleteChatIds(checkedChatIds)} />
                                </Tooltip>
                                <Tooltip title="删除全部">
                                    <Button
                                        type="text"
                                        shape="circle"
                                        className="!h-8 !w-8 !min-w-8"
                                        style={iconButtonStyle}
                                        icon={<X className="size-4" />}
                                        disabled={!historySessions.length}
                                        onClick={() => setDeleteChatIds(historySessions.map((session) => session.id))}
                                    />
                                </Tooltip>
                            </>
                        ) : null}
                        <Tooltip title={view === "history" ? "返回对话" : "历史记录"}>
                            <Button type="text" shape="circle" className="!h-8 !w-8 !min-w-8" style={iconButtonStyle} icon={<History className="size-4" />} onClick={() => setView(view === "history" ? "chat" : "history")} />
                        </Tooltip>
                        <Tooltip title="新对话">
                            <Button
                                type="text"
                                shape="circle"
                                className="!h-8 !w-8 !min-w-8"
                                style={iconButtonStyle}
                                icon={<Plus className="size-4" />}
                                disabled={!hasMessages}
                                onClick={() => {
                                    startChatSession();
                                    setView("chat");
                                }}
                            />
                        </Tooltip>
                        <Tooltip title="配置">
                            <Button type="text" shape="circle" className="!h-8 !w-8 !min-w-8" style={iconButtonStyle} icon={<Settings2 className="size-4" />} onClick={() => openConfigDialog(false)} />
                        </Tooltip>
                        <Tooltip title="收起对话">
                            <Button type="text" shape="circle" className="!h-8 !w-8 !min-w-8" style={iconButtonStyle} icon={<PanelRightClose className="size-4" />} onClick={collapse} />
                        </Tooltip>
                    </div>
                </div>
                <DirectorSharedContextSummary theme={theme} summary={sharedSummary} />

                <div className="thin-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                    {view === "history" ? (
                        <AssistantHistory
                            sessions={historySessions}
                            activeSession={activeSession}
                            checkedIds={checkedChatIds.filter((id) => historySessions.some((session) => session.id === id))}
                            onToggleChecked={(id, checked) => setCheckedChatIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((item) => item !== id)))}
                            onOpen={(id) => {
                                setLocalActiveSessionId(id);
                                setView("chat");
                            }}
                            onDelete={(id) => setDeleteChatIds([id])}
                        />
                    ) : messages.length ? (
                        <AssistantMessages messages={messages} onRetry={retryMessage} onInsertImage={onInsertImage} onInsertText={onInsertText} onExecuteDirectorWorkflow={executeDirectorMessage} onHandoffDirectorWorkflowToAgent={handoffDirectorMessageToAgent} />
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center px-1 text-center">
                            <div className="relative font-serif text-4xl font-bold italic tracking-normal" style={{ color: theme.node.text }}>
                                <span>共生画布</span>
                                <DiaTextReveal className="absolute inset-0" colors={["#e9c176", "#fff1c4", "#a98f51"]} textColor="transparent" duration={1.8} startOnView={false} text="共生画布" />
                            </div>
                            <div className="mt-3 font-serif text-base italic opacity-60">人与 AI 彼此创世，彼此成就。</div>
                        </div>
                    )}
                </div>

                {view === "chat" ? (
                    <AssistantComposer
                        mode={mode}
                        prompt={prompt}
                        isRunning={hasRunningTasks}
                        references={selectedReferences}
                        referencePack={activeReferencePack}
                        config={assistantConfig}
                        onModeChange={setMode}
                        onPromptChange={setPrompt}
                        onSubmit={submit}
                        onConfigChange={(key, value) => updateConfig(key === "count" ? "canvasImageCount" : key, value)}
                        onMissingConfig={() => openConfigDialog(true)}
                        onRemoveReference={(id) => {
                            setRemovedReferenceIds((prev) => new Set(prev).add(id));
                            updateReferencePack((prev) => prev.filter((item) => item.nodeId !== id));
                            if (selectedNodeIds.has(id)) onSelectNodeIds(new Set(Array.from(selectedNodeIds).filter((nodeId) => nodeId !== id)));
                        }}
                        onPasteImage={onPasteImage}
                        onAttachReferenceFile={onAttachReferenceFile}
                        onReferenceRoleChange={(id, role) => {
                            updateReferencePack((prev) => {
                                const hasItem = prev.some((item) => item.id === id || item.nodeId === id);
                                if (hasItem) return prev.map((item) => (item.id === id || item.nodeId === id ? { ...item, role } : item));
                                const selectedItem = activeReferencePack.find((item) => item.id === id || item.nodeId === id);
                                return selectedItem ? mergeReferencePackItems([...prev, { ...selectedItem, role }]) : prev;
                            });
                        }}
                        onAddReferencePackItem={(item) => {
                            updateReferencePack((prev) => mergeReferencePackItems([...prev, item]));
                            onSelectNodeIds(new Set([...Array.from(selectedNodeIds), item.nodeId]));
                        }}
                        modelCosts={modelCosts}
                    />
                ) : null}

                <Modal
                    title="删除对话记录？"
                    open={deleteChatIds.length > 0}
                    centered
                    onCancel={() => setDeleteChatIds([])}
                    footer={
                        <>
                            <Button onClick={() => setDeleteChatIds([])}>取消</Button>
                            <Button
                                danger
                                type="primary"
                                onClick={() => {
                                    deleteChatIds.length === historySessions.length ? clearSessions() : removeSessions(deleteChatIds);
                                    setDeleteChatIds([]);
                                }}
                            >
                                删除
                            </Button>
                        </>
                    }
                >
                    <p className="text-sm opacity-60">将删除 {deleteChatIds.length} 条对话记录，此操作不可撤销。</p>
                </Modal>
            </motion.aside>
        </motion.div>
    );
}

function AssistantComposer({
    mode,
    prompt,
    isRunning,
    references,
    referencePack,
    config,
    onModeChange,
    onPromptChange,
    onSubmit,
    onConfigChange,
    onMissingConfig,
    onRemoveReference,
    onPasteImage,
    onAttachReferenceFile,
    onReferenceRoleChange,
    onAddReferencePackItem,
    modelCosts,
}: {
    mode: AssistantMode;
    prompt: string;
    isRunning: boolean;
    references: CanvasAssistantReference[];
    referencePack: DirectorReferencePackItem[];
    config: AiConfig;
    onModeChange: (mode: AssistantMode) => void;
    onPromptChange: (prompt: string) => void;
    onSubmit: () => void;
    onConfigChange: (key: keyof AiConfig, value: string) => void;
    onMissingConfig: () => void;
    onRemoveReference: (id: string) => void;
    onPasteImage: (file: File) => void;
    onAttachReferenceFile: (file: File, role: DirectorReferenceRole) => Promise<DirectorReferencePackItem | null>;
    onReferenceRoleChange: (id: string, role: DirectorReferenceRole) => void;
    onAddReferencePackItem: (item: DirectorReferencePackItem) => void;
    modelCosts?: { model: string; credits: number }[];
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [attachRole, setAttachRole] = useState<DirectorReferenceRole>("product");
    const [attaching, setAttaching] = useState(false);
    const activeModel = mode === "image" ? config.imageModel || config.model : config.textModel || config.model;
    const credits = requestCreditCost({ channelMode: config.channelMode, modelCosts, model: activeModel, count: mode === "image" ? config.count : 1 });

    return (
        <div className="px-2 pb-2" onWheelCapture={(event) => event.stopPropagation()}>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav"
                className="hidden"
                onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    setAttaching(true);
                    try {
                        const item = await onAttachReferenceFile(file, attachRole);
                        if (item) onAddReferencePackItem({ ...item, role: attachRole });
                    } finally {
                        setAttaching(false);
                    }
                }}
            />
            {references.length ? (
                <div className="thin-scrollbar mb-1.5 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1">
                    {references.map((item, index) => (
                        <AssistantReferenceChip key={item.id} item={item} label={assistantImageReferenceLabel(references, index)} onRemove={() => onRemoveReference(item.id)} />
                    ))}
                </div>
            ) : null}
            <div className="rounded-lg border px-3 pb-3 pt-3 shadow-lg" style={{ background: theme.toolbar.panel, borderColor: theme.node.stroke }}>
                {referencePack.length ? (
                    <div className="mb-2 rounded-lg border px-2 py-2" style={{ borderColor: theme.node.stroke, background: theme.node.fill }}>
                        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs" style={{ color: theme.node.muted }}>
                            <span className="inline-flex items-center gap-1">
                                <Paperclip className="size-3.5" />
                                客户素材包
                            </span>
                            <span>{referencePack.length} 个</span>
                        </div>
                        <div className="thin-scrollbar flex max-h-24 flex-col gap-1.5 overflow-y-auto pr-1">
                            {referencePack.map((item) => (
                                <DirectorReferencePackChip key={item.id} item={item} theme={theme} onRoleChange={(role) => onReferenceRoleChange(item.id, role)} onRemove={() => onRemoveReference(item.nodeId)} />
                            ))}
                        </div>
                    </div>
                ) : null}
                <textarea
                    value={prompt}
                    onChange={(event) => onPromptChange(event.target.value)}
                    onPaste={(event) => {
                        const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
                        if (!file) return;
                        event.preventDefault();
                        onPasteImage(file);
                    }}
                    onKeyDown={(event) => {
                        if (event.key !== "Enter" || event.ctrlKey || event.metaKey || event.shiftKey) return;
                        event.preventDefault();
                        void onSubmit();
                    }}
                    className="thin-scrollbar h-20 w-full resize-none border-0 bg-transparent px-1 py-1 text-sm leading-5 outline-none placeholder:text-stone-400"
                    style={{ color: theme.node.text }}
                    placeholder={mode === "image" ? "描述你想生成或修改的图片" : mode === "director" ? "描述剧本、广告、短片或创意目标，导演会自动搭建工作流" : "输入你想问的问题"}
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="canvas-composer-tools flex min-w-0 flex-1 items-center gap-1">
                        <CanvasPromptLibrary onSelect={onPromptChange} />
                        <Tooltip title="添加客户素材">
                            <Button type="text" loading={attaching} className="canvas-composer-icon !h-8 !min-w-8 !rounded-full !px-2" icon={<Paperclip className="size-4" />} onClick={() => fileInputRef.current?.click()} />
                        </Tooltip>
                        <Select
                            size="small"
                            value={attachRole}
                            className="canvas-reference-role-select min-w-[92px]"
                            popupMatchSelectWidth={140}
                            options={DIRECTOR_REFERENCE_ROLE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                            onChange={setAttachRole}
                        />
                        <AssistantModeSwitch mode={mode} theme={theme} onChange={onModeChange} />
                        {mode === "image" ? (
                            <>
                                <ModelPicker className="h-8 shrink-0" config={config} value={config.imageModel || config.model} onChange={(model) => onConfigChange("imageModel", model)} capability="image" onMissingConfig={onMissingConfig} />
                                <CanvasImageSettingsPopover config={config} placement="topRight" getPopupContainer={() => document.body} buttonClassName="canvas-composer-settings canvas-composer-icon !h-8 !min-w-8 !rounded-full !px-2" onConfigChange={onConfigChange} onMissingConfig={onMissingConfig} />
                            </>
                        ) : (
                            <ModelPicker className="h-8 shrink-0" config={config} value={config.textModel || config.model} onChange={(model) => onConfigChange("textModel", model)} capability="text" onMissingConfig={onMissingConfig} />
                        )}
                    </div>
                    <Button
                        type="primary"
                        className="!h-10 !min-w-16 shrink-0 !rounded-full !px-3"
                        disabled={!prompt.trim()}
                        onClick={() => void onSubmit()}
                        aria-label="发送"
                        title={isRunning ? "已有任务在后台运行，可以继续发布新任务" : "发送"}
                    >
                        <span className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums">
                                <CreditSymbol />
                                {credits.toLocaleString()}
                            </span>
                            <ArrowUp className="size-4" />
                        </span>
                    </Button>
                </div>
            </div>
        </div>
    );
}

function AssistantModeSwitch({ mode, theme, onChange }: { mode: AssistantMode; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; onChange: (mode: AssistantMode) => void }) {
    return (
        <div className="canvas-composer-mode-switch flex h-8 shrink-0 items-center rounded-full p-0.5" style={{ background: theme.node.fill }}>
            {[
                { value: "ask" as const, title: "对话", icon: <MessageSquare className="size-4" /> },
                { value: "image" as const, title: "生图", icon: <ImageIcon className="size-4" /> },
                { value: "director" as const, title: "导演", icon: <Workflow className="size-4" /> },
            ].map((item) => (
                <Tooltip key={item.value} title={item.title}>
                    <button
                        type="button"
                        className="canvas-composer-mode-button flex h-7 cursor-pointer items-center justify-center gap-1 rounded-full border-0 bg-transparent transition"
                        style={{ background: mode === item.value ? theme.node.activeStroke : "transparent", color: mode === item.value ? theme.node.panel : theme.node.text }}
                        onClick={() => onChange(item.value)}
                        aria-label={item.title}
                    >
                        {item.icon}
                        <span>{item.title}</span>
                    </button>
                </Tooltip>
            ))}
        </div>
    );
}

function PanelModeSwitch({ value, theme, onChange }: { value: CanvasControlPanelMode; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; onChange: (mode: CanvasControlPanelMode) => void }) {
    return (
        <div className="flex h-8 shrink-0 items-center rounded-full p-0.5" style={{ background: theme.node.fill }}>
            {[
                { value: "director" as const, label: "导演台" },
                { value: "local-agent" as const, label: "本地 Agent" },
            ].map((item) => (
                <button
                    key={item.value}
                    type="button"
                    className="h-7 cursor-pointer rounded-full border-0 bg-transparent px-2.5 text-xs transition"
                    style={{ background: value === item.value ? theme.node.activeStroke : "transparent", color: value === item.value ? theme.node.panel : theme.node.text }}
                    onClick={() => onChange(item.value)}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}

function DirectorSharedContextSummary({
    theme,
    summary,
}: {
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    summary: { nodes: number; references: number; assets: number; queue: number; ready: number; running: number };
}) {
    const items = [
        { label: "节点", value: summary.nodes },
        { label: "参考", value: summary.references },
        { label: "素材", value: summary.assets },
        { label: "队列", value: summary.queue },
    ];
    return (
        <div className="border-b px-4 py-2.5" style={{ borderColor: theme.node.stroke, background: theme.node.fill }}>
            <div className="flex flex-wrap items-center gap-1.5">
                {items.map((item) => (
                    <span key={item.label} className="rounded-full border px-2 py-0.5 text-[11px] leading-4" style={{ borderColor: theme.node.stroke, color: theme.node.text }}>
                        {item.label} {item.value}
                    </span>
                ))}
                {summary.running ? <span className="rounded-full border px-2 py-0.5 text-[11px] leading-4" style={{ borderColor: "rgba(217,119,6,.45)", color: "#d97706" }}>运行中 {summary.running}</span> : null}
            </div>
            <div className="mt-1 text-[11px] leading-4" style={{ color: theme.node.muted }}>
                导演台负责故事板、一致性和任务依赖；本地 Agent 读取同一份上下文执行画布操作。
            </div>
        </div>
    );
}

function SettingTitle({ children, color }: { children: string; color: string }) {
    return (
        <div className="text-xs font-medium" style={{ color }}>
            {children}
        </div>
    );
}

function qualityLabel(value: string) {
    return ({ auto: "自动", high: "高", medium: "中", low: "低" } as Record<string, string>)[value] || value;
}

function AssistantMessages({
    messages,
    onRetry,
    onInsertImage,
    onInsertText,
    onExecuteDirectorWorkflow,
    onHandoffDirectorWorkflowToAgent,
}: {
    messages: CanvasAssistantMessage[];
    onRetry: (message: CanvasAssistantMessage) => void;
    onInsertImage: (image: CanvasAssistantImage) => void;
    onInsertText: (text: string) => void;
    onExecuteDirectorWorkflow: (message: CanvasAssistantMessage) => void;
    onHandoffDirectorWorkflowToAgent: (message: CanvasAssistantMessage) => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    return (
        <>
            {messages.map((message) => (
                <div key={message.id} className={cn("flex flex-col gap-2", message.role === "user" ? "items-end" : "items-start")}>
                    <div
                        className="max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6"
                        style={message.role === "user" ? { background: theme.toolbar.activeBg, color: theme.toolbar.activeText } : { background: theme.node.fill, color: theme.node.text }}
                    >
                        {message.role === "assistant" ? (
                            <div className="mb-1 flex items-center gap-1.5 text-xs opacity-60">
                                {message.mode === "director" ? <Workflow className="size-3.5" /> : <MessageSquare className="size-3.5" />}
                                {message.mode === "director" ? "导演工作流" : "回答"}
                            </div>
                        ) : null}
                        {message.text}
                    </div>
                    {message.references?.length ? <MessageReferences message={message} /> : null}
                    {message.isLoading ? <ImageGenerationPending compact label={message.mode === "image" ? "正在生成图片" : message.mode === "director" ? "正在推演工作流" : "正在回答"} className="w-[250px] rounded-2xl border" /> : null}
                    {message.role === "assistant" && !message.isLoading ? (
                        <div className="flex flex-wrap gap-1">
                            <Button shape="circle" size="small" style={{ borderColor: theme.node.stroke }} icon={<RotateCcw className="size-3.5" />} onClick={() => onRetry(message)} title="重试" />
                            {!message.images?.length ? <Button shape="circle" size="small" style={{ borderColor: theme.node.stroke }} icon={<Plus className="size-3.5" />} onClick={() => onInsertText(message.text)} title="插入画布" /> : null}
                            {message.directorWorkflow ? (
                                <>
                                    <Button size="small" className="!rounded-full" style={{ borderColor: theme.node.activeStroke, color: theme.node.text }} icon={<Bot className="size-3.5" />} disabled={message.isExecuting} onClick={() => onHandoffDirectorWorkflowToAgent(message)}>
                                        交给 Agent
                                    </Button>
                                    <Button size="small" className="!rounded-full" style={{ borderColor: theme.node.activeStroke, color: theme.node.text }} icon={message.isExecuting ? <LoaderCircle className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} disabled={message.isExecuting} onClick={() => onExecuteDirectorWorkflow(message)}>
                                        {message.isExecuting ? "执行中" : "执行工作流"}
                                    </Button>
                                </>
                            ) : null}
                        </div>
                    ) : null}
                    {message.images?.map((image) => (
                        <div key={image.id} className="w-[250px] overflow-hidden rounded-2xl border" style={{ background: theme.node.panel, borderColor: theme.node.stroke }}>
                            <img src={image.dataUrl} alt="" className="aspect-square w-full object-cover" />
                            <Button
                                type="text"
                                className="!h-8 !w-full !rounded-none"
                                style={{ borderTop: `1px solid ${theme.node.stroke}`, color: theme.node.text }}
                                icon={<Plus className="size-3.5" />}
                                onClick={() => onInsertImage(image)}
                                title="插入画布"
                            />
                        </div>
                    ))}
                </div>
            ))}
        </>
    );
}

function AssistantHistory({
    sessions,
    activeSession,
    checkedIds,
    onToggleChecked,
    onOpen,
    onDelete,
}: {
    sessions: CanvasAssistantSession[];
    activeSession: CanvasAssistantSession | null;
    checkedIds: string[];
    onToggleChecked: (id: string, checked: boolean) => void;
    onOpen: (id: string) => void;
    onDelete: (id: string) => void;
}) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    return (
        <div className="space-y-1">
            {sessions.map((session) => (
                <div key={session.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-black/5 dark:hover:bg-white/10" style={session.id === activeSession?.id ? { background: theme.node.fill } : undefined}>
                    <input type="checkbox" className="size-4 accent-stone-950" checked={checkedIds.includes(session.id)} onChange={(event) => onToggleChecked(session.id, event.target.checked)} />
                    <button type="button" className="min-w-0 flex-1 text-left text-sm" onClick={() => onOpen(session.id)}>
                        <span className="block truncate">{session.title}</span>
                        <span className="text-xs opacity-50">{session.messages.length} 条消息</span>
                    </button>
                    <Button type="text" shape="circle" size="small" className="opacity-0 transition group-hover:opacity-100" icon={<Trash2 className="size-3.5" />} onClick={() => onDelete(session.id)} title="删除" />
                </div>
            ))}
        </div>
    );
}

function MessageReferences({ message }: { message: CanvasAssistantMessage }) {
    return (
        <div className={cn("flex max-w-[88%] flex-wrap gap-2", message.role === "user" ? "justify-end" : "justify-start")}>
            {message.references?.map((item, index, references) => (
                <AssistantReferenceChip key={item.id} item={item} label={assistantImageReferenceLabel(references, index)} />
            ))}
        </div>
    );
}

function AssistantReferenceChip({ item, label, onRemove }: { item: CanvasAssistantReference; label?: string; onRemove?: () => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const text = (item.text || item.title).replace(/\s+/g, " ").trim().slice(0, 1) || "文";
    return (
        <div className="group/chip relative inline-flex h-8 max-w-[150px] shrink-0 items-center gap-1.5 rounded-lg text-sm" style={{ color: theme.node.text }}>
            {item.dataUrl ? (
                <span className="relative block size-8 shrink-0">
                    <img src={item.dataUrl} alt="" className="size-8 rounded-lg object-cover" />
                    {label ? <span className="absolute left-0.5 top-0.5 rounded bg-black/60 px-1 py-0.5 text-[8px] font-medium leading-none text-white">{label}</span> : null}
                </span>
            ) : (
                <span className="grid size-8 place-items-center rounded-lg border text-sm font-medium" style={{ background: theme.node.panel, borderColor: theme.node.activeStroke }}>
                    {text}
                </span>
            )}
            {onRemove ? (
                <button
                    type="button"
                    className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full border opacity-0 shadow-sm transition group-hover/chip:opacity-100"
                    style={{ background: theme.toolbar.panel, borderColor: theme.node.stroke }}
                    onClick={onRemove}
                    aria-label="移除引用"
                >
                    <X className="size-3" />
                </button>
            ) : null}
        </div>
    );
}

function DirectorReferencePackChip({
    item,
    theme,
    onRoleChange,
    onRemove,
}: {
    item: DirectorReferencePackItem;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    onRoleChange: (role: DirectorReferenceRole) => void;
    onRemove: () => void;
}) {
    const Icon = item.mediaType === "video" ? Film : item.mediaType === "audio" ? Mic2 : ImageIcon;
    return (
        <div className="flex min-h-9 items-center gap-2 rounded-lg border px-2 py-1" style={{ borderColor: theme.node.stroke, background: theme.node.panel, color: theme.node.text }}>
            {item.dataUrl ? <img src={item.dataUrl} alt="" className="size-7 shrink-0 rounded-md object-cover" /> : item.url && item.mediaType === "video" ? <video src={item.url} className="size-7 shrink-0 rounded-md bg-black object-cover" muted preload="metadata" /> : <Icon className="size-4 shrink-0 opacity-80" />}
            <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{item.title}</div>
                <div className="truncate text-[10px] opacity-60">{item.mediaType === "image" ? "图片" : item.mediaType === "video" ? "视频" : item.mediaType === "audio" ? "音频" : "文本"}</div>
            </div>
            <Select
                size="small"
                value={item.role}
                className="canvas-reference-role-select w-[94px] shrink-0"
                popupMatchSelectWidth={140}
                options={DIRECTOR_REFERENCE_ROLE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                onChange={onRoleChange}
            />
            <button type="button" className="grid size-6 shrink-0 place-items-center rounded-full border" style={{ borderColor: theme.node.stroke, background: theme.toolbar.panel }} onClick={onRemove} aria-label="移除客户素材">
                <X className="size-3" />
            </button>
        </div>
    );
}

function assistantImageReferenceLabel(references: CanvasAssistantReference[], index: number) {
    if (!references[index]?.dataUrl) return undefined;
    const imageIndex = references.slice(0, index + 1).filter((item) => item.dataUrl).length - 1;
    return imageIndex >= 0 ? imageReferenceLabel(imageIndex) : undefined;
}

function nodeToReference(node: CanvasNodeData): CanvasAssistantReference | null {
    if (node.type === CanvasNodeType.Image && node.metadata?.content) {
        return { id: node.id, type: node.type, title: node.title, dataUrl: node.metadata.content, storageKey: node.metadata.storageKey };
    }
    if (node.type === CanvasNodeType.Text && node.metadata?.content) {
        return { id: node.id, type: node.type, title: node.title, text: node.metadata.content };
    }
    return null;
}

function buildAssistantReferences(nodes: CanvasNodeData[], selectedNodeIds: Set<string>) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    return Array.from(selectedNodeIds)
        .map((id) => nodeById.get(id))
        .filter((node): node is CanvasNodeData => Boolean(node))
        .map(nodeToReference)
        .filter((item): item is CanvasAssistantReference => Boolean(item));
}

function buildSelectedReferencePack(nodes: CanvasNodeData[], selectedNodeIds: Set<string>, removedReferenceIds: Set<string>) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    return Array.from(selectedNodeIds)
        .filter((id) => !removedReferenceIds.has(id))
        .map((id) => nodeById.get(id))
        .filter((node): node is CanvasNodeData => Boolean(node))
        .map(createDirectorReferencePackItemFromNode)
        .filter((item): item is DirectorReferencePackItem => Boolean(item));
}

function mergeReferencePackItems(items: DirectorReferencePackItem[]) {
    const byNodeId = new Map<string, DirectorReferencePackItem>();
    items.forEach((item) => byNodeId.set(item.nodeId, item));
    return Array.from(byNodeId.values());
}

function packsEqual(first: DirectorReferencePackItem[], second: DirectorReferencePackItem[]) {
    if (first.length !== second.length) return false;
    return first.every((item, index) => {
        const other = second[index];
        return Boolean(other && item.id === other.id && item.nodeId === other.nodeId && item.role === other.role);
    });
}

function referenceToDirectorReference(reference: CanvasAssistantReference): DirectorWorkflowReference {
    return {
        id: reference.id,
        type: reference.type,
        title: reference.title,
        text: reference.text,
    };
}

function findLastDirectorWorkflow(messages: CanvasAssistantMessage[]) {
    return [...messages].reverse().find((message) => message.directorWorkflow)?.directorWorkflow;
}

async function buildChatMessages(messages: CanvasAssistantMessage[]): Promise<ChatCompletionMessage[]> {
    return Promise.all(
        messages.map(async (message, index) => {
            if (message.role === "assistant") return { role: "assistant", content: message.text };
            if (index !== messages.length - 1) return { role: "user", content: message.text };
            const refs = message.references || [];
            return {
                role: "user",
                content: [
                    ...refs.flatMap((item) => (item.text ? [{ type: "text" as const, text: item.text }] : [])),
                    { type: "text", text: message.text },
                    ...(await Promise.all(refs.filter((item) => item.dataUrl).map(async (item) => ({ type: "image_url" as const, image_url: { url: await imageToDataUrl(item) } })))),
                ],
            };
        }),
    );
}

async function buildDirectorPlannerMessages(input: { prompt: string; references: DirectorWorkflowReference[]; referencePack: DirectorReferencePackItem[]; previousWorkflow?: DirectorWorkflow }): Promise<ChatCompletionMessage[]> {
    const promptText = buildDirectorPlannerPrompt(input);
    const imageItems = await Promise.all(
        input.referencePack
            .filter((item) => item.mediaType === "image" && item.dataUrl)
            .map(async (item) => ({
                type: "image_url" as const,
                image_url: { url: await imageToDataUrl({ dataUrl: item.dataUrl, storageKey: item.storageKey }) },
            })),
    );
    return [
        {
            role: "user",
            content: imageItems.length ? [{ type: "text" as const, text: promptText }, ...imageItems] : promptText,
        },
    ];
}

function createSession(): CanvasAssistantSession {
    const now = new Date().toISOString();
    return { id: nanoid(), title: "新对话", messages: [], createdAt: now, updatedAt: now };
}
