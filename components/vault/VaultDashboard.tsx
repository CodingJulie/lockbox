"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import {
  Upload,
  Mic,
  Video,
  FileText,
  Download,
  LogOut,
  Loader2,
  File,
  RefreshCw,
  Scale,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import RecordCard from "@/components/vault/RecordCard";
import InstallPrompt from "@/components/vault/InstallPrompt";
import SecureContextBanner from "@/components/vault/SecureContextBanner";
import CreateAccessKeyDialog from "@/components/vault/CreateAccessKeyDialog";
import KeyRevealDialog from "@/components/vault/KeyRevealDialog";
import { prepareFileForUpload } from "@/lib/media-compression";
import {
  fetchItems,
  uploadFile,
  saveText,
  downloadItem,
  clearVaultKey,
  hasVaultPermission,
  fetchAccessKeys,
  fetchActivity,
  revokeAccessKey,
  flushOfflineQueue,
  exportCourtPackage,
  OfflineQueuedError,
} from "@/lib/vault-client";
import { isAccessKeyUsable } from "@/lib/vault-permissions";
import { formatVaultActivity } from "@/lib/vault-activity";
import type { EvidenceItem, VaultAccessKeyPublic, VaultActivitySummary } from "@/lib/types";

interface VaultDashboardProps {
  onLogout: () => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  file: <File className="size-4" />,
  audio: <Mic className="size-4" />,
  video: <Video className="size-4" />,
  text: <FileText className="size-4" />,
};

function permissionLabelKey(permissions: string[]): string {
  const hasRead = permissions.includes("read") || permissions.includes("download");
  const hasUpload = permissions.includes("upload");
  if (hasRead && !hasUpload) return "accessKeys.permissionsReadDownload";
  if (hasUpload && !hasRead) return "accessKeys.permissionsUpload";
  return "accessKeys.permissionsCustom";
}

