"use client";

import type { ReactNode } from "react";

import { AppTopNav } from "@/components/layout/app-top-nav";
import { RoutePrewarmer } from "@/components/layout/route-prewarmer";
import { RouteTransitionFeedback } from "@/components/layout/route-transition-feedback";

export default function UserLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-transparent text-foreground">
            <RoutePrewarmer />
            <RouteTransitionFeedback />
            <AppTopNav />
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>
    );
}
