"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const HOME_STAGE_FALLBACK_MS = 6500;
const HOME_STAGE_PLAY_REJECT_MS = 900;
const HOME_STAGE_BOOT_DELAY_MS = 220;

type NavigatorWithConnection = Navigator & { connection?: { saveData?: boolean } };

function revealStage() {
    document.documentElement.classList.add("sacred-stage-complete");
    window.dispatchEvent(new Event("sacred-stage-complete"));
}

export function SacredBackdrop() {
    const pathname = usePathname();
    const isHome = pathname === "/";
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [homeVideoReady, setHomeVideoReady] = useState(false);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle("sacred-stage-home", isHome);
        root.classList.remove("sacred-stage-complete");
        if (!isHome) revealStage();
        setHomeVideoReady(false);

        return () => {
            root.classList.remove("sacred-stage-home", "sacred-stage-complete");
        };
    }, [isHome, pathname]);

    useEffect(() => {
        if (!isHome) return;
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const saveData = Boolean((navigator as NavigatorWithConnection).connection?.saveData);
        if (reduceMotion || saveData) {
            revealStage();
            return;
        }
        const timer = window.setTimeout(() => setHomeVideoReady(true), HOME_STAGE_BOOT_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [isHome, pathname]);

    useEffect(() => {
        if (!isHome || !homeVideoReady) return;
        const video = videoRef.current;
        if (!video) return;
        let playRejectedTimer: number | null = null;
        const fallbackTimer = window.setTimeout(revealStage, HOME_STAGE_FALLBACK_MS);
        const handleEnded = () => {
            video.pause();
            revealStage();
        };
        const handleError = () => revealStage();
        const handleStalled = () => {
            if (!video.paused && video.currentTime > 0) return;
            revealStage();
        };
        video.addEventListener("ended", handleEnded);
        video.addEventListener("error", handleError);
        video.addEventListener("stalled", handleStalled);
        video.addEventListener("abort", handleError);
        video.addEventListener("emptied", handleError);
        if (video.ended) handleEnded();
        void video.play().catch(() => {
            playRejectedTimer = window.setTimeout(revealStage, HOME_STAGE_PLAY_REJECT_MS);
        });
        return () => {
            window.clearTimeout(fallbackTimer);
            if (playRejectedTimer) window.clearTimeout(playRejectedTimer);
            video.removeEventListener("ended", handleEnded);
            video.removeEventListener("error", handleError);
            video.removeEventListener("stalled", handleStalled);
            video.removeEventListener("abort", handleError);
            video.removeEventListener("emptied", handleError);
        };
    }, [homeVideoReady, isHome, pathname]);

    return (
        <div className={`sacred-backdrop ${isHome ? "is-home" : "is-static"}`} aria-hidden>
            {isHome && homeVideoReady ? (
                <video
                    ref={videoRef}
                    className="sacred-backdrop-media"
                    poster="/brand/sacred-stage-first.jpg"
                    muted
                    playsInline
                    preload="metadata"
                >
                    <source src="/brand/sacred-stage-h264.mp4" type="video/mp4" />
                </video>
            ) : (
                <img className="sacred-backdrop-media" src={isHome ? "/brand/sacred-stage-first.jpg" : "/brand/sacred-stage-final.jpg"} alt="" />
            )}
            <div className="sacred-backdrop-vignette" />
        </div>
    );
}
