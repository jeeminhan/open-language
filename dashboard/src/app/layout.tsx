import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import LearnerSwitcher from "@/components/LearnerSwitcher";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Voice Tutor Dashboard",
  description: "Track your language learning progress",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="max-w-6xl mx-auto px-6 py-8 w-full">
          <header className="mb-2 flex items-center justify-between">
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "var(--gold)" }}
            >
              Voice Tutor
            </h1>
            <LearnerSwitcher />
          </header>
          <Nav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
