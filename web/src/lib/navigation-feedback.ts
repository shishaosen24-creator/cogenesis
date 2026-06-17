"use client";

export const ROUTE_TRANSITION_EVENT = "cogenesis:route-transition";

export function showRouteTransitionFeedback() {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(ROUTE_TRANSITION_EVENT));
}
