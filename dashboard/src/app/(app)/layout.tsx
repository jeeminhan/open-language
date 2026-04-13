import Nav from "@/components/Nav";
import MobileNav from "@/components/MobileNav";
import LearnerSwitcher from "@/components/LearnerSwitcher";
import SignOutButton from "@/components/SignOutButton";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-8 w-full pb-20 sm:pb-8">
      <header
        className="mb-3 sm:mb-2 flex items-center justify-between gap-2 sticky top-0 z-30 py-2 sm:py-0 sm:static"
        style={{ background: "var(--bg)" }}
      >
        <h1
          className="text-lg sm:text-2xl font-bold tracking-tight shrink-0"
          style={{ color: "var(--gold)" }}
        >
          <a href="/" style={{ textDecoration: "none", color: "inherit" }}>
            open-language
          </a>
        </h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <LearnerSwitcher />
          <SignOutButton />
        </div>
      </header>
      <Nav />
      <main>{children}</main>
      <MobileNav />
    </div>
  );
}
