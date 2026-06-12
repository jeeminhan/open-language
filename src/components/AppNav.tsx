"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/vocabulary", label: "Vocabulary" },
  { href: "/grammar", label: "Grammar" },
  { href: "/errors", label: "Errors" },
  { href: "/sessions", label: "Sessions" },
  { href: "/scene", label: "Scene" },
];

export default function AppNav() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-20 -mx-4 mb-6 border-b px-4 backdrop-blur sm:-mx-6 sm:px-6"
      style={{
        borderColor: "var(--border)",
        background: "color-mix(in oklab, var(--bg) 82%, transparent)",
      }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4">
        <Link
          href="/home"
          className="shrink-0 text-base font-semibold tracking-tight transition-opacity hover:opacity-70"
          style={{ color: "var(--text)", fontFamily: "var(--font-caveat)" }}
        >
          open-language
        </Link>

        <nav
          aria-label="Main navigation"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors"
                style={{
                  color: active ? "var(--text)" : "var(--text-dim)",
                  background: active ? "var(--bg-hover)" : "transparent",
                  border: `1px solid ${active ? "var(--border)" : "transparent"}`,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/call"
          className="shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-transform hover:-translate-y-px"
          style={{ background: "var(--gold)", color: "var(--bg)" }}
        >
          Start a call
        </Link>
      </div>
    </header>
  );
}
