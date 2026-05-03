"use client";

import { useEffect, useState } from "react";

type Appearance = "auto" | "light" | "dark";

function resolve(value: Appearance): "light" | "dark" {
  if (value === "light" || value === "dark") return value;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export function AppearanceToggle() {
  const [appearance, setAppearance] = useState<Appearance>("auto");
  const [hover, setHover] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem("sotama:appearance");
    if (stored === "light" || stored === "dark" || stored === "auto") {
      setAppearance(stored);
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (appearance === "auto") {
      root.removeAttribute("data-appearance");
    } else {
      root.setAttribute("data-appearance", appearance);
    }
    window.localStorage.setItem("sotama:appearance", appearance);
  }, [appearance, mounted]);

  const effective: "light" | "dark" =
    appearance === "auto" ? (systemDark ? "dark" : "light") : appearance;
  const isDark = effective === "dark";
  const next: Appearance = isDark ? "light" : "dark";
  const label = isDark ? "Switch to Light mode" : "Switch to Dark mode";

  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: "2.375rem",
          height: "2.375rem",
          borderRadius: "999px",
          background: "var(--slot-fill)",
          boxShadow: "var(--slot-shadow)",
        }}
      />
    );
  }

  return (
    <button
      onClick={() => setAppearance(next)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={label}
      title={label}
      style={{
        width: "2.375rem",
        height: "2.375rem",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "999px",
        background: hover ? "var(--slot-fill-hover)" : "var(--slot-fill)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        boxShadow: "var(--slot-shadow)",
        color: "var(--label-primary)",
        transition: "background 160ms ease, transform 160ms ease",
        transform: hover ? "scale(1.04)" : "scale(1)",
      }}
    >
      {isDark ? (
        <svg width="1.25em" height="1.25em" viewBox="0 0 19.6289 19.3848" fill="currentColor" aria-hidden="true">
          <path d="M15.1074 13.0859C9.82422 13.0859 6.44531 9.77539 6.44531 4.48242C6.44531 3.38867 6.70898 1.82617 7.06055 1.01562C7.14844 0.791016 7.16797 0.654297 7.16797 0.556641C7.16797 0.292969 6.97266 0 6.5918 0C6.48438 0 6.25 0.0292969 6.03516 0.107422C2.42188 1.55273 0 5.43945 0 9.53125C0 15.2734 4.375 19.375 10.0977 19.375C14.3066 19.375 17.9492 16.8262 19.1602 13.6426C19.248 13.418 19.2676 13.1836 19.2676 13.0957C19.2676 12.7344 18.9648 12.4902 18.6914 12.4902C18.5645 12.4902 18.457 12.5195 18.2715 12.5781C17.5195 12.8223 16.3086 13.0859 15.1074 13.0859Z" />
        </svg>
      ) : (
        <svg width="1.25em" height="1.25em" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="3" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 1.5 V3" />
            <path d="M8 13 V14.5" />
            <path d="M1.5 8 H3" />
            <path d="M13 8 H14.5" />
            <path d="M3.4 3.4 L4.5 4.5" />
            <path d="M11.5 11.5 L12.6 12.6" />
            <path d="M3.4 12.6 L4.5 11.5" />
            <path d="M11.5 4.5 L12.6 3.4" />
          </g>
        </svg>
      )}
    </button>
  );
}
