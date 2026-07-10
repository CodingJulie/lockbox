"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { KeyRound } from "lucide-react";
import { verifyVaultKey, storeVaultKey } from "@/lib/vault-client";
import { combineVaultKeyShares, looksLikeVaultShare, ShareError } from "@/lib/shamir";

interface AccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function AccessDialog({ open, onOpenChange, onSuccess }: AccessDialogProps) {
  const { t } = useTranslation("common");
  const [key, setKey] = useState("");
  const [share1, setShare1] = useState("");
  const [share2, setShare2] = useState("");
  const [useShares, setUseShares] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setKey("");
      setShare1("");
      setShare2("");
      setUseShares(false);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const canSubmit = useShares ? Boolean(share1.trim() && share2.trim()) : Boolean(key.trim());

  const handleKeyChange = (value: string) => {
    if (!useShares && looksLikeVaultShare(value)) {
      setUseShares(true);
      setShare1(value);
      setKey("");
      setError(null);
      return;
    }
    setKey(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    let vaultKey = key.trim();
    if (useShares) {
      try {
        vaultKey = combineVaultKeyShares(share1, share2);
      } catch (err) {
        setError(
          err instanceof ShareError && err.code === "incomplete"
            ? t("accessDialog.invalid")
            : t("accessDialog.shareMismatch")
        );
        setLoading(false);
        return;
      }
    }

    const result = await verifyVaultKey(vaultKey);
    if (result.ok) {
      storeVaultKey(vaultKey, { role: result.role, permissions: result.permissions });
      onOpenChange(false);
      onSuccess();
    } else {
      setError(
        result.reason === "rate_limited"
          ? t("accessDialog.tooManyAttempts")
          : t("accessDialog.invalid")
      );
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5" />
            {t("accessDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {useShares ? t("accessDialog.sharesDescription") : t("accessDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {useShares ? (
            <>
              <Input
                value={share1}
                onChange={(e) => setShare1(e.target.value)}
                placeholder={t("accessDialog.sharePlaceholder", { n: 1 })}
                className="font-mono"
                autoComplete="off"
                autoFocus
                aria-label={t("accessDialog.sharePlaceholder", { n: 1 })}
              />
              <Input
                value={share2}
                onChange={(e) => setShare2(e.target.value)}
                placeholder={t("accessDialog.sharePlaceholder", { n: 2 })}
                className="font-mono"
                autoComplete="off"
                aria-label={t("accessDialog.sharePlaceholder", { n: 2 })}
              />
            </>
          ) : (
            <Input
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder={t("accessDialog.placeholder")}
              className="font-mono"
              autoComplete="off"
              autoFocus
            />
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
            onClick={() => {
              setUseShares((current) => !current);
              setError(null);
            }}
          >
            {useShares ? t("accessDialog.useSingle") : t("accessDialog.useShares")}
          </button>
          <DialogFooter>
            <Button type="submit" disabled={loading || !canSubmit} className="w-full">
              {loading ? t("accessDialog.checking") : t("accessDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
