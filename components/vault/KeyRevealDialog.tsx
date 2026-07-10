"use client";

import { useEffect, useId, useRef, useState } from "react";
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
import { Copy, Check, AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";
import { splitVaultKey } from "@/lib/shamir";
import { copyTextTemporarily } from "@/lib/clipboard-safety";

interface KeyRevealDialogProps {
  open: boolean;
  vaultKey: string;
  onConfirm: () => void;
  title?: string;
  description?: string;
}

export default function KeyRevealDialog({
  open,
  vaultKey,
  onConfirm,
  title,
  description,
}: KeyRevealDialogProps) {
  const { t } = useTranslation("common");
  const savedId = useId();
  const irrecoverableId = useId();
  const splitId = useId();
  const [copied, setCopied] = useState<"full" | 1 | 2 | null>(null);
  const [saved, setSaved] = useState(false);
  const [irrecoverable, setIrrecoverable] = useState(false);
  const [split, setSplit] = useState(false);
  const [shares, setShares] = useState<[string, string] | null>(null);
  const clearClipboardTimer = useRef<number | null>(null);
  const canContinue = saved && irrecoverable;

  useEffect(() => {
    if (open) {
      setCopied(null);
      setSaved(false);
      setIrrecoverable(false);
      setSplit(false);
      setShares(null);
    }
  }, [open, vaultKey]);

  useEffect(() => {
    return () => {
      if (clearClipboardTimer.current != null) {
        window.clearTimeout(clearClipboardTimer.current);
      }
    };
  }, []);

  const handleSplitChange = (enabled: boolean) => {
    setSplit(enabled);
    setCopied(null);
    if (enabled && !shares) setShares(splitVaultKey(vaultKey));
  };

  const handleCopy = async (value: string, which: "full" | 1 | 2) => {
    if (clearClipboardTimer.current != null) {
      window.clearTimeout(clearClipboardTimer.current);
    }
    clearClipboardTimer.current = await copyTextTemporarily(value);
    setCopied(which);
    toast.success(
      which === "full" ? t("keyDialog.copiedToast") : t("keyDialog.copiedShareToast", { n: which })
    );
    toast.warning(t("keyDialog.clipboardCopiedWarning"));
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            {title ?? t("keyDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {split ? t("keyDialog.splitHint") : (description ?? t("keyDialog.description"))}
          </DialogDescription>
        </DialogHeader>

        <label htmlFor={splitId} className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            id={splitId}
            type="checkbox"
            checked={split}
            onChange={(e) => handleSplitChange(e.target.checked)}
            className="border-border mt-1 size-4 rounded accent-red-600"
          />
          <span className="flex items-start gap-2">
            <Users className="mt-0.5 size-4 shrink-0 opacity-70" />
            <span>{t("keyDialog.splitToggle")}</span>
          </span>
        </label>

        {split && shares ? (
          <div className="space-y-3">
            {shares.map((share, index) => {
              const n = (index + 1) as 1 | 2;
              return (
                <div key={n} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                  <p className="text-muted-foreground mb-2 text-xs tracking-wider uppercase">
                    {t("keyDialog.shareLabel", { n })}
                  </p>
                  <p className="font-mono text-sm font-semibold tracking-wide break-all select-all">
                    {share}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => handleCopy(share, n)}
                    className="mt-3 w-full"
                  >
                    {copied === n ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied === n ? t("keyDialog.copied") : t("keyDialog.copyShare", { n })}
                  </Button>
                </div>
              );
            })}
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("keyDialog.clipboardWarning")}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-muted-foreground mb-2 text-xs tracking-wider uppercase">
                {t("keyDialog.yourCode")}
              </p>
              <p className="font-mono text-lg font-semibold tracking-wide break-all select-all">
                {vaultKey}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => handleCopy(vaultKey, "full")}
              className="w-full"
            >
              {copied === "full" ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied === "full" ? t("keyDialog.copied") : t("keyDialog.copy")}
            </Button>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("keyDialog.clipboardWarning")}
            </p>
          </>
        )}

        <div className="space-y-3">
          <label htmlFor={savedId} className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              id={savedId}
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
              className="border-border mt-1 size-4 rounded accent-red-600"
            />
            <span>{t(split ? "keyDialog.confirmSavedSplit" : "keyDialog.confirmSaved")}</span>
          </label>
          <label
            htmlFor={irrecoverableId}
            className="flex cursor-pointer items-start gap-3 text-sm"
          >
            <input
              id={irrecoverableId}
              type="checkbox"
              checked={irrecoverable}
              onChange={(e) => setIrrecoverable(e.target.checked)}
              className="border-border mt-1 size-4 rounded accent-red-600"
            />
            <span>{t("keyDialog.confirm")}</span>
          </label>
        </div>

        <DialogFooter>
          <Button
            onClick={() => canContinue && onConfirm()}
            disabled={!canContinue}
            className="w-full bg-red-600 text-white hover:bg-red-700"
          >
            {t("keyDialog.continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
