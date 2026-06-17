import { SacredLoadingShell } from "@/components/layout/sacred-loading-shell";

export default function Loading() {
    return <SacredLoadingShell eyebrow="shared vault" title="正在打开素材库" subtitle="共享素材库正在加载远端条目，先展示骨架，避免切换页面时出现空等待。" />;
}
