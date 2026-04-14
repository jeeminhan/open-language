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
  { href: "/vocabulary", label: "Vocab", icon: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" },
  { href: "/grammar", label: "Grammar", icon: "M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2 M9 20h6 M12 4v16" },
];

const secondaryLinks: SecondaryLink[] = [
  { href: "/drive", label: "Drive", experimental: true },
  { href: "/listen", label: "Listen" },
  { href: "/dashboard", label: "Progress" },
  { href: "/interests", label: "Interests", experimental: true },
  { href: "/errors", label: "Errors" },
  { href: "/pronunciation", label: "Pronunciation", experimental: true },
  { href: "/knowledge", label: "Knowledge Map", experimental: true },
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
