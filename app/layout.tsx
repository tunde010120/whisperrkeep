import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/layout/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Whisperrkeep",
  description: "Secure password management application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased bg-background text-foreground`}
      >
        <Providers>
          <div className="min-h-screen w-full">
            <AppShell>{children}</AppShell>
          </div>
        </Providers>
      </body>
    </html>
  );
}
