import { Home, LogIn } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
    return (
        <div className="flex h-dvh flex-col overflow-hidden text-foreground">
            <main className="sacred-page-shell flex h-full min-h-0 items-center justify-center overflow-y-auto px-6 py-10">
                <section className="portal-glass sacred-page-content w-full max-w-md p-8 text-center">
                    <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-lg border border-[rgba(233,193,118,0.45)] bg-[rgba(233,193,118,0.12)] text-2xl font-semibold text-[color:var(--sacred-tertiary)] shadow-[0_0_18px_rgba(197,160,89,0.18)]">404</div>
                    <h1 className="sacred-title text-3xl font-semibold tracking-normal">页面不存在</h1>
                    <p className="mt-3 text-sm leading-6 text-[color:var(--sacred-on-surface-variant)]">这个地址没有对应的页面，可能已经移动或被合并到其他入口。</p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <Link href="/" className="btn-sacred h-10 px-4 text-sm">
                            <Home className="size-4" />
                            返回首页
                        </Link>
                        <Link
                            href="/login"
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[color:var(--sacred-outline-variant)] bg-[rgba(30,32,31,0.42)] px-4 text-sm font-medium text-[color:var(--sacred-on-surface)] transition hover:border-[color:var(--sacred-tertiary)] hover:text-[color:var(--sacred-tertiary)]"
                        >
                            <LogIn className="size-4" />
                            去登录
                        </Link>
                    </div>
                </section>
            </main>
        </div>
    );
}
