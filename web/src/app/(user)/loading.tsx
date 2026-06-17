import { SacredLoadingShell } from "@/components/layout/sacred-loading-shell";

export default function Loading() {
    return <SacredLoadingShell title="正在切换工作台" subtitle="页面正在编译并恢复状态，先给你一个可见的骨架，避免点击后像没反应。" />;
}
