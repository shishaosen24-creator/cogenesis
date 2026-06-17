"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const stageNav = [
    { label: "连接端点", href: "/login" },
    { label: "CoGenesis", href: "/canvas" },
    { label: "生图工作台", href: "/image" },
    { label: "视频创作台", href: "/video" },
    { label: "素材库", href: "/assets" },
];

export default function IndexPage() {
    const router = useRouter();
    const warmRoute = (href: string) => {
        void router.prefetch(href);
    };

    return (
        <main className="h-full overflow-hidden text-[color:var(--sacred-on-surface)]">
            <section className="stage-opening relative flex h-full items-center justify-center overflow-hidden px-5 pb-12 pt-20">
                <div className="stage-opening-shade" />

                <div className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-col items-center text-center">
                    <img src="/brand/site-logo-transparent.png" alt="CoGenesis" className="stage-logo-reveal h-24 w-24 object-contain drop-shadow-[0_0_28px_rgba(197,160,89,0.55)] sm:h-32 sm:w-32" />
                    <div className="stage-reveal stage-delay-kicker mt-8 sacred-label">Sacred Technology</div>
                    <h1 className="stage-reveal stage-delay-title sacred-title sacred-title-glow mt-4 text-6xl font-bold uppercase leading-[1.32] tracking-normal sm:text-8xl lg:text-9xl">CoGenesis</h1>
                    <p className="stage-reveal stage-delay-copy mt-6 max-w-3xl text-balance text-xl leading-8 text-[color:var(--sacred-tertiary)] sm:text-2xl">CoGenesis — Where Human and AI Create Each Other</p>
                    <p className="stage-reveal stage-delay-copy-secondary mt-5 max-w-2xl text-balance text-base leading-7 text-[color:var(--sacred-on-surface-variant)]">人与 AI 彼此创世，彼此成就。</p>

                    <div className="stage-reveal stage-delay-actions mt-10 flex flex-col gap-3 sm:flex-row sm:gap-5">
                        <Link className="btn-sacred h-12 px-7" href="/canvas" prefetch={false} onMouseEnter={() => warmRoute("/canvas")} onFocus={() => warmRoute("/canvas")}>
                            开始共创
                        </Link>
                        <Link className="btn-sacred h-12 px-7" href="/login" prefetch={false} onMouseEnter={() => warmRoute("/login")} onFocus={() => warmRoute("/login")}>
                            连接端点
                        </Link>
                        <Link className="btn-sacred stage-primary-link h-12 px-7" href="/canvas" prefetch={false} onMouseEnter={() => warmRoute("/canvas")} onFocus={() => warmRoute("/canvas")}>
                            <span>进入工作台</span>
                            <ArrowRight className="relative z-[1] size-4" />
                        </Link>
                    </div>

                    <nav className="stage-reveal stage-delay-nav mt-10 hidden flex-wrap justify-center gap-7 md:flex">
                        {stageNav.map((item) => (
                            <Link key={item.label} href={item.href} prefetch={false} onMouseEnter={() => warmRoute(item.href)} onFocus={() => warmRoute(item.href)} className="sacred-label text-[color:var(--sacred-on-surface-variant)] transition hover:text-[color:var(--sacred-tertiary)]">
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </section>
        </main>
    );
}
