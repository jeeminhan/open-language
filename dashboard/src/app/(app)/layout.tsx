import Nav from "@/components/Nav";
import LearnerSwitcher from "@/components/LearnerSwitcher";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8 w-full">
      <header className="mb-2 flex items-center justify-between">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--gold)" }}
        >
          <a href="/" style={{ textDecoration: "none", color: "inherit" }}>
            open-language
          </a>
        </h1>
        <LearnerSwitcher />
      </header>
      <Nav />
      <main>{children}</main>
    </div>
  );
}
