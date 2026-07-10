"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";

const THEMES = ["system", "light", "dark"] as const;
type Theme = (typeof THEMES)[number];

const themeIcons = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} as const;

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation("common");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = ((mounted ? theme : undefined) ?? "system") as Theme;
  const Icon = themeIcons[active] ?? Monitor;
  const labelKey =
    active === "light" ? "theme.light" : active === "dark" ? "theme.dark" : "theme.system";

  const cycle = () => {
    const idx = THEMES.indexOf(active);
    const next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycle}
      disabled={!mounted}
      className="text-muted-foreground hover:text-foreground gap-1.5"
      aria-label={t("theme.switch")}
      title={mounted ? t(labelKey) : undefined}
    >
      <Icon className="size-4" />
    </Button>
  );
}
