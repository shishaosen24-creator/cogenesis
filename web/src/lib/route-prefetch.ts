"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

const INTENT_PREFETCH_DELAY_MS = 160;
const INTENT_PREFETCH_IDLE_TIMEOUT_MS = 900;

function scheduleIdle(callback: () => void, timeout: number) {
    if (typeof window.requestIdleCallback === "function") {
        const handle = window.requestIdleCallback(callback, { timeout });
        return () => window.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(callback, Math.min(timeout, 400));
    return () => window.clearTimeout(handle);
}

export function scheduleRoutePrefetch(router: AppRouterInstance, href: string) {
    if (typeof window === "undefined") return () => {};
    let cancelled = false;
    let cancelIdle: (() => void) | null = null;
    const timer = window.setTimeout(() => {
        if (cancelled || document.visibilityState !== "visible") return;
        cancelIdle = scheduleIdle(() => {
            if (cancelled) return;
            try {
                const url = new URL(href, window.location.href);
                if (url.origin !== window.location.origin) return;
                router.prefetch(`${url.pathname}${url.search}`);
            } catch {
                // Intent prefetch is optional and should never affect interaction.
            }
        }, INTENT_PREFETCH_IDLE_TIMEOUT_MS);
    }, INTENT_PREFETCH_DELAY_MS);

    return () => {
        cancelled = true;
        window.clearTimeout(timer);
        cancelIdle?.();
    };
}
