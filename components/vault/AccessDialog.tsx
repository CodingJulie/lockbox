"use client";

import { useState } from "react";
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

interface AccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function AccessDialog({ open, onOpenChange, onSuccess }: AccessDialogProps) {
  const { t } = useTranslation("common");
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;

    setLoading(true);
    setError(null);

    const valid = await verifyVaultKey(key.trim());
    if (valid) {
      storeVaultKey(key.trim());
      setKey("");
      onOpenChange(false);
      onSuccess();
    } else {
      setError(t("accessDialog.invalid"));
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
          <DialogDescription>{t("accessDialog.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={t("accessDialog.placeholder")}
            className="font-mono"
            autoComplete="off"
            autoFocus
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading || !key.trim()} className="w-full">
              {loading ? t("accessDialog.checking") : t("accessDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
