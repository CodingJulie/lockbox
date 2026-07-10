"use client";

import { ThemeProvider } from "next-themes";
import SessionGuard from "@/components/vault/SessionGuard";
import ServiceWorkerRegister from "@/components/workers/ServiceWorkerRegister";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="theme">
      <SessionGuard />
      <ServiceWorkerRegister />
      <div className="fixed top-4 right-4 z-50 flex items-center gap-0.5">
        <ThemeSwitcher />
        <LanguageSwitcher />
      </div>
      {children}
    </ThemeProvider>
  );
}
