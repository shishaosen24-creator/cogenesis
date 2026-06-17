"use client";

import { Drawer } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { scheduleRoutePrefetch } from "@/lib/route-prefetch";
import { cn } from "@/lib/utils";

type MobileNavDrawerProps = {
    open: boolean;
    activeToolSlug?: NavigationToolSlug;
    onClose: () => void;
};

export function MobileNavDrawer({ open, activeToolSlug, onClose }: MobileNavDrawerProps) {
    const router = useRouter();
    const cancelWarmRouteRef = useRef<(() => void) | null>(null);
    const warmRoute = (href: string) => {
        cancelWarmRouteRef.current?.();
        cancelWarmRouteRef.current = scheduleRoutePrefetch(router, href);
    };
    const cancelWarmRoute = () => {
        cancelWarmRouteRef.current?.();
        cancelWarmRouteRef.current = null;
    };
    const closeAndCancel = () => {
        cancelWarmRoute();
        onClose();
    };
    return (
        <Drawer title="导航" placement="left" size={300} open={open} onClose={onClose} className="md:hidden">
            <div className="space-y-3">
                <div className="portal-glass mb-5 px-4 py-4">
                    <div className="sacred-label">workspace</div>
                    <div className="sacred-title mt-2 text-xl font-semibold">CoGenesis</div>
                </div>
                {navigationTools.map((tool) => {
                    const Icon = tool.icon;
                    const active = tool.slug === activeToolSlug;
                    return (
                        <Link
                            key={tool.slug}
                            href={`/${tool.slug}`}
                            prefetch={false}
                            onClick={closeAndCancel}
                            onMouseEnter={() => warmRoute(`/${tool.slug}`)}
                            onFocus={() => warmRoute(`/${tool.slug}`)}
                            onMouseLeave={cancelWarmRoute}
                            className={cn(
                                "flex items-center gap-3 rounded-md border px-3 py-3 text-base transition",
                                active
                                    ? "border-[rgba(233,193,118,0.6)] bg-[rgba(233,193,118,0.12)] font-medium text-[color:var(--sacred-tertiary)] shadow-[0_0_16px_rgba(197,160,89,0.16)]"
                                    : "border-transparent text-[color:var(--sacred-on-surface-variant)] hover:border-[rgba(233,193,118,0.36)] hover:bg-[rgba(233,193,118,0.08)] hover:text-[color:var(--sacred-on-surface)]",
                            )}
                        >
                            <Icon className="size-5" />
                            <span>{tool.label}</span>
                        </Link>
                    );
                })}
            </div>
        </Drawer>
    );
}
