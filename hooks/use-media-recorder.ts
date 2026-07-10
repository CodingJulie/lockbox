"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRecorderOptions, pickRecorderMimeType } from "@/lib/media-compression";
import {
  detectMediaEnvironment,
  getEnvironmentBlockReason,
  getMediaConstraints,
  mapMediaError,
  queryMediaPermission,
  type MediaKind,
  type PermissionStatus,
} from "@/lib/media-permissions";

interface UseMediaRecorderOptions {
  kind: MediaKind;
  onRecorded: (blob: Blob, filename: string) => void;
}

export function useMediaRecorder({ kind, onRecorded }: UseMediaRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>("unknown");
  const [needsSettings, setNeedsSettings] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [showAccessDialog, setShowAccessDialog] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const envRef = useRef(detectMediaEnvironment());

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setPreviewStream(null);
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  useEffect(() => {
    const env = detectMediaEnvironment();
    envRef.current = env;
    setBlockReason(getEnvironmentBlockReason(env));
    void queryMediaPermission(kind).then(setPermissionStatus);
  }, [kind]);

  const beginRecording = useCallback(
    (stream: MediaStream) => {
      streamRef.current = stream;
      if (kind === "video") setPreviewStream(stream);
      chunksRef.current = [];

      const mimeType = pickRecorderMimeType(kind, envRef.current.browser);
      const recorder = new MediaRecorder(stream, getRecorderOptions(mimeType, kind));

      mediaRecorderRef.current = recorder;
      const actualMime =
        recorder.mimeType || mimeType || (kind === "video" ? "video/webm" : "audio/webm");

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: actualMime });
        const ext = actualMime.includes("mp4") ? "mp4" : "webm";
        onRecorded(blob, `${kind}-${Date.now()}.${ext}`);
        stopStream();
        setIsRecording(false);
      };

      recorder.onerror = () => {
        setError("Ошибка во время записи");
        stopStream();
        setIsRecording(false);
      };

      recorder.start(1000);
      setIsRecording(true);
      setPermissionStatus("granted");
      setShowAccessDialog(false);
    },
    [kind, onRecorded, stopStream]
  );

  /** Must be called directly from a user click/tap */
  const requestAccessAndRecord = useCallback(async () => {
    setError(null);
    setNeedsSettings(false);

    const env = detectMediaEnvironment();
    envRef.current = env;
    const blocked = getEnvironmentBlockReason(env);
    if (blocked) {
      setBlockReason(blocked);
      setShowAccessDialog(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(kind));
      beginRecording(stream);
    } catch (err) {
      const mapped = mapMediaError(err, kind);
      setError(mapped.message);
      setNeedsSettings(mapped.needsSettings);
      setPermissionStatus("denied");
      setShowAccessDialog(true);
    }
  }, [kind, beginRecording]);

  const openAccessDialog = useCallback(() => {
    setError(null);
    const env = detectMediaEnvironment();
    envRef.current = env;
    const blocked = getEnvironmentBlockReason(env);
    setBlockReason(blocked);
    setNeedsSettings(Boolean(blocked));

    void queryMediaPermission(kind).then((status) => {
      setPermissionStatus(status);
      if (status === "denied") setNeedsSettings(true);
    });

    setShowAccessDialog(true);
  }, [kind]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return {
    kind,
    isRecording,
    error,
    permissionStatus,
    needsSettings,
    previewStream,
    showAccessDialog,
    setShowAccessDialog,
    blockReason,
    openAccessDialog,
    requestAccessAndRecord,
    stopRecording,
  };
}
