import Link from "next/link";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
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
  title: "Channel Q&A Tool",
  description: "Programming discussion platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  const user = token ? verifyToken(token) : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-white">
        <header className="border-b border-slate-800 bg-slate-900 text-slate-100">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold hover:text-blue-400">
              Channel Q&A
            </Link>

            <div className="flex items-center gap-4 text-sm">
              <Link href="/channels" className="hover:text-blue-400">
                Channels
              </Link>

              <Link href="/search" className="hover:text-blue-400">
                Search
              </Link>

              {user ? (
                <>
                  <span className="text-slate-400">{user.email}</span>

                  <form action="/api/auth/logout" method="POST">
                    <button className="rounded bg-red-600 px-3 py-1 hover:bg-red-500">
                      Logout
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded border border-slate-700 px-3 py-1 hover:bg-slate-800"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded bg-blue-600 px-3 py-1 hover:bg-blue-500"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
