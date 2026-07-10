"use client";

import { useEffect, useState } from "react";
import { Shield, KeyRound } from "lucide-react";
import HeroButton from "@/components/home/HeroButton";
import { Button } from "@/components/ui/Button";
import KeyRevealDialog from "@/components/vault/KeyRevealDialog";
import AccessDialog from "@/components/vault/AccessDialog";
import VaultDashboard from "@/components/vault/VaultDashboard";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { AppLanguage } from "@/lib/detect-locale";
import { createVault, storeVaultKey, getStoredVaultKey, verifyVaultKey } from "@/lib/vault-client";

export default function HomePage() {
  const { t, i18n } = useTranslation("common");
  const locale = i18n.language as AppLanguage;
  const [hasVault, setHasVault] = useState(false);
  const [checking, setChecking] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [showAccessDialog, setShowAccessDialog] = useState(false);
  const [newKey, setNewKey] = useState("");

  useEffect(() => {
    const key = getStoredVaultKey();
    if (key) {
      verifyVaultKey(key).then((valid) => {
        setHasVault(valid);
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, []);

  const handleCreateVault = async () => {
    setCreating(true);
    try {
      const { key } = await createVault(locale);
      setNewKey(key);
      setShowKeyDialog(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.createError"));
    } finally {
      setCreating(false);
    }
  };

  const handleKeyConfirmed = () => {
    storeVaultKey(newKey);
    setShowKeyDialog(false);
    setHasVault(true);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
      </div>
    );
  }

  if (hasVault) {
    return <VaultDashboard onLogout={() => setHasVault(false)} />;
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.08)_0%,transparent_65%)]"
        aria-hidden
      />

      <div className="relative mb-12 space-y-3 text-center">
        <div className="mb-4 flex items-center justify-center gap-2">
          <Shield className="size-6 text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]" />
          <span className="font-heading text-xl font-semibold tracking-tight">{t("app.name")}</span>
        </div>
        <h1 className="font-heading text-foreground max-w-sm text-3xl leading-snug font-medium sm:text-4xl">
          {t("app.tagline")}
        </h1>
        <p className="text-muted-foreground mx-auto max-w-xs text-sm leading-relaxed tracking-wide">
          {t("app.description")}
        </p>
      </div>

      <HeroButton
        onClick={handleCreateVault}
        loading={creating}
        disabled={creating}
        label={t("app.createVault")}
        ariaLabel={t("app.createVaultAria")}
      />

      <p className="text-muted-foreground mt-8 max-w-xs text-center text-xs">{t("app.heroHint")}</p>

      <Button
        type="button"
        variant="outline"
        className="text-foreground/90 hover:text-foreground mt-6 border-white/15 bg-white/[0.04] px-5 shadow-sm hover:border-red-500/35 hover:bg-red-500/10"
        onClick={() => setShowAccessDialog(true)}
      >
        <KeyRound className="size-4 opacity-80" />
        {t("app.hasCode")}
      </Button>

      <KeyRevealDialog open={showKeyDialog} vaultKey={newKey} onConfirm={handleKeyConfirmed} />

      <AccessDialog
        open={showAccessDialog}
        onOpenChange={setShowAccessDialog}
        onSuccess={() => setHasVault(true)}
      />
    </div>
  );
}
