"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { App } from "antd";

import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

export function ClientRootInit({ children }: { children: ReactNode }) {
    const { message } = App.useApp();
    const handledConfigParams = useRef(false);
    const pathname = usePathname();
    const hydrateUser = useUserStore((state) => state.hydrateUser);
    const loadPublicSettings = useConfigStore((state) => state.loadPublicSettings);
    const publicSettings = useConfigStore((state) => state.publicSettings);
    const publicSettingsError = useConfigStore((state) => state.publicSettingsError);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const isLoginPage = pathname === "/login" || pathname === "/admin/login";

    useEffect(() => {
        let cancelled = false;
        let cancelIdle: (() => void) | null = null;
        const loadLater = () => {
            if (cancelled) return;
            cancelIdle = typeof window.requestIdleCallback === "function"
                ? (() => {
                      const handle = window.requestIdleCallback(() => {
                          if (!cancelled) void loadPublicSettings();
                      }, { timeout: 2200 });
                      return () => window.cancelIdleCallback?.(handle);
                  })()
                : (() => {
                      const handle = window.setTimeout(() => {
                          if (!cancelled) void loadPublicSettings();
                      }, 650);
                      return () => window.clearTimeout(handle);
                  })();
        };
        const timer = window.setTimeout(loadLater, 450);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            cancelIdle?.();
        };
    }, [loadPublicSettings]);

    useEffect(() => {
        if (!publicSettingsError) return;
        message.warning("公共配置暂时不可用，已继续使用本地配置。");
    }, [message, publicSettingsError]);

    useEffect(() => {
        if (isLoginPage) return;
        let cancelled = false;
        let cancelIdle: (() => void) | null = null;
        const hydrateLater = () => {
            if (cancelled) return;
            cancelIdle = typeof window.requestIdleCallback === "function"
                ? (() => {
                      const handle = window.requestIdleCallback(() => {
                          if (!cancelled) void hydrateUser();
                      }, { timeout: 1800 });
                      return () => window.cancelIdleCallback?.(handle);
                  })()
                : (() => {
                      const handle = window.setTimeout(() => {
                          if (!cancelled) void hydrateUser();
                      }, 800);
                      return () => window.clearTimeout(handle);
                  })();
        };
        const timer = window.setTimeout(hydrateLater, 300);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            cancelIdle?.();
        };
    }, [hydrateUser, isLoginPage]);

    useEffect(() => {
        if (handledConfigParams.current) return;
        const searchParams = new URLSearchParams(window.location.search);
        const baseUrl = searchParams.get("baseUrl") || searchParams.get("baseurl");
        const apiKey = searchParams.get("apiKey") || searchParams.get("apikey");
        if (!baseUrl && !apiKey) return;
        if (!publicSettings) return;
        handledConfigParams.current = true;
        searchParams.delete("baseUrl");
        searchParams.delete("baseurl");
        searchParams.delete("apiKey");
        searchParams.delete("apikey");
        window.history.replaceState(null, "", `${window.location.pathname}${searchParams.size ? `?${searchParams}` : ""}${window.location.hash}`);
        if (!publicSettings.modelChannel.allowCustomChannel) {
            openConfigDialog(false);
            message.error("后台未允许用户自定义渠道，请联系管理员进行配置");
            return;
        }
        updateConfig("channelMode", "local");
        if (baseUrl) updateConfig("baseUrl", baseUrl);
        if (apiKey) updateConfig("apiKey", apiKey);
        openConfigDialog(false);
    }, [message, openConfigDialog, publicSettings, updateConfig]);

    return <>{children}</>;
}
