"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PREWARM_ROUTES = ["/canvas", "/image", "/video", "/prompts", "/assets"];

export function RoutePrewarmer() {
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;
        const warm = () => {
            if (cancelled) return;
            for (const route of PREWARM_ROUTES) {
                if (cancelled) return;
                try {
                    router.prefetch(route);
                } catch {
                    // Route warm-up should never block navigation.
                }
            }
        };
        if (process.env.NODE_ENV === "development") {
            warm();
            return () => {
                cancelled = true;
            };
        }
        const idle = window.requestIdleCallback ? window.requestIdleCallback(warm, { timeout: 2500 }) : window.setTimeout(warm, 2500);

        return () => {
            cancelled = true;
            if (typeof idle === "number") window.clearTimeout(idle);
            else window.cancelIdleCallback?.(idle);
        };
    }, [router]);

    return null;
}
