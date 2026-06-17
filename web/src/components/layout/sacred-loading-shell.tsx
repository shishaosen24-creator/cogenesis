"use client";

type SacredLoadingShellProps = {
    title: string;
    subtitle: string;
    eyebrow?: string;
};

export function SacredLoadingShell({ title, subtitle, eyebrow = "CoGenesis" }: SacredLoadingShellProps) {
    return (
        <main className="sacred-page-shell flex h-full items-center justify-center overflow-hidden px-6 py-10 text-[color:var(--sacred-on-surface)]">
            <div className="portal-glass relative w-full max-w-[760px] overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
                <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(233,193,118,.75),transparent)]" />
                <div className="mx-auto flex max-w-[540px] flex-col items-center text-center">
                    <img src="/brand/site-logo-transparent.png" alt="CoGenesis" className="size-16 object-contain drop-shadow-[0_0_18px_rgba(197,160,89,0.35)] sm:size-20" />
                    <div className="sacred-label mt-5">{eyebrow}</div>
                    <h1 className="sacred-title mt-3 text-3xl font-semibold sm:text-4xl">{title}</h1>
                    <p className="mt-3 max-w-[42rem] text-sm leading-7 text-[color:var(--sacred-on-surface-variant)] sm:text-base">{subtitle}</p>

                    <div className="mt-8 grid w-full gap-3">
                        <div className="h-3 rounded-full bg-[rgba(233,193,118,0.16)]" />
                        <div className="grid grid-cols-[1.4fr_0.8fr_1fr] gap-3">
                            <div className="h-24 rounded-2xl border border-[rgba(233,193,118,0.18)] bg-[rgba(255,255,255,0.04)]" />
                            <div className="h-24 rounded-2xl border border-[rgba(233,193,118,0.14)] bg-[rgba(255,255,255,0.03)]" />
                            <div className="h-24 rounded-2xl border border-[rgba(233,193,118,0.1)] bg-[rgba(255,255,255,0.025)]" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="h-12 rounded-xl border border-[rgba(233,193,118,0.15)] bg-[rgba(255,255,255,0.04)]" />
                            <div className="h-12 rounded-xl border border-[rgba(233,193,118,0.15)] bg-[rgba(255,255,255,0.04)]" />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
