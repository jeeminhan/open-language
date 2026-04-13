"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/chat", label: "Chat" },
  { href: "/listen", label: "Listen" },
  { href: "/interests", label: "Interests" },
  { href: "/errors", label: "Errors" },
  { href: "/grammar", label: "Grammar" },
  { href: "/pronunciation", label: "Pronunciation" },
  { href: "/knowledge", label: "Knowledge Map" },
  { href: "/vocabulary", label: "Vocabulary" },
  { href: "/sessions", label: "Sessions" },
  { href: "/fluency", label: "Fluency" },
  { href: "/architecture", label: "Architecture" },
  { href: "/about", label: "About" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="hidden sm:flex gap-1 mb-8 overflow-x-auto pb-2 scrollbar-hide">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`whitespace-nowrap ${pathname === link.href ? "active" : ""}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
