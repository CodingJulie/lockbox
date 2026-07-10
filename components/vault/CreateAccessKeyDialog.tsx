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
import { Loader2, Scale } from "lucide-react";
import {
  ACCESS_KEY_PRESETS,
  DEFAULT_ACCESS_KEY_EXPIRY_DAYS,
  type AccessKeyExpiryDays,
  type AccessKeyPreset,
} from "@/lib/vault-permissions";
import { createAccessKey } from "@/lib/vault-client";
import type { AppLanguage } from "@/lib/detect-locale";

interface CreateAccessKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (key: string) => void;
}

const EXPIRY_OPTIONS: Array<{ value: AccessKeyExpiryDays | null; labelKey: string }> = [
  { value: 7, labelKey: "accessKeys.days7" },
  { value: 30, labelKey: "accessKeys.days30" },
  { value: 90, labelKey: "accessKeys.days90" },
  { value: null, labelKey: "accessKeys.never" },
];

export default function CreateAccessKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateAccessKeyDialogProps) {
  const { t, i18n } = useTranslation("common");
  const [preset, setPreset] = useState<AccessKeyPreset>("lawyer");
  const [expiresInDays, setExpiresInDays] = useState<AccessKeyExpiryDays | null>(
    DEFAULT_ACCESS_KEY_EXPIRY_DAYS
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const { key } = await createAccessKey({
        permissions: ACCESS_KEY_PRESETS[preset].permissions,
        expiresInDays,
        locale: i18n.language as AppLanguage,
      });
      setPreset("lawyer");
      setExpiresInDays(DEFAULT_ACCESS_KEY_EXPIRY_DAYS);
      onOpenChange(false);
      onCreated(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("toast.createKeyError"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="size-5" />
            {t("accessKeys.createTitle")}
          </DialogTitle>
          <DialogDescription>{t("accessKeys.createDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-muted-foreground text-xs tracking-wider uppercase">
            {t("accessKeys.permissions")}
          </p>
          {(Object.keys(ACCESS_KEY_PRESETS) as AccessKeyPreset[]).map((id) => {
            const selected = preset === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => setPreset(id)}
                className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                  selected
                    ? "border-red-500/60 bg-red-500/10"
                    : "border-border hover:border-red-500/30"
                }`}
              >
                <p className="text-sm font-medium">
                  {id === "lawyer" ? t("accessKeys.presetLawyer") : t("accessKeys.presetUpload")}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {id === "lawyer"
                    ? t("accessKeys.presetLawyerHint")
                    : t("accessKeys.presetUploadHint")}
                </p>
              </button>
            );
          })}
        </div>

        <label className="space-y-2">
          <span className="text-muted-foreground text-xs tracking-wider uppercase">
            {t("accessKeys.expires")}
          </span>
          <select
            value={expiresInDays === null ? "never" : String(expiresInDays)}
            onChange={(e) => {
              const value = e.target.value;
              setExpiresInDays(value === "never" ? null : (Number(value) as AccessKeyExpiryDays));
            }}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3"
          >
            {EXPIRY_OPTIONS.map((option) => (
              <option
                key={String(option.value)}
                value={option.value === null ? "never" : option.value}
              >
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button onClick={handleCreate} disabled={creating} className="w-full">
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Scale className="size-4" />}
            {creating ? t("accessKeys.creating") : t("accessKeys.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
