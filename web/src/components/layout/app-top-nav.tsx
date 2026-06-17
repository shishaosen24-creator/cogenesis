"use client";

import dynamic from "next/dynamic";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { scheduleRoutePrefetch } from "@/lib/route-prefetch";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";

const AppConfigModal = dynamic(() => import("@/components/layout/app-config-modal").then((mod) => mod.AppConfigModal), { ssr: false });
const MobileNavDrawer = dynamic(() => import("@/components/layout/mobile-nav-drawer").then((mod) => mod.MobileNavDrawer), { ssr: false });

export function AppTopNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const cancelWarmRouteRef = useRef<(() => void) | null>(null);
    const hideHeader = /^\/canvas\/[^/]+/.test(pathname);
    const slug = pathname.split("/").filter(Boolean)[0];
    const activeToolSlug = navigationTools.some((tool) => tool.slug === slug) ? (slug as NavigationToolSlug) : undefined;
    const warmRoute = (href: string) => {
        cancelWarmRouteRef.current?.();
        cancelWarmRouteRef.current = scheduleRoutePrefetch(router, href);
    };
    const cancelWarmRoute = () => {
        cancelWarmRouteRef.current?.();
        cancelWarmRouteRef.current = null;
    };

    return (
        <>
            {!hideHeader ? (
                <header
                    className={cn(
                        "sticky top-0 z-20 h-16 shrink-0 border-b border-[color:var(--sacred-outline-variant)] bg-[color:var(--sacred-surface)]/86 shadow-[0_0_22px_rgba(197,160,89,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-[color:var(--sacred-surface)]/78",
                        pathname === "/" && "fixed inset-x-0 top-0 stage-nav-reveal",
                    )}
                >
                    <div className="mx-auto flex h-full max-w-[1440px] items-stretch justify-between gap-5 px-5 sm:px-6">
                        <div className="flex min-w-0 items-center">
                            <Link href="/" prefetch={false} onMouseEnter={() => warmRoute("/")} onFocus={() => warmRoute("/")} onMouseLeave={cancelWarmRoute} onClick={cancelWarmRoute} className="group flex h-full shrink-0 items-center gap-3 text-sm font-semibold leading-none tracking-tight text-[color:var(--sacred-on-surface)] transition hover:text-[color:var(--sacred-tertiary)]">
                                <img src="/brand/site-logo-transparent.png" alt="CoGenesis" className="size-9 shrink-0 object-contain drop-shadow-[0_0_10px_rgba(197,160,89,0.35)] transition group-hover:drop-shadow-[0_0_16px_rgba(197,160,89,0.55)]" />
                                <span className="sacred-title text-lg font-semibold">CoGenesis</span>
                            </Link>

                            <button
                                type="button"
                                className="ml-3 inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-[color:var(--sacred-outline-variant)]/70 text-[color:var(--sacred-on-surface-variant)] transition hover:border-[color:var(--sacred-tertiary)] hover:text-[color:var(--sacred-tertiary)] md:hidden"
                                onClick={() => setMobileNavOpen(true)}
                                aria-label="打开导航菜单"
                                title="导航菜单"
                            >
                                <Menu className="size-5" />
                            </button>

                            <nav className="hide-scrollbar ml-8 hidden h-16 min-w-0 items-center gap-2 overflow-x-auto md:flex">
                                {navigationTools.map((tool) => {
                                    const Icon = tool.icon;
                                    const active = tool.slug === activeToolSlug;
                                    return (
                                        <Link
                                            key={tool.slug}
                                            href={`/${tool.slug}`}
                                            prefetch={false}
                                            onMouseEnter={() => warmRoute(`/${tool.slug}`)}
                                            onFocus={() => warmRoute(`/${tool.slug}`)}
                                            onMouseLeave={cancelWarmRoute}
                                            onClick={cancelWarmRoute}
                                            className={cn(
                                                "relative flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm leading-6 transition after:absolute after:inset-x-3 after:bottom-1 after:h-px after:origin-center after:transition",
                                                active
                                                    ? "bg-[rgba(233,193,118,0.12)] font-medium text-[color:var(--sacred-tertiary)] after:bg-[color:var(--sacred-tertiary)]"
                                                    : "text-[color:var(--sacred-on-surface-variant)] after:scale-x-0 after:bg-[color:var(--sacred-tertiary)] hover:bg-[rgba(233,193,118,0.07)] hover:text-[color:var(--sacred-on-surface)] hover:after:scale-x-100",
                                            )}
                                        >
                                            <Icon className="size-4" />
                                            <span className="truncate">{tool.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="my-auto flex h-9 min-w-0 items-center justify-end gap-2 justify-self-end whitespace-nowrap">
                            <UserStatusActions compactOnMobile />
                        </div>
                    </div>
                </header>
            ) : null}

            <MobileNavDrawer open={mobileNavOpen} activeToolSlug={activeToolSlug} onClose={() => setMobileNavOpen(false)} />
            <AppConfigModal />
        </>
    );
}
