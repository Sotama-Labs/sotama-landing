"use client";

import { useEffect, useRef, useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; alreadyOn: boolean; count: number }
  | { kind: "error"; message: string };

export function WaitlistForm({
  initialCount,
  initialJoined = false,
}: {
  initialCount: number;
  initialJoined?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [state, setState] = useState<State>(
    initialJoined
      ? { kind: "success", alreadyOn: true, count: initialCount }
      : { kind: "idle" },
  );
  const [count, setCount] = useState(initialCount);
  const [focused, setFocused] = useState(false);
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Refresh count once on mount in case the SSR value is stale.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/waitlist", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.count === "number") {
          setCount(data.count);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === "submitting") return;

    const trimmed = email.trim();
    if (!trimmed || trimmed.length > 254 || !EMAIL_RE.test(trimmed)) {
      setState({ kind: "error", message: "Enter a valid email" });
      inputRef.current?.focus();
      return;
    }

    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, hp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: data?.error ?? "Something went wrong" });
        return;
      }
      setCount(data.count ?? count);
      setState({ kind: "success", alreadyOn: data.added === false, count: data.count });
    } catch {
      setState({ kind: "error", message: "Network hiccup. Try again." });
    }
  }

  const isSubmitting = state.kind === "submitting";
  const isSuccess = state.kind === "success";
  const isError = state.kind === "error";

  if (isSuccess) {
    return (
      <div
        className="pop-in"
        style={{
          width: "100%",
          maxWidth: "30rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.25rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.625rem",
            padding: "0.625rem 1rem",
            borderRadius: "999px",
            background: "var(--material-chrome)",
            backdropFilter: "saturate(180%) blur(40px)",
            WebkitBackdropFilter: "saturate(180%) blur(40px)",
            border: "0.5px solid var(--separator)",
            boxShadow: "var(--shadow-1)",
          }}
        >
          <span
            style={{
              width: "0.5rem",
              height: "0.5rem",
              borderRadius: "999px",
              background: "var(--sotama-orange)",
              boxShadow: "0 0 12px var(--sotama-orange-glow)",
            }}
          />
          <span className="hig-subheadline" style={{ fontWeight: 600 }}>
            {state.alreadyOn ? "You're already on the list" : "You're on the list"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setEmail("");
            setState({ kind: "idle" });
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          className="hig-subheadline"
          style={{
            color: "var(--accent)",
            fontWeight: 600,
            letterSpacing: "-0.014em",
            padding: "0.5rem 0.75rem",
            borderRadius: "var(--radius-control-m)",
            transition: "opacity 160ms ease",
          }}
        >
          Join waitlist with another email address
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ width: "100%", maxWidth: "30rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}
      noValidate
    >
      {/* Honeypot — hidden from real users, attractive to bots. */}
      <label
        aria-hidden="true"
        style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}
      >
        Leave blank
        <input
          tabIndex={-1}
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
        />
      </label>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.375rem 0.375rem 0.375rem 1rem",
          background: "var(--slot-fill)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderRadius: "999px",
          boxShadow: focused
            ? "var(--slot-shadow), 0 0 0 4px var(--accent-fill)"
            : "var(--slot-shadow)",
          transition: "box-shadow 200ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <input
          ref={inputRef}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@domain.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={isSubmitting}
          aria-label="Email address"
          aria-invalid={isError}
          className="hig-body"
          style={{
            flex: 1,
            minWidth: 0,
            padding: "0.625rem 0",
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--label-primary)",
            fontSize: "1.0625rem",
            lineHeight: "1.375rem",
          }}
        />

        <button
          type="submit"
          disabled={isSubmitting || email.length === 0}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className="hig-headline"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4375rem",
            padding: "0.625rem 1rem",
            background: "var(--accent)",
            color: "white",
            borderRadius: "999px",
            fontWeight: 600,
            letterSpacing: "-0.014em",
            boxShadow: hover && !isSubmitting
              ? "0 0 0 0.5px rgba(0,0,0,0.10), 0 4px 14px var(--accent-fill), inset 0 1px 0 rgba(255,255,255,0.18)"
              : "0 0 0 0.5px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.18)",
            opacity: isSubmitting || email.length === 0 ? 0.6 : 1,
            cursor: isSubmitting || email.length === 0 ? "not-allowed" : "pointer",
            transition: "box-shadow 180ms ease, transform 180ms ease, opacity 200ms ease",
            transform: hover && !isSubmitting && email.length > 0 ? "translateY(-0.5px)" : "translateY(0)",
            whiteSpace: "nowrap",
          }}
        >
          {isSubmitting ? (
            <Spinner />
          ) : (
            <>
              Join waitlist
              <Arrow />
            </>
          )}
        </button>
      </div>

      <div
        role={isError ? "alert" : undefined}
        aria-live="polite"
        style={{
          minHeight: "1.125rem",
          textAlign: "center",
          color: isError ? "var(--red)" : "var(--label-tertiary)",
          fontFamily: isError ? "var(--hig-font)" : "var(--hig-mono)",
          letterSpacing: isError ? "-0.008em" : "0.02em",
          transition: "color 160ms ease",
        }}
        className="hig-footnote"
      >
        {isError
          ? state.message
          : "Be the first in line."}
      </div>
    </form>
  );
}

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M3 7 H11 M7.5 3.5 L11 7 L7.5 10.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="spinner" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.6" />
      <path
        d="M12 7 A5 5 0 0 0 7 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
