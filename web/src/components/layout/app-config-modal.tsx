"use client";

import { App, Button, Form, Input, Modal, Progress, Segmented, Select } from "antd";
import { CheckCircle2, Cloud, RefreshCw, Wifi, XCircle } from "lucide-react";
import { useState } from "react";

import { ModelPicker } from "@/components/model-picker";
import { fetchImageModels } from "@/services/api/image";
import { syncAppDataToWebdav, type AppSyncDomainKey, type AppSyncProgressEvent } from "@/services/app-sync";
import { testWebdavConnection, WEBDAV_MANIFEST_FILE_NAME } from "@/services/webdav-sync";
import { audioFormatOptions, audioVoiceOptions, normalizeAudioSpeedValue } from "@/lib/audio-generation";
import { filterModelsByCapability, useConfigStore, useEffectiveConfig, type AiConfig, type ModelCapability } from "@/stores/use-config-store";

type ModelGroup = {
    capability: ModelCapability;
    modelKey: "imageModel" | "videoModel" | "textModel" | "audioModel";
    modelsKey: "imageModels" | "videoModels" | "textModels" | "audioModels";
    baseUrlKey: "imageBaseUrl" | "videoBaseUrl" | "textBaseUrl" | "audioBaseUrl";
    apiKeyKey: "imageApiKey" | "videoApiKey" | "textApiKey" | "audioApiKey";
    connectionLabel: string;
    defaultLabel: string;
    optionsLabel: string;
};

type WebdavDomainProgress = {
    label: string;
    stage: string;
    current?: number;
    total?: number;
    status?: "active" | "success" | "exception";
};

type ModelFetchState = {
    loading: boolean;
    message: string;
    status?: "success" | "error";
};

const modelGroups: ModelGroup[] = [
    { capability: "image", modelKey: "imageModel", modelsKey: "imageModels", baseUrlKey: "imageBaseUrl", apiKeyKey: "imageApiKey", connectionLabel: "图像", defaultLabel: "默认生图模型", optionsLabel: "生图模型可选项" },
    { capability: "video", modelKey: "videoModel", modelsKey: "videoModels", baseUrlKey: "videoBaseUrl", apiKeyKey: "videoApiKey", connectionLabel: "视频", defaultLabel: "默认视频模型", optionsLabel: "视频模型可选项" },
    { capability: "text", modelKey: "textModel", modelsKey: "textModels", baseUrlKey: "textBaseUrl", apiKeyKey: "textApiKey", connectionLabel: "文本", defaultLabel: "默认文本模型", optionsLabel: "文本模型可选项" },
    { capability: "audio", modelKey: "audioModel", modelsKey: "audioModels", baseUrlKey: "audioBaseUrl", apiKeyKey: "audioApiKey", connectionLabel: "音频", defaultLabel: "默认音频模型", optionsLabel: "音频模型可选项" },
];

const webdavDomainKeys: AppSyncDomainKey[] = ["canvas", "assets", "image-workbench", "video-workbench"];
const webdavDomainLabels: Record<AppSyncDomainKey, string> = {
    canvas: "画布",
    assets: "我的素材",
    "image-workbench": "生图工作台",
    "video-workbench": "视频创作台",
};

function createWebdavDomainProgress(): Record<AppSyncDomainKey, WebdavDomainProgress> {
    return webdavDomainKeys.reduce(
        (progress, key) => ({
            ...progress,
            [key]: { label: webdavDomainLabels[key], stage: "等待同步" },
        }),
        {} as Record<AppSyncDomainKey, WebdavDomainProgress>,
    );
}

