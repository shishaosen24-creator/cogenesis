"use client";

import { useState, type CSSProperties } from "react";
import { Modal } from "antd";

const DISPLAY_APP_VERSION = "v0.0.1";

type VersionReleaseModalProps = {
    className?: string;
    style?: CSSProperties;
};

export function VersionReleaseModal({ className, style }: VersionReleaseModalProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                className={className || "inline-flex min-w-[4.25rem] shrink-0 cursor-pointer justify-center whitespace-nowrap text-xs font-medium normal-case text-stone-500 transition hover:text-stone-950 dark:text-stone-400 dark:hover:text-white"}
                style={{ ...style, textTransform: "none" }}
                onClick={() => setOpen(true)}
                title="查看版本更新"
            >
                <span className="relative inline-flex min-w-[3.75rem] justify-center whitespace-nowrap">
                    {DISPLAY_APP_VERSION}
                </span>
            </button>
            <Modal
                className="sacred-version-modal"
                title={
                    <div className="min-w-0">
                        <div className="sacred-label">RELEASE NOTE</div>
                        <div className="sacred-title mt-1 text-xl font-semibold">版本更新</div>
                        <div className="sacred-muted mt-1 text-xs font-normal">当前版本与界面版本</div>
                    </div>
                }
                open={open}
                width={680}
                centered
                footer={null}
                onCancel={() => setOpen(false)}
            >
                <div className="sacred-version-grid">
                    <div className="sacred-version-card">
                        <div className="sacred-muted text-xs">当前版本</div>
                        <div className="mt-2 text-lg font-semibold text-[color:var(--sacred-tertiary-bright)]">{DISPLAY_APP_VERSION}</div>
                    </div>
                    <div className="sacred-version-card">
                        <div className="sacred-muted text-xs">界面版本</div>
                        <div className="mt-2 text-lg font-semibold text-[color:var(--sacred-tertiary-bright)]">{DISPLAY_APP_VERSION}</div>
                    </div>
                </div>
            </Modal>
        </>
    );
}