export default function VaultDashboard({ onLogout }: VaultDashboardProps) {
  const { t, i18n } = useTranslation("common");
  const canRead = hasVaultPermission("read");
  const canUpload = hasVaultPermission("upload");
  const canDownload = hasVaultPermission("download");
  const canManage = hasVaultPermission("manage");

  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(canRead);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [savingText, setSavingText] = useState(false);
  const [accessKeys, setAccessKeys] = useState<VaultAccessKeyPublic[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(canManage);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newSubKey, setNewSubKey] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [activity, setActivity] = useState<VaultActivitySummary | null>(null);
  const [exporting, setExporting] = useState(false);

  const typeLabels: Record<string, string> = {
    file: t("vault.types.file"),
    audio: t("vault.types.audio"),
    video: t("vault.types.video"),
    text: t("vault.types.text"),
  };

  const loadItems = useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchItems();
      setItems(data.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.loadError"));
    } finally {
      setLoading(false);
    }
  }, [canRead, t]);

  const loadAccessKeys = useCallback(async () => {
    if (!canManage) {
      setLoadingKeys(false);
      return;
    }
    try {
      const data = await fetchAccessKeys();
      setAccessKeys(data.keys);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.loadError"));
    } finally {
      setLoadingKeys(false);
    }
  }, [canManage, t]);

  const loadActivity = useCallback(async () => {
    if (!canManage) return;
    try {
      setActivity(await fetchActivity());
    } catch {
      setActivity(null);
    }
  }, [canManage]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    loadAccessKeys();
  }, [loadAccessKeys]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  useEffect(() => {
    if (!canUpload) return;
    const flush = () => {
      void flushOfflineQueue()
        .then(({ sent }) => {
          if (sent > 0) {
            toast.success(t("toast.queuedFlushed", { count: sent }));
            void loadItems();
            void loadActivity();
          }
        })
        .catch(() => {});
    };
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [canUpload, loadItems, loadActivity, t]);

  const handleUpload = async (blob: Blob, filename: string, type?: string) => {
    setUploading(true);
    try {
      await uploadFile(blob, filename, type);
      toast.success(t("toast.uploaded"));
      await loadItems();
      await loadActivity();
    } catch (err) {
      if (err instanceof OfflineQueuedError) {
        toast.success(t("toast.queuedOffline"));
      } else {
        toast.error(err instanceof Error ? err.message : t("toast.loadError"));
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setUploadStatus(null);
    try {
      const { blob, filename } = await prepareFileForUpload(file, (progress) => {
        if (progress.phase === "video-loading") {
          setUploadStatus(t("vault.compressingVideoLoading"));
          return;
        }
        setUploadStatus(
          t("vault.compressingVideo", {
            percent: Math.round(progress.ratio * 100),
          })
        );
      });
      setUploadStatus(t("vault.uploading"));
      await uploadFile(blob, filename);
      toast.success(t("toast.uploaded"));
      await loadItems();
      await loadActivity();
    } catch (err) {
      if (err instanceof OfflineQueuedError) {
        toast.success(t("toast.queuedOffline"));
      } else {
        toast.error(err instanceof Error ? err.message : t("toast.loadError"));
      }
    } finally {
      setUploading(false);
      setUploadStatus(null);
    }
  };

  const handleSaveText = async () => {
    if (!text.trim()) return;
    setSavingText(true);
    try {
      await saveText(text.trim());
      setText("");
      toast.success(t("toast.textSaved"));
      await loadItems();
      await loadActivity();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.saveError"));
    } finally {
      setSavingText(false);
    }
  };

  const handleLogout = () => {
    clearVaultKey();
    onLogout();
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm(t("accessKeys.revokeConfirm"))) return;
    setRevokingId(id);
    try {
      await revokeAccessKey(id);
      toast.success(t("toast.keyRevoked"));
      await loadAccessKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.revokeError"));
    } finally {
      setRevokingId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportCourtPackage();
      toast.success(t("toast.courtExported"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.exportError"));
    } finally {
      setExporting(false);
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const dateLocale = i18n.language === "ru" ? "ru-RU" : "en-US";
  const activityLine = activity ? formatVaultActivity(activity, t, i18n.language) : null;

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t("vault.title")}</h1>
          <p className="text-muted-foreground text-sm">
            {canManage
              ? t("vault.subtitle")
              : canUpload && !canRead
                ? t("vault.subtitleUploadOnly")
                : t("vault.subtitleReadOnly")}
          </p>
          {activityLine && <p className="text-muted-foreground mt-1 text-xs">{activityLine}</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} title={t("vault.logout")}>
          <LogOut className="size-4" />
        </Button>
      </div>

      <InstallPrompt />

      {canUpload && (
        <Tabs defaultValue="upload">
          <TabsList className="w-full">
            <TabsTrigger value="upload" className="flex-1">
              {t("vault.tabUpload")}
            </TabsTrigger>
            <TabsTrigger value="record" className="flex-1">
              {t("vault.tabRecord")}
            </TabsTrigger>
            <TabsTrigger value="text" className="flex-1">
              {t("vault.tabText")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <label className="border-border flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors hover:border-red-500/50">
                  <Upload className="text-muted-foreground size-8" />
                  <span className="text-muted-foreground text-center text-sm">
                    {t("vault.uploadHint")}
                    <br />
                    <span className="text-xs">{t("vault.uploadMax")}</span>
                    <br />
                    <span className="text-xs">{t("vault.uploadFormats")}</span>
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                  />
                </label>
                {uploading && (
                  <div className="text-muted-foreground mt-4 flex items-center justify-center gap-2 text-sm">
                    <Loader2 className="size-4 animate-spin" />
                    {uploadStatus ?? t("vault.uploading")}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="record" className="mt-4 space-y-4">
            <SecureContextBanner />
            <RecordCard
              kind="audio"
              uploading={uploading}
              onRecorded={(b, n) => handleUpload(b, n, "audio")}
            />
            <RecordCard
              kind="video"
              uploading={uploading}
              onRecorded={(b, n) => handleUpload(b, n, "video")}
            />
          </TabsContent>

          <TabsContent value="text" className="mt-4">
            <Card>
              <CardContent className="space-y-3 pt-6">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t("vault.textPlaceholder")}
                  rows={6}
                  className="resize-none"
                />
                <Button
                  onClick={handleSaveText}
                  disabled={savingText || !text.trim()}
                  className="w-full"
                >
                  {savingText ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                  {t("vault.saveText")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {canRead && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-muted-foreground text-sm font-medium">
              {t("vault.savedItems")} ({items.length})
            </h2>
            <div className="flex items-center gap-1">
              {canDownload && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleExport()}
                  disabled={exporting || loading || items.length === 0}
                  title={t("vault.exportCourt")}
                >
                  {exporting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Package className="size-4" />
                  )}
                  {t("vault.exportCourt")}
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={loadItems} disabled={loading}>
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">{t("vault.noItems")}</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <Card key={item.id} className="py-3">
                  <CardContent className="flex items-center gap-3 px-4">
                    <div className="text-muted-foreground">{typeIcons[item.type]}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.name || typeLabels[item.type]}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {typeLabels[item.type]}
                        </Badge>
                        {item.size && (
                          <span className="text-muted-foreground text-xs">
                            {formatSize(item.size)}
                          </span>
                        )}
                        <span className="text-muted-foreground text-xs">
                          {new Date(item.createdAt).toLocaleString(dateLocale)}
                        </span>
                      </div>
                      {item.type === "text" && item.textContent && (
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                          {item.textContent}
                        </p>
                      )}
                    </div>
                    {canDownload && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          downloadItem(item)
                            .then(() => loadActivity())
                            .catch(() => toast.error(t("toast.downloadError")))
                        }
                        title={t("vault.download")}
                      >
                        <Download className="size-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {canManage && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-muted-foreground text-sm font-medium">{t("accessKeys.title")}</h2>
            <Button size="sm" variant="outline" onClick={() => setShowCreateKey(true)}>
              <Scale className="size-3.5" />
              {t("accessKeys.create")}
            </Button>
          </div>

          {loadingKeys ? (
            <div className="flex justify-center py-6">
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
            </div>
          ) : accessKeys.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              {t("accessKeys.empty")}
            </p>
          ) : (
            <div className="space-y-2">
              {accessKeys.map((key) => {
                const active = isAccessKeyUsable(key);
                return (
                  <Card key={key.id} className="py-3">
                    <CardContent className="flex items-center gap-3 px-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {t(permissionLabelKey(key.permissions))}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          {!active && (
                            <Badge variant="secondary" className="text-xs">
                              {key.revokedAt ? t("accessKeys.revoked") : t("accessKeys.expired")}
                            </Badge>
                          )}
                          <span className="text-muted-foreground text-xs">
                            {key.expiresAt
                              ? t("accessKeys.expiresAt", {
                                  date: new Date(key.expiresAt).toLocaleDateString(dateLocale),
                                })
                              : t("accessKeys.noExpiry")}
                          </span>
                        </div>
                      </div>
                      {active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(key.id)}
                          disabled={revokingId === key.id}
                        >
                          {revokingId === key.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : null}
                          {t("accessKeys.revoke")}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <CreateAccessKeyDialog
        open={showCreateKey}
        onOpenChange={setShowCreateKey}
        onCreated={(key) => {
          setNewSubKey(key);
          loadAccessKeys();
        }}
      />

      <KeyRevealDialog
        open={Boolean(newSubKey)}
        vaultKey={newSubKey ?? ""}
        title={t("accessKeys.revealTitle")}
        description={t("accessKeys.revealDescription")}
        onConfirm={() => setNewSubKey(null)}
      />
    </div>
  );
}
