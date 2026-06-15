"use client";

import { useEffect, useState } from "react";
import { Button, InputNumber, Modal } from "antd";
import { Grid2x2 } from "lucide-react";

import { readImageMeta } from "@/lib/image-utils";
import type { ImageSplitParams } from "../utils/canvas-image-data";

export type CanvasImageSplitParams = ImageSplitParams;

const defaultParams: CanvasImageSplitParams = { rows: 2, columns: 2 };
const maxGridSize = 12;

export function CanvasNodeSplitDialog({ dataUrl, open, onClose, onConfirm }: { dataUrl: string; open: boolean; onClose: () => void; onConfirm: (params: CanvasImageSplitParams) => void }) {
    const [params, setParams] = useState(defaultParams);
    const [image, setImage] = useState<{ width: number; height: number } | null>(null);
    const total = params.rows * params.columns;
    const pieceSize = image ? { width: Math.max(1, Math.floor(image.width / params.columns)), height: Math.max(1, Math.floor(image.height / params.rows)) } : null;

    useEffect(() => {
        if (!open) return;
        setParams(defaultParams);
        setImage(null);
    }, [dataUrl, open]);

    useEffect(() => {
        if (!open) return;
        void readImageMeta(dataUrl).then(setImage);
    }, [dataUrl, open]);

    const update = (key: keyof CanvasImageSplitParams, value: string | number | null) => {
        setParams((current) => ({ ...current, [key]: clampGrid(value ?? current[key]) }));
    };

    return (
        <Modal
            className="canvas-image-tool-modal"
            title={
                <div>
                    <div className="text-base font-semibold text-[color:var(--sacred-on-surface)]">切分图片</div>
                    <div className="mt-1 text-xs font-normal text-[color:var(--sacred-on-surface-variant)]">生成 {total} 个图片子节点，并按原图网格排列到画布右侧</div>
                </div>
            }
            open={open && Boolean(dataUrl)}
            onCancel={onClose}
            footer={null}
            width={780}
            centered
            destroyOnHidden
            styles={{ body: { maxHeight: "min(72vh, 680px)", overflowY: "auto" } }}
        >
            <div className="canvas-image-tool-shell space-y-5">
                <div className="grid gap-6 md:grid-cols-[minmax(260px,1fr)_280px]">
                    <div className="canvas-image-tool-preview sacred-panel-soft p-4">
                        <div className="grid min-h-[300px] place-items-center rounded-lg bg-black/30">
                            <div className="relative inline-block max-w-full overflow-hidden rounded-lg bg-black shadow-xl">
                                <img src={dataUrl} alt="" className="block max-h-[340px] max-w-full object-contain opacity-95" draggable={false} />
                                <SplitGrid rows={params.rows} columns={params.columns} />
                            </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="opacity-60">原图</span>
                            <span className="font-semibold">{image ? `${image.width} x ${image.height} px` : "读取中"}</span>
                        </div>
                    </div>
                    <div className="canvas-image-tool-side space-y-5 py-2">
                        <NumberField label="行数" value={params.rows} onChange={(value) => update("rows", value)} />
                        <NumberField label="列数" value={params.columns} onChange={(value) => update("columns", value)} />
                        <div className="sacred-panel-soft px-4 py-3 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="opacity-60">子节点</span>
                                <span className="font-semibold">{total} 个</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="opacity-60">单块约</span>
                                <span className="font-semibold">{pieceSize ? `${pieceSize.width} x ${pieceSize.height}` : "未知"}</span>
                            </div>
                        </div>
                        <div className="canvas-image-tool-actions flex">
                            <Button type="primary" size="large" className="w-full" icon={<Grid2x2 className="size-4" />} onClick={() => onConfirm(params)}>
                                生成子节点
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string | number | null) => void }) {
    return (
        <label className="block space-y-2">
            <span className="font-medium opacity-75">{label}</span>
            <InputNumber className="w-full" min={1} max={maxGridSize} precision={0} value={value} onChange={onChange} />
        </label>
    );
}

function SplitGrid({ rows, columns }: CanvasImageSplitParams) {
    return (
        <div className="pointer-events-none absolute inset-0">
            {Array.from({ length: columns - 1 }).map((_, index) => (
                <div key={`column-${index}`} className="absolute inset-y-0 border-l border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,.35)]" style={{ left: `${((index + 1) / columns) * 100}%` }} />
            ))}
            {Array.from({ length: rows - 1 }).map((_, index) => (
                <div key={`row-${index}`} className="absolute inset-x-0 border-t border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,.35)]" style={{ top: `${((index + 1) / rows) * 100}%` }} />
            ))}
        </div>
    );
}

function clampGrid(value: string | number) {
    const numberValue = Number(value);
    return Math.min(maxGridSize, Math.max(1, Math.round(Number.isFinite(numberValue) ? numberValue : 1)));
}
