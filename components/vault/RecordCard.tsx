"use client";

import { Mic, Video } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import VideoPreview from "@/components/vault/VideoPreview";
import MediaAccessDialog from "@/components/vault/MediaAccessDialog";
import { useMediaRecorder } from "@/hooks/use-media-recorder";

interface RecordCardProps {
  kind: "audio" | "video";
  uploading: boolean;
  onRecorded: (blob: Blob, filename: string) => void;
}

export default function RecordCard({ kind, uploading, onRecorded }: RecordCardProps) {
  const { t } = useTranslation("common");
  const recorder = useMediaRecorder({ kind, onRecorded });
  const Icon = kind === "video" ? Video : Mic;

  const handleMainAction = () => {
    if (recorder.isRecording) {
      recorder.stopRecording();
      return;
    }
    recorder.openAccessDialog();
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="size-4" />
            {kind === "video" ? t("record.video") : t("record.audio")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          {recorder.previewStream && <VideoPreview stream={recorder.previewStream} />}

          {recorder.isRecording && (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <span className="size-2 animate-pulse rounded-full bg-red-500" />
              {t("record.recording")}
            </div>
          )}

          {recorder.error && !recorder.showAccessDialog && (
            <p className="text-destructive text-center text-sm">{recorder.error}</p>
          )}

          <Button
            onClick={handleMainAction}
            disabled={uploading}
            variant={recorder.isRecording ? "destructive" : "outline"}
            className="w-full"
          >
            <Icon className="size-4" />
            {recorder.isRecording
              ? t("record.stop")
              : kind === "video"
                ? t("record.startVideo")
                : t("record.startAudio")}
          </Button>

          {!recorder.isRecording && (
            <button
              type="button"
              onClick={recorder.openAccessDialog}
              className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
            >
              {kind === "video" ? t("record.setupCamera") : t("record.setupMic")}
            </button>
          )}
        </CardContent>
      </Card>

      <MediaAccessDialog
        open={recorder.showAccessDialog}
        onOpenChange={recorder.setShowAccessDialog}
        kind={kind}
        blockReason={recorder.blockReason}
        error={recorder.error}
        needsSettings={recorder.needsSettings}
        onAllow={recorder.requestAccessAndRecord}
      />
    </>
  );
}
