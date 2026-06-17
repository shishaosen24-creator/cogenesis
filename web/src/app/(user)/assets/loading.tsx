import { SacredLoadingShell } from "@/components/layout/sacred-loading-shell";

export default function Loading() {
    return <SacredLoadingShell eyebrow="asset vault" title="正在打开我的素材" subtitle="正在恢复本地素材、标签和预览，稍后就能继续编辑和检索。" />;
}
