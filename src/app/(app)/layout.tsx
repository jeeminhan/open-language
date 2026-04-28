export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-8 w-full">
      <main>{children}</main>
    </div>
  );
}
