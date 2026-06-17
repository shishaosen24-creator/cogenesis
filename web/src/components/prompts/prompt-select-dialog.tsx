"use client";

import { Check, Search } from "lucide-react";
import { type UIEvent, useDeferredValue, useEffect, useState } from "react";
import { App, Input, Modal, Spin, Tag } from "antd";

import { ALL_PROMPTS_OPTION } from "@/services/api/prompts";
import { cn } from "@/lib/utils";
import { PromptCard } from "./prompt-card";
import { usePromptList } from "./use-prompt-list";

const PROMPT_DIALOG_RENDER_BATCH_SIZE = 36;

export type PromptSelectDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; onSelect: (prompt: string) => void };

export function PromptSelectDialog({ open, onOpenChange, onSelect }: PromptSelectDialogProps) {
    const { message } = App.useApp();
    const [keyword, setKeyword] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState(ALL_PROMPTS_OPTION);
    const [visibleItemCount, setVisibleItemCount] = useState(PROMPT_DIALOG_RENDER_BATCH_SIZE);
    const deferredKeyword = useDeferredValue(keyword);
    const { query, items, tags: promptTags, categories: promptCategories } = usePromptList({ keyword: deferredKeyword, tags: selectedTags, category: selectedCategory, enabled: open });
    const searchPending = keyword !== deferredKeyword;
    const visibleItems = items.slice(0, visibleItemCount);
    const hasHiddenLoadedItems = visibleItemCount < items.length;
    const toggleTag = (tag: string) => {
        if (tag === ALL_PROMPTS_OPTION) return setSelectedTags([]);
        setSelectedTags((items) => (items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag]));
    };
    const selectPrompt = (prompt: string) => {
        onSelect(prompt);
        onOpenChange(false);
    };

    useEffect(() => {
        if (query.isError) message.error(query.error instanceof Error ? query.error.message : "获取提示词失败");
    }, [message, query.error, query.isError]);

    useEffect(() => {
        setVisibleItemCount(PROMPT_DIALOG_RENDER_BATCH_SIZE);
    }, [deferredKeyword, selectedCategory, selectedTags]);

    const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
        const target = event.currentTarget;
        const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 180;
        if (!nearBottom) return;
        if (hasHiddenLoadedItems) {
            setVisibleItemCount((count) => Math.min(count + PROMPT_DIALOG_RENDER_BATCH_SIZE, items.length));
            return;
        }
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    };

    return (
        <Modal
            className="sacred-prompt-select-modal"
            title={
                <div>
                    <div className="text-base font-semibold text-[color:var(--sacred-on-surface)]">提示词库</div>
                    <div className="mt-1 text-xs font-normal text-[color:var(--sacred-on-surface-variant)]">选择一个提示词填入当前创作输入区</div>
                </div>
            }
            open={open}
            onCancel={() => onOpenChange(false)}
            footer={null}
            width={1040}
            centered
        >
            <div className="sacred-prompt-select-body" data-canvas-no-zoom onWheelCapture={(event) => event.stopPropagation()}>
                <div className="mx-auto max-w-2xl">
                    <Input size="large" prefix={<Search className="size-4 text-stone-400" />} value={keyword} suffix={searchPending ? "搜索中" : null} onChange={(event) => setKeyword(event.target.value)} placeholder="按标题查询" />
                </div>
                <div className="sacred-prompt-filter-panel sacred-panel-soft mt-5 grid gap-3 p-3">
                    <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start">
                        <div className="pt-2 text-xs font-medium text-stone-500 dark:text-stone-400">分类</div>
                        <div className="flex flex-wrap gap-2">
                            {promptCategories.map((category) => (
                                <Tag.CheckableTag key={category} checked={selectedCategory === category} className={cn("prompt-filter-tag", selectedCategory === category && "is-active")} onChange={() => setSelectedCategory(category)}>
                                    {category}
                                </Tag.CheckableTag>
                            ))}
                        </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start">
                        <div className="pt-2 text-xs font-medium text-stone-500 dark:text-stone-400">标签</div>
                        <div className="flex flex-wrap gap-2">
                            {promptTags.map((tag) => {
                                const active = tag === ALL_PROMPTS_OPTION ? selectedTags.length === 0 : selectedTags.includes(tag);
                                return (
                                    <Tag.CheckableTag key={tag} checked={active} className={cn("prompt-filter-tag", active && "is-active")} onChange={() => toggleTag(tag)}>
                                        {tag}
                                    </Tag.CheckableTag>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className="sacred-prompt-select-list thin-scrollbar mt-6 max-h-[520px] overflow-y-auto pr-2" data-canvas-no-zoom onScroll={handleListScroll} onWheelCapture={(event) => event.stopPropagation()}>
                    {query.isLoading ? (
                        <div className="flex h-40 items-center justify-center">
                            <Spin />
                        </div>
                    ) : null}
                    <div className="sacred-prompt-select-grid grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {visibleItems.map((item) => (
                            <PromptCard key={item.id} item={item} onOpen={() => selectPrompt(item.prompt)} onCopy={() => selectPrompt(item.prompt)} actionLabel="使用此提示词" actionIcon={<Check className="size-3.5" />} actionType="primary" />
                        ))}
                    </div>
                    {!query.isLoading && items.length === 0 ? <PromptDialogEmptyState /> : null}
                    {hasHiddenLoadedItems ? <div className="py-4 text-center text-xs text-[color:var(--sacred-on-surface-variant)]">已显示 {visibleItems.length} / {items.length} 条，继续滚动显示更多</div> : null}
                    {query.isFetchingNextPage ? (
                        <div className="py-4 text-center">
                            <Spin size="small" />
                        </div>
                    ) : null}
                </div>
            </div>
        </Modal>
    );
}

function PromptDialogEmptyState() {
    return (
        <div className="sacred-empty-state mt-4 flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
            <Search className="mb-4 size-9 text-[color:var(--sacred-tertiary)]" />
            <div className="text-sm font-medium text-[color:var(--sacred-on-surface)]">没有找到匹配的提示词</div>
            <div className="mt-2 max-w-sm text-xs leading-5 text-[color:var(--sacred-on-surface-variant)]">换一个关键词、分类或标签继续查找。</div>
        </div>
    );
}
