"use client";

import dynamic from "next/dynamic";
import { FolderPlus, Inbox, RefreshCw, Search } from "lucide-react";
import { type UIEvent, useDeferredValue, useEffect, useState } from "react";
import { App, Button, Input, Spin, Tag } from "antd";
import { useQueryClient } from "@tanstack/react-query";

import { PromptCard } from "@/components/prompts/prompt-card";
import type { PromptDetailDialogProps } from "@/components/prompts/prompt-detail-dialog";
import { usePromptList } from "@/components/prompts/use-prompt-list";
import { useCopyText } from "@/hooks/use-copy-text";
import { cn } from "@/lib/utils";
import { useAssetStore } from "@/stores/use-asset-store";
import { ALL_PROMPTS_OPTION, syncPromptsOnline, type Prompt } from "@/services/api/prompts";

const PROMPT_RENDER_BATCH_SIZE = 48;
const PromptDetailDialog = dynamic<PromptDetailDialogProps>(() => import("@/components/prompts/prompt-detail-dialog").then((mod) => mod.PromptDetailDialog), { ssr: false });

export default function PromptsPage() {
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    const [titleKeyword, setTitleKeyword] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState(ALL_PROMPTS_OPTION);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [syncingPrompts, setSyncingPrompts] = useState(false);
    const [visiblePromptCount, setVisiblePromptCount] = useState(PROMPT_RENDER_BATCH_SIZE);
    const deferredTitleKeyword = useDeferredValue(titleKeyword);
    const addAsset = useAssetStore((state) => state.addAsset);
    const copyText = useCopyText();
    const { query, items: promptItems, tags: promptTags, categories: promptCategoryOptions, total: totalPrompts } = usePromptList({ keyword: deferredTitleKeyword, tags: selectedTags, category: selectedCategory });
    const searchPending = titleKeyword !== deferredTitleKeyword;
    const visiblePromptItems = promptItems.slice(0, visiblePromptCount);
    const hasHiddenLoadedPrompts = visiblePromptCount < promptItems.length;

    useEffect(() => {
        if (query.isError) {
            message.error(query.error instanceof Error ? query.error.message : "获取提示词失败");
        }
    }, [message, query.error, query.isError]);

    useEffect(() => {
        setVisiblePromptCount(PROMPT_RENDER_BATCH_SIZE);
    }, [deferredTitleKeyword, selectedCategory, selectedTags]);

    const toggleTag = (tag: string) => {
        if (tag === ALL_PROMPTS_OPTION) return setSelectedTags([]);
        setSelectedTags((items) => (items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag]));
    };

    const savePromptAsset = (item: Prompt) => {
        addAsset({ kind: "text", title: item.title, coverUrl: item.coverUrl, tags: item.tags, source: item.category, data: { content: item.prompt }, metadata: { source: "prompt-library", promptId: item.id, githubUrl: item.githubUrl } });
        message.success("已加入我的素材");
    };

    const refreshPromptList = async () => {
        await query.refetch();
        message.success("提示词列表已刷新");
    };

    const syncRemotePrompts = async () => {
        setSyncingPrompts(true);
        try {
            const result = await syncPromptsOnline();
            await queryClient.invalidateQueries({ queryKey: ["prompts"] });
            await query.refetch();
            if (result.skipped) {
                message.info(result.message || "提示词库已是最新缓存");
            } else if (result.failedCategories > 0) {
                message.warning(result.message || `已更新 ${result.syncedCategories} 个提示词源，${result.failedCategories} 个源暂时失败`);
            } else {
                message.success(result.message || `已联网更新 ${result.syncedCategories} 个提示词源`);
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : "联网更新失败");
        } finally {
            setSyncingPrompts(false);
        }
    };

    const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
        const target = event.currentTarget;
        const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 220;
        if (!nearBottom) return;
        if (hasHiddenLoadedPrompts) {
            setVisiblePromptCount((count) => Math.min(count + PROMPT_RENDER_BATCH_SIZE, promptItems.length));
            return;
        }
        if (query.hasNextPage && !query.isFetchingNextPage && target.scrollTop + target.clientHeight >= target.scrollHeight - 160) {
            void query.fetchNextPage();
        }
    };

    return (
        <div className="sacred-page-shell sacred-prompts-page flex h-full flex-col overflow-hidden">
            <main
                className="sacred-page-content min-h-0 flex-1 overflow-y-auto px-6 py-8"
                onScroll={handleListScroll}
            >
                <div className="pb-8">
                    <div className="mx-auto max-w-5xl text-center">
                        <div className="sacred-label">prompt vault</div>
                        <h1 className="sacred-title mt-3 text-4xl font-semibold">提示词中心</h1>
                        <p className="sacred-prompt-summary mt-3 text-sm">共 {totalPrompts} 条提示词，按标题、标签与分类快速查找灵感。</p>
                        <div className="mt-5 flex flex-wrap justify-center gap-3">
                            <Button icon={<RefreshCw className="size-4" />} loading={query.isRefetching && !query.isFetchingNextPage} onClick={() => void refreshPromptList()}>
                                刷新列表
                            </Button>
                            <Button type="primary" icon={<RefreshCw className="size-4" />} loading={syncingPrompts} onClick={() => void syncRemotePrompts()}>
                                联网更新
                            </Button>
                        </div>
                    </div>
                    {query.isLoading ? (
                        <div className="flex h-60 items-center justify-center">
                            <Spin />
                        </div>
                    ) : null}
                    {!query.isLoading ? (
                        <>
                            <div className="mx-auto mt-8 w-full max-w-2xl">
                                <Input size="large" className="sacred-prompt-search w-full" prefix={<Search className="size-4" />} value={titleKeyword} placeholder="按标题查询" suffix={searchPending ? "搜索中" : null} onChange={(event) => setTitleKeyword(event.target.value)} />
                            </div>
                            <div className="sacred-prompt-filter-surface mx-auto mt-6 grid max-w-6xl gap-3 text-left">
                                <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start">
                                    <div className="sacred-prompt-filter-label pt-2 text-xs font-medium">分类</div>
                                    <div className="flex flex-wrap gap-2">
                                        {promptCategoryOptions.map((category) => (
                                            <Tag.CheckableTag key={category} checked={selectedCategory === category} className={cn("prompt-filter-tag", selectedCategory === category && "is-active")} onChange={() => setSelectedCategory(category)}>
                                                {category}
                                            </Tag.CheckableTag>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start">
                                    <div className="sacred-prompt-filter-label pt-2 text-xs font-medium">标签</div>
                                    <div className="flex flex-wrap gap-2">
                                        {promptTags.map((tag) => (
                                            <Tag.CheckableTag
                                                key={tag}
                                                checked={tag === ALL_PROMPTS_OPTION ? selectedTags.length === 0 : selectedTags.includes(tag)}
                                                className={cn("prompt-filter-tag", (tag === ALL_PROMPTS_OPTION ? selectedTags.length === 0 : selectedTags.includes(tag)) && "is-active")}
                                                onChange={() => toggleTag(tag)}
                                            >
                                                {tag}
                                            </Tag.CheckableTag>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>

                {!query.isLoading ? (
                    <div>
                        <div className="mx-auto grid max-w-7xl gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {visiblePromptItems.map((item) => (
                                <PromptCard
                                    key={item.id}
                                    item={item}
                                    onOpen={() => setSelectedPrompt(item)}
                                    onCopy={() => copyText(item.prompt, "提示词已复制")}
                                    extraAction={
                                        <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => savePromptAsset(item)}>
                                            加入我的素材
                                        </Button>
                                    }
                                />
                            ))}
                        </div>
                        {promptItems.length === 0 ? <PromptEmptyState description="没有找到匹配的提示词" /> : null}
                        <div className="sacred-prompt-list-status mx-auto mt-6 max-w-7xl text-center text-xs">
                            {query.isFetchingNextPage ? "加载中..." : hasHiddenLoadedPrompts ? `已显示 ${visiblePromptItems.length} / ${promptItems.length} 条，继续向下滚动显示更多` : query.hasNextPage ? "继续向下滚动加载更多" : promptItems.length > 0 ? "已经到底了" : null}
                        </div>
                    </div>
                ) : null}
            </main>

            <PromptDetailDialog prompt={selectedPrompt} onClose={() => setSelectedPrompt(null)} onCopy={(prompt) => copyText(prompt, "提示词已复制")} onSaveAsset={savePromptAsset} />
        </div>
    );
}

function PromptEmptyState({ description }: { description: string }) {
    return (
        <div className="mx-auto max-w-xl">
            <div className="sacred-panel-soft flex min-h-[200px] flex-col items-center justify-center gap-3 py-12 text-center text-[color:var(--sacred-on-surface-variant)]">
                <span className="grid size-12 place-items-center rounded-lg border border-[rgba(var(--sacred-gold-rgb),0.22)] bg-[rgba(var(--sacred-gold-rgb),0.08)] text-[color:var(--sacred-tertiary)]">
                    <Inbox className="size-5" />
                </span>
                <span className="text-sm">{description}</span>
            </div>
        </div>
    );
}
