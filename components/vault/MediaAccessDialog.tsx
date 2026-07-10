"use client";

import { Mic, Video, Settings, ExternalLink, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  detectMediaEnvironment,
  getSettingsGuide,
  openSystemSettings,
  type MediaKind,
} from "@/lib/media-permissions";

interface MediaAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: MediaKind;
  blockReason: string | null;
  error: string | null;
  needsSettings: boolean;
  onAllow: () => void;
}

export default function MediaAccessDialog({
  open,
  onOpenChange,
  kind,
  blockReason,
  error,
  needsSettings,
  onAllow,
}: MediaAccessDialogProps) {
  const { t } = useTranslation("common");
  const environment = detectMediaEnvironment();
  const guide = getSettingsGuide(kind, environment);
  const Icon = kind === "video" ? Video : Mic;
  const canRequest = !blockReason && !needsSettings;
  const port = typeof window !== "undefined" ? window.location.port || "3000" : "3000";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-5 text-red-500" />
            {needsSettings || blockReason
              ? guide.title
              : kind === "video"
                ? t("media.accessTitleVideo")
                : t("media.accessTitleAudio")}
          </DialogTitle>
          <DialogDescription>
            {blockReason
              ? blockReason
              : needsSettings
                ? t("media.deniedHint")
                : t("media.allowHint")}
          </DialogDescription>
        </DialogHeader>

        {(error || blockReason) && (
          <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{error || blockReason}</span>
          </div>
        )}

        <ol className="text-muted-foreground list-inside list-decimal space-y-2 text-sm">
          {guide.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>

        {guide.systemLink && (needsSettings || blockReason) && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => openSystemSettings(guide.systemLink!.url)}
          >
            <Settings className="size-4" />
            {guide.systemLink.label}
            <ExternalLink className="ml-auto size-3 opacity-50" />
          </Button>
        )}

        {!environment.isSecureContext && !environment.isLocalhost && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <p className="mb-1 font-medium text-amber-500">{t("media.noPromptTitle")}</p>
            <p className="text-muted-foreground">
              {t("media.noPromptBody")}{" "}
              <a href={`http://localhost:${port}`} className="text-foreground underline">
                localhost:{port}
              </a>
            </p>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {canRequest && (
            <Button className="w-full bg-red-600 text-white hover:bg-red-700" onClick={onAllow}>
              <Icon className="size-4" />
              {t("media.allowAccess")}
            </Button>
          )}
          {(needsSettings || blockReason) && (
            <Button variant="secondary" className="w-full" onClick={() => window.location.reload()}>
              {t("media.refreshAfterSettings")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
