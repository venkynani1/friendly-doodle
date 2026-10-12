"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import type { EventStatus, Stage } from "@/lib/types";
import { STAGE_LABEL } from "@/lib/types";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-lanyard text-white hover:bg-lanyard-dark disabled:bg-lanyard/50",
  secondary: "bg-surface text-ink border border-line hover:border-ink/40 disabled:text-muted",
  ghost: "text-lanyard hover:bg-lanyard-soft disabled:text-muted",
  danger: "bg-surface text-bad border border-bad/40 hover:bg-bad-soft disabled:opacity-50",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }>(
  function Button({ variant = "primary", busy, className, children, disabled, ...rest }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || busy}
        className={cx(
          "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed",
          variants[variant],
          className,
        )}
        {...rest}
      >
        {busy && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
        {children}
      </button>
    );
  },
);

export function ButtonLink({ href, variant = "primary", className, children, ...rest }: { href: string; variant?: Variant; className?: string; children: ReactNode; download?: boolean | string; target?: string }) {
  return (
    <Link
      href={href}
      className={cx("inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[15px] font-semibold transition-colors", variants[variant], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[13px] text-muted">{hint}</p>}
      {error && <p className="text-[13px] font-medium text-bad">{error}</p>}
    </div>
  );
}

const inputBase =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-muted/70 focus:border-lanyard focus:outline-none focus:ring-2 focus:ring-lanyard/25";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputBase, className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputBase, "pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "ok" | "bad" | "warn"; children: ReactNode; className?: string }) {
  const tones = {
    info: "bg-lanyard-soft text-lanyard-dark",
    ok: "bg-ok-soft text-ok",
    bad: "bg-bad-soft text-bad",
    warn: "bg-warn-soft text-warn",
  };
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cx("rounded-lg px-4 py-3 text-[15px] font-medium", tones[tone], className)}>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: EventStatus }) {
  const map = {
    DRAFT: { label: "Not open yet", cls: "bg-warn-soft text-warn" },
    OPEN: { label: "Live", cls: "bg-ok-soft text-ok" },
    COMPLETED: { label: "Completed", cls: "bg-canvas text-muted border border-line" },
  } as const;
  const s = map[status];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-semibold", s.cls)}>
      {status === "OPEN" && <span className="size-1.5 rounded-full bg-ok" aria-hidden />}
      {s.label}
    </span>
  );
}

export const stageColor: Record<Stage, string> = {
  ENTRY: "var(--color-stage-entry)",
  FOOD: "var(--color-stage-food)",
  GOODIES: "var(--color-stage-goodies)",
};

export function StageChip({ stage, done }: { stage: Stage; done?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[13px] font-semibold"
      style={{
        color: done === false ? "var(--color-muted)" : stageColor[stage],
        background: done === false ? "var(--color-canvas)" : `color-mix(in srgb, ${stageColor[stage]} 12%, white)`,
      }}
    >
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-muted" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-lanyard border-r-transparent" aria-hidden />
      {label}…
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("min-w-0 rounded-xl border border-line bg-surface", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
