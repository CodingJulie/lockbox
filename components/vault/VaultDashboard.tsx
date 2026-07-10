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
} from "lucide-react";
import { toast } from "sonner";
import RecordCard from "@/components/vault/RecordCard";
import InstallPrompt from "@/components/vault/InstallPrompt";
import SecureContextBanner from "@/components/vault/SecureContextBanner";
import { prepareFileForUpload } from "@/lib/media-compression";
import { fetchItems, uploadFile, saveText, downloadItem, clearVaultKey } from "@/lib/vault-client";
import type { EvidenceItem } from "@/lib/types";

interface VaultDashboardProps {
  onLogout: () => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  file: <File className="size-4" />,
  audio: <Mic className="size-4" />,
  video: <Video className="size-4" />,
  text: <FileText className="size-4" />,
};

export default function VaultDashboard({ onLogout }: VaultDashboardProps) {
  const { t, i18n } = useTranslation("common");
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [savingText, setSavingText] = useState(false);

  const typeLabels: Record<string, string> = {
    file: t("vault.types.file"),
    audio: t("vault.types.audio"),
    video: t("vault.types.video"),
    text: t("vault.types.text"),
  };

  const loadItems = useCallback(async () => {
    try {
      const data = await fetchItems();
      setItems(data.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleUpload = async (blob: Blob, filename: string, type?: string) => {
    setUploading(true);
    try {
      await uploadFile(blob, filename, type);
      toast.success(t("toast.uploaded"));
      await loadItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.loadError"));
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.loadError"));
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

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const dateLocale = i18n.language === "ru" ? "ru-RU" : "en-US";

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t("vault.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("vault.subtitle")}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} title={t("vault.logout")}>
          <LogOut className="size-4" />
        </Button>
      </div>

      <InstallPrompt />

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

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-muted-foreground text-sm font-medium">
            {t("vault.savedItems")} ({items.length})
          </h2>
          <Button variant="ghost" size="icon" onClick={loadItems} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
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
                    <p className="truncate text-sm font-medium">{item.name}</p>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      downloadItem(item.id, item.name).catch(() =>
                        toast.error(t("toast.downloadError"))
                      )
                    }
                    title={t("vault.download")}
                  >
                    <Download className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
