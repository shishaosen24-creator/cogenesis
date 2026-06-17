"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { App, Input, Modal, Pagination, Spin, Tabs, Tag } from "antd";
import { Inbox, Search } from "lucide-react";
import axios from "axios";

import { cn } from "@/lib/utils";
import { useAssetStore, type Asset } from "@/stores/use-asset-store";
import { fetchAssetLibrary, type AssetLibraryItem } from "@/services/api/assets";

export type AssetPickerTab = "my-assets" | "library";

export type InsertAssetPayload = { kind: "text"; content: string; title: string } | { kind: "image"; dataUrl: string; title: string; storageKey?: string } | { kind: "video"; url: string; title: string; storageKey?: string; width?: number; height?: number };

export type AssetPickerModalProps = {
    open: boolean;
    defaultTab?: AssetPickerTab;
    onInsert: (payload: InsertAssetPayload) => void;
    onClose: () => void;
};

export function AssetPickerModal({ open, defaultTab = "my-assets", onInsert, onClose }: AssetPickerModalProps) {
    const [activeTab, setActiveTab] = useState<AssetPickerTab>(defaultTab);

    useEffect(() => {
        if (open) setActiveTab(defaultTab);
    }, [open, defaultTab]);

    return (
        <Modal
            className="canvas-asset-picker-modal"
            title={
                <div>
                    <div className="text-base font-semibold text-[color:var(--sacred-on-surface)]">选择素材</div>
                    <div className="mt-1 text-xs font-normal text-[color:var(--sacred-on-surface-variant)]">从我的素材或素材库插入到当前画布</div>
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={880}
            centered
            destroyOnHidden
            styles={{ body: { padding: "0 clamp(12px, 3vw, 24px) 24px", maxHeight: "min(72vh, 680px)", overflowY: "auto" } }}
        >
            <Tabs
                className="canvas-asset-picker-tabs"
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as AssetPickerTab)}
                items={[
                    { key: "my-assets", label: "我的素材", children: <MyAssetsTab onInsert={onInsert} /> },
                    { key: "library", label: "素材库", children: <LibraryTab onInsert={onInsert} /> },
                ]}
            />
        </Modal>
    );
}

const PAGE_SIZE = 8;

const kindOptions = [
    { label: "全部", value: "all" },
    { label: "文本", value: "text" },
    { label: "图片", value: "image" },
    { label: "视频", value: "video" },
];

function LibraryTab({ onInsert }: { onInsert: (payload: InsertAssetPayload) => void }) {
    const { message } = App.useApp();
    const [keyword, setKeyword] = useState("");
    const [kindFilter, setKindFilter] = useState("");
    const [page, setPage] = useState(1);
    const [inserting, setInserting] = useState<string | null>(null);
    const deferredKeyword = useDeferredValue(keyword);

    const query = useQuery({
        queryKey: ["asset-picker-library", deferredKeyword, kindFilter, page],
        queryFn: () => fetchAssetLibrary({ keyword: deferredKeyword, type: kindFilter, page, pageSize: PAGE_SIZE }),
        retry: false,
    });

    const items = query.data?.items || [];
    const total = query.data?.total || 0;
    const searchPending = keyword !== deferredKeyword || query.isFetching;

    const handleInsert = async (asset: AssetLibraryItem) => {
        try {
            setInserting(asset.id);
            if (asset.type === "text") {
                onInsert({ kind: "text", content: asset.content, title: asset.title });
            } else {
                const dataUrl = await remoteImageToDataUrl(asset.url);
                onInsert({ kind: "image", dataUrl, title: asset.title });
            }
        } catch {
            message.error("插入失败");
        } finally {
            setInserting(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="canvas-asset-picker-filters sacred-panel-soft flex flex-wrap items-center gap-3 p-3">
                <Input
                    className="w-full sm:w-56"
                    size="small"
                    prefix={<Search className="size-3.5 text-stone-400" />}
                    placeholder="搜索素材"
                    value={keyword}
                    allowClear
                    suffix={searchPending ? "搜索中" : null}
                    onChange={(e) => {
                        setPage(1);
                        setKeyword(e.target.value);
                    }}
                />
                <div className="flex flex-wrap gap-1.5">
                    {[
                        { label: "全部", value: "" },
                        { label: "文本", value: "text" },
                        { label: "图片", value: "image" },
                    ].map((opt) => (
                        <Tag.CheckableTag
                            key={opt.value || "all"}
                            checked={kindFilter === opt.value}
                            className={cn("prompt-filter-tag", kindFilter === opt.value && "is-active")}
                            onChange={() => {
                                setPage(1);
                                setKindFilter(opt.value);
                            }}
                        >
                            {opt.label}
                        </Tag.CheckableTag>
                    ))}
                </div>
            </div>

            {query.isLoading ? (
                <div className="flex justify-center py-16">
                    <Spin />
                </div>
            ) : items.length ? (
                <div className="canvas-asset-picker-grid grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {items.map((asset) => (
                        <PickerCard key={asset.id} title={asset.title} kind={asset.type} cover={asset.coverUrl} loading={inserting === asset.id} onClick={() => void handleInsert(asset)} />
                    ))}
                </div>
            ) : (
                <PickerEmptyState description="没有素材" />
            )}

            {total > PAGE_SIZE && (
                <div className="flex justify-center">
                    <Pagination size="small" current={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} showSizeChanger={false} />
                </div>
            )}
        </div>
    );
}

