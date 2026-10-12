"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { api } from "@/lib/client";
import type { Role } from "@/lib/types";
import { cx } from "./ui";

const HR_NAV = [
  { href: "/admin", label: "Events", match: (p: string) => p === "/admin" || p.startsWith("/admin/events") },
  { href: "/admin/reports", label: "Reports", match: (p: string) => p.startsWith("/admin/reports") },
  { href: "/admin/staff", label: "Staff", match: (p: string) => p.startsWith("/admin/staff") },
  { href: "/scanner", label: "Scanner", match: (p: string) => p.startsWith("/scanner") },
];

export default function AppShell({ user, children, wide }: { user: { name: string; employeeCode: string; role: Role }; children: ReactNode; wide?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = user.role === "HR_ADMIN" ? HR_NAV : [];

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className={cx("mx-auto flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-6", wide ? "max-w-7xl" : "max-w-6xl")}>
          <Link href={user.role === "HR_ADMIN" ? "/admin" : "/scanner"} className="flex items-center gap-2.5 font-display text-[17px] font-extrabold">
            <span className="grid size-8 place-items-center rounded-lg bg-lanyard text-white" aria-hidden>
              <svg viewBox="0 0 20 20" className="size-4" fill="currentColor">
                <rect x="2" y="2" width="6" height="6" rx="1" />
                <rect x="12" y="2" width="6" height="6" rx="1" />
                <rect x="2" y="12" width="6" height="6" rx="1" />
                <rect x="12" y="12" width="3" height="3" />
                <rect x="15" y="15" width="3" height="3" />
              </svg>
            </span>
            <span>Maverick Events</span>
          </Link>
          {nav.length > 0 && (
          <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto sm:flex-1" aria-label="Main">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={n.match(pathname) ? "page" : undefined}
                className={cx(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-[15px] font-semibold",
                  n.match(pathname) ? "bg-lanyard-soft text-lanyard-dark" : "text-muted hover:text-ink",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-right text-sm leading-tight md:block">
              <span className="block font-semibold">{user.name}</span>
              <span className="text-muted">{user.employeeCode}</span>
            </span>
            <button onClick={signOut} className="rounded-lg px-3 py-1.5 text-[15px] font-semibold text-muted hover:bg-canvas hover:text-ink">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className={cx("mx-auto px-4 py-6 sm:px-6 sm:py-8", wide ? "max-w-7xl" : "max-w-6xl")}>{children}</main>
    </div>
  );
}
