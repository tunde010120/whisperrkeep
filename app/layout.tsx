import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/layout/AppShell";
import { Box } from "@mui/material";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WhisperrKeep - Premium Password Vault",
  description: "Secure, simple password management for individuals and teams. Your digital life, protected.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <Box sx={{ minHeight: '100vh', width: '100%' }}>
            <AppShell>{children}</AppShell>
          </Box>
        </Providers>
      </body>
    </html>
  );
}
