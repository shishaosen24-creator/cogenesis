import { SacredLoadingShell } from "@/components/layout/sacred-loading-shell";

export default function Loading() {
    return <SacredLoadingShell eyebrow="endpoint" title="正在打开连接端点" subtitle="账号入口正在准备，页面会先显示骨架，避免点击后像没有响应。" />;
}
