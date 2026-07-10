"use client";

import { useEffect, useRef } from "react";

interface VideoPreviewProps {
  stream: MediaStream | null;
}

export default function VideoPreview({ stream }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
      void video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="border-border aspect-video w-full rounded-lg border bg-black object-cover"
    />
  );
}
