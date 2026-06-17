"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { ROUTE_TRANSITION_EVENT } from "@/lib/navigation-feedback";

export function RouteTransitionFeedback() {
    const pathname = usePathname();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setVisible(false);
    }, [pathname]);

    useEffect(() => {
        let hideTimer: ReturnType<typeof setTimeout> | null = null;

        const showFeedback = () => {
            if (hideTimer) clearTimeout(hideTimer);
            setVisible(true);
            hideTimer = setTimeout(() => setVisible(false), 6000);
        };

        const handlePointerDown = (event: PointerEvent) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const target = event.target instanceof Element ? event.target : null;
            const link = target?.closest("a[href]");
            if (!(link instanceof HTMLAnchorElement)) return;
            if (link.target && link.target !== "_self") return;

            const next = new URL(link.href, window.location.href);
            if (next.origin !== window.location.origin) return;
            if (next.pathname === window.location.pathname && next.search === window.location.search && next.hash === window.location.hash) return;

            showFeedback();
        };

        const handlePopState = () => showFeedback();
        const handleManualTransition = () => showFeedback();

        document.addEventListener("pointerdown", handlePointerDown, true);
        window.addEventListener("popstate", handlePopState);
        window.addEventListener(ROUTE_TRANSITION_EVENT, handleManualTransition);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown, true);
            window.removeEventListener("popstate", handlePopState);
            window.removeEventListener(ROUTE_TRANSITION_EVENT, handleManualTransition);
            if (hideTimer) clearTimeout(hideTimer);
        };
    }, []);

    if (!visible) return null;

    return (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999]">
            <div className="h-px w-full overflow-hidden bg-[rgba(233,193,118,0.12)]">
                <div className="route-transition-feedback-bar h-full w-1/2 bg-[color:var(--sacred-tertiary)] shadow-[0_0_16px_rgba(233,193,118,0.75)]" />
            </div>
            <div className="mx-auto mt-3 flex max-w-[1440px] justify-center px-4">
                <div className="rounded-full border border-[rgba(233,193,118,0.24)] bg-[rgba(13,15,14,0.72)] px-3 py-1.5 text-xs font-medium text-[color:var(--sacred-tertiary)] shadow-[0_10px_30px_rgba(0,0,0,0.24)] backdrop-blur-md">
                    正在进入...
                </div>
            </div>
        </div>
    );
}
