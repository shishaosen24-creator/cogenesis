"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PREWARM_ROUTES = ["/canvas", "/image", "/video", "/prompts", "/assets", "/asset-library", "/login"];
const USER_ACTIVITY_PAUSE_MS = 1400;
const DEV_PREWARM_START_DELAY_MS = 2500;
const PROD_PREWARM_START_DELAY_MS = 2500;
const DEV_ROUTE_FETCH_TIMEOUT_MS = 4500;

function scheduleIdle(callback: () => void, timeout: number) {
    if (typeof window.requestIdleCallback === "function") {
        const handle = window.requestIdleCallback(callback, { timeout });
        return () => window.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(callback, Math.min(timeout, 900));
    return () => window.clearTimeout(handle);
}

export function RoutePrewarmer() {
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;
        let routeIndex = 0;
        let lastUserActivityAt = performance.now();
        let startTimer: number | null = null;
        let cancelIdle: (() => void) | null = null;
        let activeFetchController: AbortController | null = null;

        const markUserActivity = () => {
            lastUserActivityAt = performance.now();
            activeFetchController?.abort();
        };

        const userIsActive = () => document.visibilityState !== "visible" || performance.now() - lastUserActivityAt < USER_ACTIVITY_PAUSE_MS;

        const fetchRouteWithTimeout = async (route: string) => {
            const controller = new AbortController();
            activeFetchController = controller;
            const timeout = window.setTimeout(() => controller.abort(), DEV_ROUTE_FETCH_TIMEOUT_MS);
            try {
                await fetch(route, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
            } catch {
                // Dev-only page requests are opportunistic and must not compete with clicks.
            } finally {
                window.clearTimeout(timeout);
                if (activeFetchController === controller) activeFetchController = null;
            }
        };

        const warmNextRoute = () => {
            if (cancelled || routeIndex >= PREWARM_ROUTES.length) return;
            if (userIsActive()) {
                startTimer = window.setTimeout(warmNextRoute, USER_ACTIVITY_PAUSE_MS);
                return;
            }

            cancelIdle = scheduleIdle(() => {
                if (cancelled || routeIndex >= PREWARM_ROUTES.length) return;
                if (userIsActive()) {
                    startTimer = window.setTimeout(warmNextRoute, USER_ACTIVITY_PAUSE_MS);
                    return;
                }

                const route = PREWARM_ROUTES[routeIndex];
                routeIndex += 1;
                try {
                    router.prefetch(route);
                } catch {
                    // Route warm-up should never block navigation.
                }

                const continueWarming = () => {
                    if (!cancelled) startTimer = window.setTimeout(warmNextRoute, process.env.NODE_ENV === "development" ? 600 : 120);
                };

                if (process.env.NODE_ENV !== "development") {
                    continueWarming();
                    return;
                }

                void fetchRouteWithTimeout(route).finally(continueWarming);
            }, 1800);
        };

        document.addEventListener("pointerdown", markUserActivity, { capture: true, passive: true });
        document.addEventListener("keydown", markUserActivity, { capture: true });
        document.addEventListener("wheel", markUserActivity, { capture: true, passive: true });

        startTimer = window.setTimeout(warmNextRoute, process.env.NODE_ENV === "development" ? DEV_PREWARM_START_DELAY_MS : PROD_PREWARM_START_DELAY_MS);

        return () => {
            cancelled = true;
            if (startTimer) window.clearTimeout(startTimer);
            cancelIdle?.();
            activeFetchController?.abort();
            document.removeEventListener("pointerdown", markUserActivity, { capture: true });
            document.removeEventListener("keydown", markUserActivity, { capture: true });
            document.removeEventListener("wheel", markUserActivity, { capture: true });
        };
    }, [router]);

    return null;
}