export function AppConfigModal() {
    const { message } = App.useApp();
    const [loadingModels, setLoadingModels] = useState(false);
    const [modelFetchState, setModelFetchState] = useState<Record<ModelCapability, ModelFetchState>>({
        image: { loading: false, message: "" },
        video: { loading: false, message: "" },
        text: { loading: false, message: "" },
        audio: { loading: false, message: "" },
    });
    const [testingWebdav, setTestingWebdav] = useState(false);
    const [syncingWebdav, setSyncingWebdav] = useState(false);
    const [webdavSyncStatus, setWebdavSyncStatus] = useState("");
    const [webdavDomainProgress, setWebdavDomainProgress] = useState(createWebdavDomainProgress);
    const config = useConfigStore((state) => state.config);
    const webdav = useConfigStore((state) => state.webdav);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const updateWebdavConfig = useConfigStore((state) => state.updateWebdavConfig);
    const isConfigOpen = useConfigStore((state) => state.isConfigOpen);
    const shouldPromptContinue = useConfigStore((state) => state.shouldPromptContinue);
    const setConfigDialogOpen = useConfigStore((state) => state.setConfigDialogOpen);
    const clearPromptContinue = useConfigStore((state) => state.clearPromptContinue);
    const publicSettings = useConfigStore((state) => state.publicSettings);
    const effectiveConfig = useEffectiveConfig();
    const modelChannel = publicSettings?.modelChannel;
    const allowCustomChannel = modelChannel?.allowCustomChannel === true;
    const effectiveMode = allowCustomChannel ? config.channelMode : "remote";
    const modelConfig = effectiveMode === "remote" ? effectiveConfig : config;
    const webdavReady = Boolean(webdav.url.trim());

    const finishConfig = () => {
        if (!allowCustomChannel && config.channelMode !== "remote") updateConfig("channelMode", "remote");
        setConfigDialogOpen(false);
        message.success(shouldPromptContinue ? "配置已保存，请继续刚才的请求" : "配置已保存");
        clearPromptContinue();
    };

    const refreshModels = async () => {
        if (effectiveMode === "remote") return;
        if (!config.baseUrl.trim() || !config.apiKey.trim()) {
            message.error("请先填写 Base URL 和 API Key");
            return;
        }
        setLoadingModels(true);
        try {
            const models = await fetchImageModels(config);
            const imageModels = filterModelsByCapability(models, "image");
            const videoModels = filterModelsByCapability(models, "video");
            const textModels = filterModelsByCapability(models, "text");
            const audioModels = filterModelsByCapability(models, "audio");
            const nextImageModels = resolveNextCapabilityModels(config.imageModels, imageModels, models);
            const nextVideoModels = resolveNextCapabilityModels(config.videoModels, videoModels, models);
            const nextTextModels = resolveNextCapabilityModels(config.textModels, textModels, models);
            const nextAudioModels = resolveNextCapabilityModels(config.audioModels, audioModels, models);
            updateConfig("models", models);
            updateConfig("imageModels", nextImageModels);
            updateConfig("videoModels", nextVideoModels);
            updateConfig("textModels", nextTextModels);
            updateConfig("audioModels", nextAudioModels);
            if (nextImageModels.length && !nextImageModels.includes(config.imageModel)) updateConfig("imageModel", nextImageModels[0]);
            if (nextVideoModels.length && !nextVideoModels.includes(config.videoModel)) updateConfig("videoModel", nextVideoModels[0]);
            if (nextTextModels.length && !nextTextModels.includes(config.textModel)) updateConfig("textModel", nextTextModels[0]);
            if (nextAudioModels.length && !nextAudioModels.includes(config.audioModel)) updateConfig("audioModel", nextAudioModels[0]);
            message.success("模型列表已更新");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取模型失败");
        } finally {
            setLoadingModels(false);
        }
    };

    const refreshCapabilityModels = async (group: ModelGroup, options?: { silent?: boolean }) => {
        if (effectiveMode === "remote") return [] as string[];
        setModelFetchState((current) => ({ ...current, [group.capability]: { loading: true, message: "正在拉取模型..." } }));
        try {
            const models = await fetchImageModels(config, group.capability);
            const latestConfig = useConfigStore.getState().config;
            const nextGlobalModels = uniqueModels([...latestConfig.models, ...models]);
            const nextModels = uniqueModels([...latestConfig[group.modelsKey], ...models]);
            updateConfig("models", nextGlobalModels);
            updateConfig(group.modelsKey, nextModels);
            if (nextModels.length && !nextModels.includes(latestConfig[group.modelKey])) updateConfig(group.modelKey, nextModels[0]);
            setModelFetchState((current) => ({
                ...current,
                [group.capability]: { loading: false, status: "success", message: `已拉取 ${models.length} 个模型，已归入 ${nextModels.length} 个可选模型` },
            }));
            if (!options?.silent) message.success(`${group.connectionLabel}模型已更新`);
            return models;
        } catch (error) {
            const text = error instanceof Error ? error.message : "读取模型失败";
            setModelFetchState((current) => ({ ...current, [group.capability]: { loading: false, status: "error", message: text } }));
            if (!options?.silent) message.error(`${group.connectionLabel}模型拉取失败：${text}`);
            return [] as string[];
        }
    };

    const refreshAllCapabilityModels = async () => {
        if (effectiveMode === "remote") return;
        setLoadingModels(true);
        try {
            const results = await Promise.all(modelGroups.map((group) => refreshCapabilityModels(group, { silent: true })));
            const successCount = results.filter((models) => models.length).length;
            if (successCount) {
                message.success(`已完成 ${successCount}/${modelGroups.length} 类模型拉取`);
            } else {
                message.error("没有成功拉取到模型，请检查各类型 Base URL 和 API Key");
            }
        } finally {
            setLoadingModels(false);
        }
    };

    const updateCapabilityModels = (group: ModelGroup, models: string[]) => {
        const next = uniqueModels(models);
        updateConfig(group.modelsKey, next);
        if (!next.includes(config[group.modelKey])) updateConfig(group.modelKey, next[0] || "");
    };

    const testWebdav = async () => {
        if (!webdavReady) {
            message.error("请先填写 WebDAV 地址");
            return;
        }
        setTestingWebdav(true);
        try {
            await testWebdavConnection(webdav);
            message.success("WebDAV 连接可用");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "WebDAV 连接测试失败");
        } finally {
            setTestingWebdav(false);
        }
    };

    const updateWebdavProgress = (event: AppSyncProgressEvent) => {
        setWebdavSyncStatus(event.stage);
        if (!event.domain) return;
        setWebdavDomainProgress((current) => ({
            ...current,
            [event.domain as AppSyncDomainKey]: {
                label: event.label || webdavDomainLabels[event.domain as AppSyncDomainKey],
                stage: event.stage,
                current: event.current,
                total: event.total,
                status: event.status,
            },
        }));
    };

    const syncWebdav = async () => {
        if (!webdavReady) {
            message.error("请先填写 WebDAV 地址");
            return;
        }
        setSyncingWebdav(true);
        setWebdavDomainProgress(createWebdavDomainProgress());
        setWebdavSyncStatus("准备同步");
        try {
            const result = await syncAppDataToWebdav(webdav, updateWebdavProgress);
            updateWebdavConfig("lastSyncedAt", result.syncedAt);
            message.success(`同步完成：${result.projects} 个画布，${result.assets} 个素材，${result.imageLogs + result.videoLogs} 条记录，本次上传 ${result.uploadedFiles} 个文件 ${formatBytes(result.uploadedBytes)}`);
        } catch (error) {
            setWebdavSyncStatus(error instanceof Error ? error.message : "WebDAV 同步失败");
            message.error(error instanceof Error ? error.message : "WebDAV 同步失败");
        } finally {
            setSyncingWebdav(false);
        }
    };

    return (
        <Modal
            className="sacred-config-modal"
            title={
                <div className="min-w-0">
                    <div className="sacred-label">USER CONFIGURATION</div>
                    <div className="sacred-title mt-1 text-xl font-semibold">配置与用户偏好</div>
                    <div className="sacred-muted mt-1 text-xs font-normal">模型、渠道和画布默认行为</div>
                </div>
            }
            open={isConfigOpen}
            width={960}
            centered
            onCancel={() => setConfigDialogOpen(false)}
            styles={{ body: { maxHeight: "72vh", overflowY: "auto", paddingRight: 18 } }}
            footer={
                <div className="sacred-config-actions">
                    <Button type="primary" autoInsertSpace={false} onClick={finishConfig}>
                        完成
                    </Button>
                </div>
            }
        >
            <div className="sacred-config-body pt-1">
                <Form layout="vertical" requiredMark={false}>
                    {allowCustomChannel ? (
                        <Form.Item label="渠道模式" className="mb-5">
                            <Segmented
                                block
                                size="middle"
                                value={effectiveMode}
                                onChange={(value) => updateConfig("channelMode", value as AiConfig["channelMode"])}
                                options={[
                                    { label: "本地直连", value: "local" },
                                    { label: "云端渠道", value: "remote" },
                                ]}
                            />
                        </Form.Item>
                    ) : null}
                    {effectiveMode === "local" ? (
                        <>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Form.Item label="通用 Base URL（兜底，可留空）" extra="图像、视频、文本或音频专属配置留空时，会沿用这里。" className="mb-4">
                                    <Input value={config.baseUrl} placeholder="https://api.openai.com" onChange={(event) => updateConfig("baseUrl", event.target.value)} />
                                </Form.Item>
                                <Form.Item label="通用 API Key（兜底，可留空）" extra="可先留空，真正发起请求时再按所用类型检查。" className="mb-4">
                                    <Input.Password value={config.apiKey} placeholder="sk-..." onChange={(event) => updateConfig("apiKey", event.target.value)} />
                                </Form.Item>
                            </div>
                            <section className="sacred-config-section mb-5">
                                <div className="mb-3">
                                    <div className="sacred-config-section-title">按类型单独配置</div>
                                    <div className="sacred-muted mt-1 text-xs">图像、视频、文本、音频都可单独填写 Base URL 和 API Key；留空时自动沿用通用兜底。</div>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    {modelGroups.map((group) => {
                                        const fetchState = modelFetchState[group.capability];
                                        return (
                                            <div key={group.capability} className="sacred-config-type-card">
                                                <div className="mb-3 flex items-center justify-between gap-3">
                                                    <div>
                                                        <div className="text-sm font-semibold">{group.connectionLabel}</div>
                                                        <div className="sacred-muted mt-0.5 text-xs">已保存 {config[group.modelsKey].length} 个模型</div>
                                                    </div>
                                                    <Button size="small" loading={fetchState.loading} onClick={() => void refreshCapabilityModels(group)}>
                                                        拉取模型
                                                    </Button>
                                                </div>
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    <Form.Item label={`${group.connectionLabel} Base URL`} className="mb-0">
                                                        <Input value={config[group.baseUrlKey]} placeholder="留空沿用通用 Base URL" onChange={(event) => updateConfig(group.baseUrlKey, event.target.value)} />
                                                    </Form.Item>
                                                    <Form.Item label={`${group.connectionLabel} API Key`} className="mb-0">
                                                        <Input.Password value={config[group.apiKeyKey]} placeholder="留空沿用通用 API Key" onChange={(event) => updateConfig(group.apiKeyKey, event.target.value)} />
                                                    </Form.Item>
                                                </div>
                                                {fetchState.message ? (
                                                    <div className={`sacred-model-fetch-state mt-3 ${fetchState.status === "error" ? "is-error" : fetchState.status === "success" ? "is-success" : ""}`}>
                                                        {fetchState.status === "error" ? <XCircle className="size-3.5" /> : fetchState.status === "success" ? <CheckCircle2 className="size-3.5" /> : <RefreshCw className="size-3.5 animate-spin" />}
                                                        <span>{fetchState.message}</span>
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                            <div className="sacred-config-inline-panel mb-5">
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold">拉取所有可使用模型</div>
                                    <div className="sacred-muted mt-1 text-xs">会分别使用图像、视频、文本、音频自己的 Base URL 和 API Key；成功后进入对应下拉。</div>
                                </div>
                                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                                    <Button size="small" loading={loadingModels} onClick={() => void refreshAllCapabilityModels()}>
                                        拉取全部类型模型
                                    </Button>
                                    <Button size="small" loading={loadingModels} onClick={() => void refreshModels()}>
                                        只拉取通用模型
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="sacred-config-section mb-5 text-sm">
                            <div className="font-semibold">云端渠道</div>
                            <div className="mt-1">由系统后台渠道转发请求，当前可用 {modelChannel?.availableModels.length || 0} 个模型。</div>
                        </div>
                    )}
                    {effectiveMode === "local" ? (
                        <section className="sacred-config-section mb-5">
                            <div className="mb-3">
                                <div className="sacred-config-section-title">本地模型可选项</div>
                                <div className="sacred-muted mt-1 text-xs">每类下拉使用该类型已拉取的模型池；如分类不准，可在这里手动增删。</div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                {modelGroups.map((group) => {
                                    const options = uniqueModels([...config[group.modelsKey], ...filterModelsByCapability(config.models, group.capability)]).map((model) => ({ label: model, value: model }));
                                    return (
                                        <Form.Item key={group.modelsKey} label={`${group.optionsLabel}（${config[group.modelsKey].length}）`} className="mb-0">
                                            <Select
                                                mode="multiple"
                                                showSearch
                                                allowClear
                                                maxTagCount="responsive"
                                                placeholder={options.length ? `请选择${group.optionsLabel}` : `请先拉取${group.connectionLabel}模型`}
                                                value={config[group.modelsKey]}
                                                options={options}
                                                onChange={(models) => updateCapabilityModels(group, models)}
                                            />
                                        </Form.Item>
                                    );
                                })}
                            </div>
                        </section>
                    ) : null}
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {modelGroups.map((group) => (
                            <Form.Item key={group.modelKey} label={group.defaultLabel} className="mb-4">
                                <ModelPicker config={modelConfig} value={modelConfig[group.modelKey]} onChange={(model) => updateConfig(group.modelKey, model)} capability={group.capability} fullWidth />
                            </Form.Item>
                        ))}
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                        <Form.Item label="画布默认生图张数" extra="新建画布生图和配置节点默认使用，单个节点仍可单独覆盖。" className="mb-4">
                            <Input
                                type="number"
                                min={1}
                                max={15}
                                value={config.canvasImageCount}
                                onChange={(event) => updateConfig("canvasImageCount", event.target.value)}
                                onBlur={(event) => updateConfig("canvasImageCount", normalizeImageCount(event.target.value))}
                            />
                        </Form.Item>
                        <Form.Item label="默认音频声音" className="mb-4">
                            <Select value={config.audioVoice} options={audioVoiceOptions} onChange={(value) => updateConfig("audioVoice", value)} />
                        </Form.Item>
                        <Form.Item label="默认音频格式" className="mb-4">
                            <Select value={config.audioFormat} options={audioFormatOptions} onChange={(value) => updateConfig("audioFormat", value)} />
                        </Form.Item>
                        <Form.Item label="默认音频语速" className="mb-4">
                            <Input
                                type="number"
                                min={0.25}
                                max={4}
                                step={0.05}
                                value={config.audioSpeed}
                                onChange={(event) => updateConfig("audioSpeed", event.target.value)}
                                onBlur={(event) => updateConfig("audioSpeed", normalizeAudioSpeedValue(event.target.value))}
                            />
                        </Form.Item>
                    </div>
                    <Form.Item label="默认音频指令" className="mb-4">
                        <Input.TextArea rows={2} value={config.audioInstructions} placeholder="例如：自然、温暖、适合旁白。" onChange={(event) => updateConfig("audioInstructions", event.target.value)} />
                    </Form.Item>
                    {effectiveMode === "local" ? (
                        <Form.Item label="系统提示词" className="mb-0">
                            <Input.TextArea rows={3} value={config.systemPrompt} placeholder="例如：你是一位擅长电影感写实摄影的视觉导演。" onChange={(event) => updateConfig("systemPrompt", event.target.value)} />
                        </Form.Item>
                    ) : null}
                    <section className="sacred-config-section mt-5">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <div className="sacred-config-section-title flex items-center gap-2">
                                    <Cloud className="size-4" />
                                    WebDAV 同步
                                </div>
                                <div className="sacred-muted mt-1 text-xs">同步画布、我的素材、生成记录和本地媒体文件，不包含 AI API Key；服务不支持 CORS 时可走 Next.js 转发。</div>
                            </div>
                            <div className="sacred-muted text-xs">{webdav.lastSyncedAt ? `上次同步 ${formatWebdavTime(webdav.lastSyncedAt)}` : "尚未同步"}</div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Form.Item label="连接方式" className="mb-4 md:col-span-2">
                                <Segmented
                                    block
                                    value={webdav.proxyMode}
                                    onChange={(value) => updateWebdavConfig("proxyMode", value as typeof webdav.proxyMode)}
                                    options={[
                                        { label: "前端直连", value: "direct" },
                                        { label: "Next.js 转发", value: "nextjs" },
                                    ]}
                                />
                            </Form.Item>
                            <Form.Item label="WebDAV 地址" className="mb-4">
                                <Input value={webdav.url} placeholder="https://nas.example.com/webdav" onChange={(event) => updateWebdavConfig("url", event.target.value)} />
                            </Form.Item>
                            <Form.Item label="远程目录" extra={`会在该目录下分业务目录保存，每个目录包含 ${WEBDAV_MANIFEST_FILE_NAME} 和 files/`} className="mb-4">
                                <Input value={webdav.directory} placeholder="infinite-canvas" onChange={(event) => updateWebdavConfig("directory", event.target.value)} />
                            </Form.Item>
                            <Form.Item label="用户名" className="mb-0">
                                <Input value={webdav.username} autoComplete="username" onChange={(event) => updateWebdavConfig("username", event.target.value)} />
                            </Form.Item>
                            <Form.Item label="密码 / 应用密码" className="mb-0">
                                <Input.Password value={webdav.password} autoComplete="current-password" onChange={(event) => updateWebdavConfig("password", event.target.value)} />
                            </Form.Item>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Button icon={<Wifi className="size-4" />} disabled={!webdavReady || syncingWebdav} loading={testingWebdav} onClick={() => void testWebdav()}>
                                测试连接
                            </Button>
                            <Button type="primary" icon={<RefreshCw className="size-4" />} disabled={!webdavReady || testingWebdav} loading={syncingWebdav} onClick={() => void syncWebdav()}>
                                {syncingWebdav ? "同步中" : "立即同步"}
                            </Button>
                            {webdavSyncStatus ? <span className="sacred-muted text-xs">{webdavSyncStatus}</span> : null}
                        </div>
                        {syncingWebdav || webdavSyncStatus ? (
                            <div className="mt-3 grid gap-2">
                                {webdavDomainKeys.map((key) => {
                                    const item = webdavDomainProgress[key];
                                    const count = item.total ? `${item.current || 0}/${item.total}` : "";
                                    return (
                                        <div key={key} className="sacred-config-progress-card">
                                            <div className="mb-1 flex min-w-0 items-center justify-between gap-3 text-xs">
                                                <span className="shrink-0 font-semibold">{item.label}</span>
                                                <span className="sacred-muted min-w-0 truncate text-right">
                                                    {item.stage}
                                                    {count ? ` · ${count}` : ""}
                                                </span>
                                            </div>
                                            <Progress percent={getWebdavProgressPercent(item)} size="small" status={getWebdavProgressStatus(item)} showInfo={false} />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : null}
                    </section>
                </Form>
            </div>
        </Modal>
    );
}

function normalizeImageCount(value: string) {
    return String(Math.max(1, Math.min(15, Math.floor(Math.abs(Number(value)) || 3))));
}

function resolveNextCapabilityModels(current: string[], suggested: string[], allModels: string[]) {
    const available = new Set(allModels);
    const kept = uniqueModels(current).filter((model) => available.has(model));
    return uniqueModels([...kept, ...suggested]);
}

function uniqueModels(models: string[]) {
    return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));
}

function formatWebdavTime(value: string) {
    return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function getWebdavProgressPercent(item: WebdavDomainProgress) {
    if (item.status === "success") return 100;
    if (item.total) return Math.min(100, Math.round(((item.current || 0) / item.total) * 100));
    if (item.status === "exception") return 100;
    if (item.stage === "等待同步") return 0;
    if (item.stage === "读取远端清单") return 12;
    if (item.stage === "读取本地数据") return 24;
    if (item.stage === "下载缺失媒体") return 36;
    if (item.stage === "写入本地合并结果") return 58;
    if (item.stage === "上传新增媒体") return 66;
    if (item.stage === "媒体已齐全" || item.stage === "媒体无需上传") return 74;
    if (item.stage.startsWith("上传清单")) return 90;
    return item.status === "active" ? 30 : 0;
}

function getWebdavProgressStatus(item: WebdavDomainProgress): "normal" | "active" | "success" | "exception" {
    if (item.status === "success" || item.status === "exception") return item.status;
    return item.status === "active" ? "active" : "normal";
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
