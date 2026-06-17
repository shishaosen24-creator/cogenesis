import { SacredLoadingShell } from "@/components/layout/sacred-loading-shell";

export default function Loading() {
    return <SacredLoadingShell title="正在进入画布" subtitle="当前画布正在恢复，先显示骨架，等数据和图片补完后再进入可操作状态。" />;
}
