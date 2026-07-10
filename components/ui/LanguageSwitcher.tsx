"use client";

import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import type { AppLanguage } from "@/lib/detect-locale";

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation("common");
  const locale = i18n.language as AppLanguage;

  const toggle = () => {
    const next: AppLanguage = locale === "ru" ? "en" : "ru";
    void i18n.changeLanguage(next);
    localStorage.setItem("i18nextLng", next);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="text-muted-foreground hover:text-foreground gap-1.5"
      aria-label={t("lang.switch")}
    >
      <Globe className="size-4" />
      <span className="text-xs font-medium uppercase">{locale}</span>
    </Button>
  );
}
