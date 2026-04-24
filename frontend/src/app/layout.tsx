import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DesktopSidebar, MobileSidebar } from "@/components/sidebar";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Job Hunter",
  description:
    "AI-powered job hunting assistant with smart matching, outreach, and career tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="gradient-bg min-h-full">
        <AuthProvider>
          <div className="flex h-screen overflow-hidden">
            <DesktopSidebar />

            <div className="flex flex-1 flex-col overflow-hidden">
              <header className="flex h-14 items-center gap-3 border-b border-glass-border px-4 lg:hidden">
                <MobileSidebar />
                <span className="text-sm font-semibold tracking-tight">
                  AI Job Hunter
                </span>
              </header>

              <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
                {children}
              </main>
            </div>
          </div>
          <Toaster theme="dark" position="top-right" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  );
}
