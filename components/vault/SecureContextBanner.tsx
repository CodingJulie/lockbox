"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { detectMediaEnvironment, getEnvironmentBlockReason } from "@/lib/media-permissions";

export default function SecureContextBanner() {
  const { t } = useTranslation("common");
  const env = detectMediaEnvironment();
  const reason = getEnvironmentBlockReason(env);

  if (!reason) return null;

  const port = typeof window !== "undefined" ? window.location.port || "3000" : "3000";

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
      <div className="space-y-1">
        <p className="font-medium text-amber-500">{t("media.secureBannerTitle")}</p>
        <p className="text-muted-foreground">{reason}</p>
        <a
          href={`http://localhost:${port}`}
          className="text-foreground mt-1 inline-block underline underline-offset-2"
        >
          {t("media.secureBannerLink")}:{port}
        </a>
      </div>
    </div>
  );
}
