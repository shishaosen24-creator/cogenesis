"use client";

import { Copy, FolderPlus } from "lucide-react";
import { Button, Modal, Space, Tag } from "antd";

import { formatPromptDate, type Prompt } from "@/services/api/prompts";

export function PromptDetailDialog({ prompt, onClose, onCopy, onSaveAsset }: { prompt: Prompt | null; onClose: () => void; onCopy: (prompt: string) => void; onSaveAsset?: (prompt: Prompt) => void }) {
    return (
        <>
            <Modal
                className="sacred-prompt-detail-modal"
                title={
                    <div>
                        <div className="max-w-full break-words text-base font-semibold text-[color:var(--sacred-on-surface)]">{prompt?.title || "提示词详情"}</div>
                        <div className="mt-1 text-xs font-normal text-[color:var(--sacred-on-surface-variant)]">{prompt?.category || "查看提示词内容、标签和预览"}</div>
                    </div>
                }
                open={Boolean(prompt)}
                onCancel={onClose}
                footer={null}
                width={860}
            >
                {prompt ? (
                    <div className="sacred-prompt-detail-body">
                        <div className="grid gap-5 md:grid-cols-[300px_minmax(0,1fr)]">
                            <div className="space-y-3">
                                {prompt.coverUrl ? <img src={prompt.coverUrl} alt={prompt.title} className="aspect-[4/3] w-full rounded-lg object-cover" /> : <div className="sacred-empty-state flex aspect-[4/3] items-center justify-center text-sm text-[color:var(--sacred-on-surface-variant)]">暂无封面</div>}
                                {prompt.preview ? <pre className="sacred-panel-soft max-h-60 overflow-auto whitespace-pre-wrap p-3 text-xs leading-5 text-[color:var(--sacred-on-surface-variant)]">{prompt.preview}</pre> : null}
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap gap-1.5">
                                    {prompt.tags.map((tag) => (
                                        <Tag key={tag} className="m-0">
                                            {tag}
                                        </Tag>
                                    ))}
                                </div>
                                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[color:var(--sacred-on-surface)]">{prompt.prompt}</p>
                                <div className="mt-4 text-xs text-[color:var(--sacred-on-surface-variant)]">
                                    创建：{formatPromptDate(prompt.createdAt)} · 更新：{formatPromptDate(prompt.updatedAt)}
                                </div>
                                <Space wrap className="sacred-prompt-detail-actions mt-5">
                                    <Button type="primary" icon={<Copy className="size-4" />} onClick={() => onCopy(prompt.prompt)}>
                                        复制提示词
                                    </Button>
                                    {onSaveAsset ? (
                                        <Button icon={<FolderPlus className="size-4" />} onClick={() => onSaveAsset(prompt)}>
                                            加入我的素材
                                        </Button>
                                    ) : null}
                                </Space>
                            </div>
                        </div>
                    </div>
                ) : null}
            </Modal>
        </>
    );
}
