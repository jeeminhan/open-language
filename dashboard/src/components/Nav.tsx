"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavLink {
  href: string;
  label: string;
  experimental?: boolean;
}

const links: NavLink[] = [
  { href: "/dashboard", label: "Progress" },
  { href: "/chat", label: "Chat" },
  { href: "/drive", label: "Drive", experimental: true },
  { href: "/listen", label: "Listen" },
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

export default function Nav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/admin/status")
      .then((r) => r.json())
      .then((d) => setIsAdmin(!!d.isAdmin))
      .catch(() => {});
  }, []);

  const visible = links.filter((l) => !l.experimental || isAdmin);

  return (
    <nav className="hidden sm:flex gap-1 mb-8 overflow-x-auto pb-2 scrollbar-hide">
      {visible.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`whitespace-nowrap ${pathname === link.href ? "active" : ""}`}
          title={link.experimental ? "Experimental (admin)" : undefined}
        >
          {link.label}
          {link.experimental && (
            <span className="ml-1 text-[10px] opacity-60">·exp</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
