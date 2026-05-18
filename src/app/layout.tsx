import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loombus",
  description: "Signal over noise.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">
        <header className="border-b border-zinc-900">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Loombus
            </Link>

            <nav className="flex items-center gap-6 text-sm text-zinc-400">
              <Link href="/discussions" className="transition hover:text-white">
                Discussions
              </Link>

              <Link href="/create" className="transition hover:text-white">
                Create
              </Link>

              <Link href="/dashboard" className="transition hover:text-white">
                Dashboard
              </Link>

              <Link href="/saved" className="transition hover:text-white">
                Saved
              </Link>

              <Link href="/people" className="transition hover:text-white">
                People
              </Link>

              <Link href="/profile" className="transition hover:text-white">
                Profile
              </Link>

              <Link href="/login" className="transition hover:text-white">
                Login
              </Link>

              <Link href="/signup" className="transition hover:text-white">
                Join
              </Link>
            </nav>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
