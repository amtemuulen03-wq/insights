import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import AppShell from "./components/app-shell";
import PasswordGate from "./components/password-gate";
import {
  configuredInsightPassword,
  hasValidInsightSession,
  INSIGHT_COOKIE_NAME,
} from "./lib/insight-auth";
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
  title: "Insights Dashboard",
  description: "Digital marketing performance dashboard",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const password = configuredInsightPassword();
  const initialAuthenticated = hasValidInsightSession(
    cookieStore.get(INSIGHT_COOKIE_NAME)?.value,
    password,
  );

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <PasswordGate initialAuthenticated={initialAuthenticated}>
          <AppShell>{children}</AppShell>
        </PasswordGate>
      </body>
    </html>
  );
}
