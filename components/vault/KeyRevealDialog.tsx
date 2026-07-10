"use client";

import { useState } from "react";
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
import { Copy, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface KeyRevealDialogProps {
  open: boolean;
  vaultKey: string;
  onConfirm: () => void;
}

export default function KeyRevealDialog({ open, vaultKey, onConfirm }: KeyRevealDialogProps) {
  const { t } = useTranslation("common");
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(vaultKey);
    setCopied(true);
    toast.success(t("keyDialog.copiedToast"));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            {t("keyDialog.title")}
          </DialogTitle>
          <DialogDescription>{t("keyDialog.description")}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-muted-foreground mb-2 text-xs tracking-wider uppercase">
            {t("keyDialog.yourCode")}
          </p>
          <p className="font-mono text-lg font-semibold tracking-wide break-all select-all">
            {vaultKey}
          </p>
        </div>

        <Button variant="outline" onClick={handleCopy} className="w-full">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? t("keyDialog.copied") : t("keyDialog.copy")}
        </Button>

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="border-border mt-1 size-4 rounded accent-red-600"
          />
          <span>{t("keyDialog.confirm")}</span>
        </label>

        <DialogFooter>
          <Button
            onClick={() => confirmed && onConfirm()}
            disabled={!confirmed}
            className="w-full bg-red-600 text-white hover:bg-red-700"
          >
            {t("keyDialog.continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
