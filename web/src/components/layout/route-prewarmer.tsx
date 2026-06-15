"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PREWARM_ROUTES = ["/canvas", "/canvas/__route-prewarm__", "/image", "/video", "/prompts", "/assets", "/asset-library", "/login"];

export function RoutePrewarmer() {
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;
        PREWARM_ROUTES.forEach((route) => router.prefetch(route));
        const warmTimer = window.setTimeout(() => {
            if (process.env.NODE_ENV !== "development") return;
            void (async () => {
                for (const route of PREWARM_ROUTES) {
                    if (cancelled) return;
                    try {
                        await fetch(route, { cache: "no-store", credentials: "same-origin" });
                    } catch {
                        // Dev-only route warming should never block the UI.
                    }
                }
            })();
        }, 250);

        return () => {
            cancelled = true;
            window.clearTimeout(warmTimer);
        };
    }, [router]);

    return null;
}