function PickerCard({ title, kind, cover, loading, onClick }: { title: string; kind: string; cover: string; loading?: boolean; onClick: () => void }) {
    const kindLabel = kind === "image" ? "图片" : kind === "video" ? "视频" : "文本";

    return (
        <button
            type="button"
            className="sacred-gallery-card group relative cursor-pointer text-left"
            onClick={onClick}
            disabled={loading}
        >
            {cover ? (
                <img src={cover} alt={title} className="aspect-[4/3] w-full object-cover" loading="lazy" decoding="async" fetchPriority="low" />
            ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-[rgba(var(--sacred-panel-rgb),0.32)] p-3 text-center text-xs leading-5 text-[color:var(--sacred-on-surface-variant)]">
                    <span className="sacred-label">{kindLabel}</span>
                    <span className="text-[11px] opacity-70">{kind === "image" ? "无封面预览" : kind === "video" ? "视频素材" : "文本素材"}</span>
                </div>
            )}
            <div className="p-2.5">
                <div className="flex items-center justify-between gap-2">
                    <span className="line-clamp-1 text-xs font-medium text-[color:var(--sacred-on-surface)]">{title}</span>
                    <Tag className="m-0 shrink-0 text-[10px]">{kindLabel}</Tag>
                </div>
            </div>
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[rgba(18,20,19,0.62)] backdrop-blur-sm">
                    <Spin size="small" />
                </div>
            )}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stone-950/0 text-sm font-medium text-white opacity-0 transition group-hover:bg-stone-950/55 group-hover:opacity-100">插入</div>
        </button>
    );
}

function PickerEmptyState({ description }: { description: string }) {
    return (
        <div className="sacred-panel-soft flex min-h-[180px] flex-col items-center justify-center gap-3 py-12 text-center text-[color:var(--sacred-on-surface-variant)]">
            <span className="grid size-11 place-items-center rounded-lg border border-[rgba(var(--sacred-gold-rgb),0.22)] bg-[rgba(var(--sacred-gold-rgb),0.08)] text-[color:var(--sacred-tertiary)]">
                <Inbox className="size-5" />
            </span>
            <span className="text-sm">{description}</span>
        </div>
    );
}

async function remoteImageToDataUrl(url: string) {
    const response = await axios.get(url, { responseType: "blob" });
    const blob = response.data as Blob;
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(blob);
    });
}

function MyAssetsTab({ onInsert }: { onInsert: (payload: InsertAssetPayload) => void }) {
    const assets = useAssetStore((state) => state.assets);
    const [keyword, setKeyword] = useState("");
    const [kindFilter, setKindFilter] = useState("all");
    const [page, setPage] = useState(1);
    const deferredKeyword = useDeferredValue(keyword);

    const filtered = useMemo(() => {
        const query = deferredKeyword.trim().toLowerCase();
        return assets
            .filter((a) => a.kind === "text" || a.kind === "image" || a.kind === "video")
            .filter((a) => kindFilter === "all" || a.kind === kindFilter)
            .filter((a) => !query || [a.title, ...(a.tags || [])].join(" ").toLowerCase().includes(query));
    }, [assets, deferredKeyword, kindFilter]);
    const searchPending = keyword !== deferredKeyword;

    const visible = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        setPage((v) => Math.min(v, maxPage));
    }, [filtered.length]);

    const handleInsert = (asset: Asset) => {
        if (asset.kind === "text") {
            onInsert({ kind: "text", content: asset.data.content, title: asset.title });
        } else {
            onInsert(asset.kind === "video" ? { kind: "video", url: asset.data.url, storageKey: asset.data.storageKey, title: asset.title, width: asset.data.width, height: asset.data.height } : { kind: "image", dataUrl: asset.data.dataUrl, storageKey: asset.data.storageKey, title: asset.title });
        }
    };

    return (
        <div className="space-y-4">
            <div className="canvas-asset-picker-filters sacred-panel-soft flex flex-wrap items-center gap-3 p-3">
                <Input
                    className="w-full sm:w-56"
                    size="small"
                    prefix={<Search className="size-3.5 text-stone-400" />}
                    placeholder="搜索素材"
                    value={keyword}
                    allowClear
                    suffix={searchPending ? "搜索中" : null}
                    onChange={(e) => {
                        setPage(1);
                        setKeyword(e.target.value);
                    }}
                />
                <div className="flex flex-wrap gap-1.5">
                    {kindOptions.map((opt) => (
                        <Tag.CheckableTag
                            key={opt.value}
                            checked={kindFilter === opt.value}
                            className={cn("prompt-filter-tag", kindFilter === opt.value && "is-active")}
                            onChange={() => {
                                setPage(1);
                                setKindFilter(opt.value);
                            }}
                        >
                            {opt.label}
                        </Tag.CheckableTag>
                    ))}
                </div>
            </div>

            {visible.length ? (
                <div className="canvas-asset-picker-grid grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {visible.map((asset) => (
                        <PickerCard key={asset.id} title={asset.title} kind={asset.kind} cover={asset.coverUrl || (asset.kind === "image" ? asset.data.dataUrl : "")} onClick={() => handleInsert(asset)} />
                    ))}
                </div>
            ) : (
                <PickerEmptyState description="没有素材" />
            )}

            {filtered.length > PAGE_SIZE && (
                <div className="flex justify-center">
                    <Pagination size="small" current={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} showSizeChanger={false} />
                </div>
            )}
        </div>
    );
}
