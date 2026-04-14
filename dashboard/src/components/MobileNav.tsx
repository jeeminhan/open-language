"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface PrimaryLink {
  href: string;
  label: string;
  icon: string;
  experimental?: boolean;
}

interface SecondaryLink {
  href: string;
  label: string;
  experimental?: boolean;
}

const primaryLinks: PrimaryLink[] = [
  { href: "/chat", label: "Chat", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { href: "/drive", label: "Drive", icon: "M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM15 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM3 17h2 M9 17h6 M19 17h2 M5 13l1.5-5a2 2 0 0 1 1.9-1.4h7.2a2 2 0 0 1 1.9 1.4L19 13", experimental: true },
  { href: "/listen", label: "Listen", icon: "M3 18v-6a9 9 0 0 1 18 0v6 M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" },
  { href: "/dashboard", label: "Progress", icon: "M3 3v18h18 M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" },
];

const secondaryLinks: SecondaryLink[] = [
  { href: "/interests", label: "Interests", experimental: true },
  { href: "/errors", label: "Errors" },
  { href: "/grammar", label: "Grammar" },
  { href: "/pronunciation", label: "Pronunciation", experimental: true },
  { href: "/knowledge", label: "Knowledge Map", experimental: true },
  { href: "/vocabulary", label: "Vocabulary" },
  { href: "/sessions", label: "Sessions" },
  { href: "/fluency", label: "Fluency", experimental: true },
  { href: "/architecture", label: "Architecture", experimental: true },
  { href: "/about", label: "About" },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/admin/status")
      .then((r) => r.json())
      .then((d) => setIsAdmin(!!d.isAdmin))
      .catch(() => {});
  }, []);

  const visiblePrimary = primaryLinks.filter((l) => !l.experimental || isAdmin);
  const visibleSecondary = secondaryLinks.filter((l) => !l.experimental || isAdmin);

  return (
    <>
      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around sm:hidden"
        style={{
          background: "var(--bg-card)",
          borderTop: "1px solid var(--border)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {visiblePrimary.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col items-center justify-center flex-1 py-2 gap-0.5"
              style={{ color: active ? "var(--gold)" : "var(--text-dim)" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={link.icon} />
              </svg>
              <span className="text-[10px] font-medium">{link.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex flex-col items-center justify-center flex-1 py-2 gap-0.5"
          style={{ color: visibleSecondary.some((l) => l.href === pathname) ? "var(--gold)" : "var(--text-dim)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>

      {/* Slide-out menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 sm:hidden"
          onClick={() => setMenuOpen(false)}
          style={{ background: "rgba(0, 0, 0, 0.6)", animation: "fadeIn 0.15s ease-out" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 bottom-0 w-72 max-w-[85vw] flex flex-col"
            style={{
              background: "var(--bg)",
              borderLeft: "1px solid var(--border)",
              animation: "slideInRight 0.2s ease-out",
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <span className="text-sm font-semibold" style={{ color: "var(--text-dim)" }}>
                More
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 -mr-2"
                style={{ color: "var(--text-dim)" }}
                aria-label="Close menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {visibleSecondary.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-3 text-sm transition-colors"
                    style={{
                      color: active ? "var(--gold)" : "var(--text)",
                      background: active ? "var(--bg-hover)" : "transparent",
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
